// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';


// Import node's deepEqual algorithm
import * as module_deepEqual from 'deep-equal';
const deepEqual = module_deepEqual.default;

// Other imports
import {async_retval, is_promise} from './utilities.js';


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
		this.call_order = [];

		this.depth = -1; // Depth of the current call stack
		this.index = -1; // Index into call order

		this.thrown = false;
	}

	_get_frame(i) {
		if(i < 0)
			return null;

		return this.call_order[i];
	}

	_add_frame() {
		const idx = ++this.index;
		const frm = {index: idx};
		this.call_order.push(frm);

		return frm;
	}

	_add_call_frame() {
		const frm = this._add_frame();

		frm.depth = ++this.depth;

		return frm;
	}

	_on_return() {
		const frm = this._get_frame(this.index);

		frm.return_count = frm.return_count + 1;
		this.depth--;
	}

	_get_frame_caller(frm) {
		const prev_frm = this._get_frame(frm.index - 1);

		if(!prev_frm)
			return null;

		return this._get_frame(frm.index - 1 - prev_frm.return_count);
	}

	_get_frame_callee(frm) {
		if(frm.thrown)
			return null;

		if(frm.return_count)
			return null;

		return this._get_frame(frm.index + 1);
	}



	// Utility
	_validate_id(id) {
		const typ = (typeof id);

		if(typ === 'string')
			return true;

		if(typ === 'number') {
			return id >= 0;
		}

		return false;
	}

	validate_id(id) {
		if(!this._validate_id(id))
			throw `Invalid id '${id}'`;
	}

	simplify() {
		const arr = [];

		for(const frm of this.call_order) {
			arr.push(frm.id);

			if(frm.return_count)
				arr.push(-frm.return_count);

			if(frm.thrown)
				arr.push('THROWN');
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



	// Call handler
	_on_call(id, in_this, args, cbs={}) {
		// Setup frame
		const frm = this._add_call_frame();
		frm.id = id;
		frm.this = in_this;
		frm.args = args;
		frm.cbs = cbs;
		frm.return_count = 0;

		if(frm.cbs.onInitFrame)
			frm.cbs.onInitFrame.call(this, frm);

		// Chain wrapper
		if(frm.cbs.doChainWrapper) {
			frm.nxt_args = [];

			// Call next
			let chain_result = null;
			try {
				chain_result = frm.cbs.doChainWrapper.call(this, frm);
			}
			catch (e) {
				return this._cleanup_call(frm, true, e);
			}

			frm.nxt_promise = is_promise(chain_result);

			// Cleanup
			if(frm.nxt_promise)
				return chain_result.then(
					v => this._cleanup_call(frm, false, v),
					e => this._cleanup_call(frm, true, e)
				);
			else
				return this._cleanup_call(frm, false, chain_result);
		}

		// Cleanup - we're the last method in the chain
		return this._cleanup_call(frm, false, undefined);
	}

	_cleanup_call(frm, thrown, chain_result) {
		// Sanity check depth
		if(this.depth != frm.depth)
			throw `Call stack depth is ${this.depth}, expected ${frm.depth}`;

		// Update frame
		frm.thrown = thrown;
		frm.result = undefined;
		this._on_return();

		if(!thrown) {
			frm.nxt_result = chain_result;

			if(frm.cbs.onReturn)
				frm.cbs.onReturn.call(this, frm);
		}
		else {
			this.thrown = true;
			frm.except = chain_result;

			if(frm.cbs.onExcept)
				frm.cbs.onExcept.call(this, frm);

			throw frm.except;
		}

		// If we didn't chain, are in async mode, and aren't returning a promise, convert return value to a (delayed) promise
		let to_return = frm.result;
		if(!frm.cbs.doChainWrapper && this.is_async && !is_promise(to_return))
			to_return = async_retval(to_return);

		// Done
		return to_return;
	}



	// Function generators
	gen_fn(id, fn, {is_wrapper=true, randomize_args=true}={}) {
		this.validate_id(id);

		const _checker = this;

		const onInitFrame = function(frm) {
			frm.is_wrapper = is_wrapper;

			frm.in_args = frm.args.slice(is_wrapper ? 1 : 0);
			frm.in_id = frm.in_args[1];
		}

		const doChainWrapper = fn ? function(frm) {
			frm.nxt_args.push(frm.in_args[0], frm.id);

			// Randomize args
			if(randomize_args) {
				frm.nxt_args.push(frm.in_args[0]);

				const nr_extra_args = this.random(0, NR_PARAMETERS-1);
				for(let i = 0; i < nr_extra_args; i++)
					frm.nxt_args.push(this.random(0,20));
			}

			// Chain wrapper
			const chain_args = [...frm.nxt_args];

			if(is_wrapper) {
				const chain = frm.args[0].bind(frm.this, ...chain_args);

				return fn.call(this, frm, chain, chain_args);
			}

			return fn.call(this, frm, chain_args);
		} : null;

		const onReturn = function(frm) {
			frm.nxt_id = frm.nxt_result;
			frm.result = frm.id;
		}

		return function(...args) {
			return _checker._on_call(
				id,
				this,
				args,
				{
					onInitFrame: onInitFrame,
					doChainWrapper: doChainWrapper,
					onReturn: onReturn
				}
			);
		}
	}

	gen_wr(id, {override=false, nochain=false}={}) {
		return this.gen_fn(
			id,
			(override || nochain) ? null : (frm, chain) => chain(),
			{
				is_wrapper: !override,
				randomize_args: (!override && !nochain)
			}
		);
	}

	gen_rt(id, {next=null}={}) {
		return this.gen_fn(
			id,
			!next ? null : (frm, chain_args) => next.call(frm.this, ...chain_args),
			{
				is_wrapper: false
			}
		);
	}



	// Checker
	_check(retval, expected, {title=null, param_in=[], clear=true, errors=[], check_retval=true}={}) {
		// Validate call stack
		let top_frame = null;

		for(let i = 0; i < this.call_order.length; i++) {
			const current = this._get_frame(i);
			if(current.depth == 0)
				top_frame = current;

			// Handle call frames
			const frame_title = `Frame #${i} ID=${current.id}`;

			const error = (msg) => {
				errors.push(`${frame_title} ${msg}`);
			}

			const compare = (exp, got, msg) => {
				if(!deepEqual(exp, got))
					error(`${msg}: Expected '${JSON.stringify(exp)}', got '${JSON.stringify(got)}'.`);
			}

			// Validate caller
			const caller = this._get_frame_caller(current);

			if(caller) {
				compare(current.depth, caller.depth+1 , 'Depth Mismatch');

				if(current.in_id)
					compare(current.in_id, caller.id, 'Caller ID Mismatch');

				compare(current.this , caller.this , 'Caller \'this\' Mismatch');
				compare(current.in_args, caller.nxt_args, 'Caller Arguments Mismatch');
			}
			else {
				compare(current.depth, 0, 'Depth Mismatch');

				if(current.in_id)
					compare('TOP', current.in_id, 'Caller ID Mismatch');

				compare(param_in, current.in_args, 'Caller Arguments Mismatch');
			}

			// Validate callee
			const callee = this._get_frame_callee(current);

			if(callee) {
				if(is_promise(current.nxt_result))
					error(`Callee Returned Promise. Expected ${callee.id}`);
				else if(current.nxt_id)
					compare(current.nxt_id, callee.id, 'Callee ID Mismatch');

				compare(current.this , callee.this, 'Callee \'this\' Mismatch');
				compare(current.nxt_args, callee.in_args, 'Callee Arguments Mismatch');
			}

			// Validate return count
			const next_frame = this._get_frame(i+1);
			const exp_return_count = current.depth - (next_frame?.depth ?? 0) + 1;

			compare(exp_return_count, current.return_count, 'Return count mismatch');
		}

		// Validate final return value
		const exp_retval = this.thrown ? null : top_frame.id;
		if(check_retval && exp_retval !== retval)
			errors.push(`Return Value Mismatch. Expected '${JSON.stringify(exp_retval)}', got '${JSON.stringify(retval)}'.`);

		// Do deep comparison
		const got_simplified = this.simplify();
		const got_simplified_str = this.simplified_string(got_simplified);
		const exp_simplified_str = this.simplified_string(expected);
		title = title ?? exp_simplified_str;

		if(!deepEqual(got_simplified, expected))
			errors.push(`Call Order Mismatch. Expected: ${exp_simplified_str}\n                     Got:      ${got_simplified_str}`);

		// We manually emit a tape result in order to get prettier output
		const is_ok = (errors.length === 0);
		this.tape.emit('result', {
			//id: this.tape.assertCount++,
			ok: is_ok,
			name: title,
			operator: 'CallOrderChecker.check',
			objectPrintDepth: 0,
			error: {stack: errors.join('\n')}
		})

		if(!is_ok)
			console.debug(this.call_order);

		// Done
		if(clear)
			this.clear();
	}

	check(retval, expected, extra={}) {
		// Await if necessary
		let check_retval = true;

		if(is_promise(retval)) {
			const errors = [];

			if(!this.is_async) {
				extra.errors = ['Return Value Is Promise.'];
				extra.check_retval = false;
			}

			return retval.then(v => this._check(v, expected, extra));
		}

		return this._check(retval, expected, extra);
	}

	call(obj, fn_name, expected, extra={}) {
		// Get method
		const fn = obj[fn_name].bind(obj);

		// Randomize arguments
		const args = [extra.arg0 ?? 'arg0', extra.top_id ?? 'TOP'];
		const nr_args = this.random(1, NR_PARAMETERS);
		for(let i = 0; i < nr_args; i++)
			args.push(this.random(0,20));

		// Call method
		extra.param_in = args;
		const result = fn(...args);

		if(is_promise(result))
			return result.then(v => this.check(v, expected, extra));

		return this.check(result, expected, extra);
	}
}
Object.freeze(CallOrderChecker);