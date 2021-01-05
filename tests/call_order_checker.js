// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';


// Import node's deepEqual algorithm
import * as module_deepEqual from 'deep-equal';
const deepEqual = module_deepEqual.default;

// Other imports
import {async_retval} from './utilities.js';


// Constants
const NR_PARAMETERS = 10;


// Call order checker
export class CallOrderChecker {
	constructor(tape, is_async=false) {
		this.tape = tape;
		this.is_async = is_async || tape.test_async;
		this.clear();
		this.seed = 1;
	}

	clear() {
		this.stack = [];
		this.index = 0;
	}

	_get_frame(i) {
		if(i < 0)
			return null;

		return this.stack[i];
	}

	_pop_frame() {
		this.index--;
	}


	// Utility
	simplify() {
		const arr = [];

		for(const frm of this.stack) {
			arr.push(frm.id);
		}

		return arr;
	}

	simplified_string(simplified=null) {
		simplified = simplified ?? this.simplify();
		return '[' + simplified.join(', ') + ']';
	}

	toString() {
		return this.simplified_string();
	}


	random(min, max) {
		// Very basic (non-crypto) PRNG implementation
		let x = Math.sin(this.seed++) * 10000;
		return Math.floor((x - Math.floor(x)) * (max - min) + min);
	}


	// Frame handlers
	on_frame(id, is_last, next, in_this, in_id, ...in_args) {
		// Setup frame
		const idx = this.index++;

		let frm = this._get_frame(idx);
		if(frm) {
			// TODO: double call
			throw 'TODO: double call';
		}
		else {
			frm = {
				index: idx,
				id: id,
				in_this: in_this,
				in_id: in_id,
				in_args: in_args
			};
			this.stack.push(frm);
		}

		// Chain wrapper
		if(!is_last) {
			// Randomize args
			const nxt_args = [in_args[0]];

			const nr_extra_args = this.random(0, NR_PARAMETERS-1);
			for(let i = 0; i < nr_extra_args; i++)
				nxt_args.push(this.random(0,20));

			frm.nxt_args = nxt_args;

			// Call next wrapper
			const result = next.call(in_this, id, ...nxt_args);

			// Cleanup
			if(this.is_async)
				return result.then(v => this._cleanup_frame(id, frm, v));
			else
				return this._cleanup_frame(id, frm, result);
		}

		// Cleanup - we're the last method in the chain
		return this._cleanup_frame(this.is_async ? async_retval(id) : id, frm, undefined);
	}

	_cleanup_frame(to_return, frm, nxt_id) {
		// Sanity check
		if(this.index != frm.index+1)
			throw `Stack index is ${this.index}, expected ${frm.index+1}`;

		// Update frame
		frm.nxt_id = nxt_id;

		// Pop frame
		this.index--;

		// Done
		return to_return;
	}


	// Function generators
	gen_wr(id, is_override=false) {
		const _checker = this;

		if(is_override) {
			return function(...args) {
				return _checker.on_frame(id, true, undefined, this, ...args); 
			}
		}
		else {
			return function(wrapped, ...args) {
				return _checker.on_frame(id, false, wrapped, this, ...args); 
			}
		}
	}

	gen_fn(id, next=undefined) {
		const _checker = this;
		return function(...args) {
			return _checker.on_frame(id, !next, next, this, ...args); 
		}
	}




	// Checker
	check(retval, expected, title, {param_in=[], clear=true}={}) {
		const simplified = this.simplify();
		const simplified_str = this.simplified_string(simplified);

		// Validate call stack
		const errors = [];

		for(let i = 0; i < this.stack.length; i++) {
			const current = this._get_frame(i);

			const compare = (exp, got, msg) => {
				if(!deepEqual(exp, got))
					errors.push(`Frame #${i} ID=${current.id} ${msg}: Expected '${JSON.stringify(exp)}', got '${JSON.stringify(got)}'.`);
			}

			// Validate caller
			const caller = this._get_frame(i-1);

			if(caller) {
				compare(current.in_id  , caller.id      , 'Caller Mismatch');
				compare(current.in_args, caller.nxt_args, 'Caller Arguments Mismatch');
				compare(current.in_this, caller.in_this , 'Caller \'this\' Mismatch');
			}
			else {
				const current_in_args = (current.in_id || current.in_args.length) ? [current.in_id, ...current.in_args] : [];
				compare(param_in, current_in_args, 'First Call Arguments Mismatch');
			}

			// Validate callee
			const callee = this._get_frame(i+1);

			compare(current.nxt_id  , callee?.id      ?? null     , 'Callee Mismatch');
			compare(current.nxt_args, callee?.in_args ?? undefined, 'Callee Arguments Mismatch');

			if(callee)
				compare(current.in_this , callee.in_this, 'Callee \'this\' Mismatch');
		}

		// Validate final return value
		const exp_retval = this._get_frame(0).id;
		if(exp_retval !== retval)
			errors.push(`Return Value Mismatch. Expected '${JSON.stringify(exp_retval)}', got '${JSON.stringify(retval)}'.`);

		// Do deep comparison
		if(!deepEqual(simplified, expected))
			errors.push(`Call Order Mismatch. Expected: ${this.simplified_string(expected)}\n                     Got:      ${simplified_str}`);

		// We manually emit a tape result in order to get prettier output
		this.tape.emit('result', {
			//id: this.tape.assertCount++,
			ok: (errors.length === 0),
			name: `${title} => ${simplified_str}`,
			operator: 'StackChecker.check',
			objectPrintDepth: 0,
			error: {stack: errors.join('\n')}
		})

		// Done
		if(clear)
			this.clear();
	}

	async call(obj, fn_name, expected, title, extra={}) {
		// Get method
		const fn = obj[fn_name].bind(obj);

		// Randomize arguments
		const args = [];
		const nr_args = this.random(1, NR_PARAMETERS);
		for(let i = 0; i < nr_args; i++)
			args.push(this.random(0,20));

		// Call method
		extra.param_in = args;
		this.check(await fn(...args), expected, title, extra);
	}
}
Object.freeze(CallOrderChecker);