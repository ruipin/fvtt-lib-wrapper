// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro


'use strict';

import test from 'tape';
import { performance } from 'perf_hooks';

import {unwrap_all_from_obj} from './utilities.js';
import {libWrapper as libWrapperShim} from '../shim/shim.js';
import '../src/lib/api.js';


function setup() {
	libWrapper._UT_unwrap_all();
	game.clear_modules();
}


// Utilities
function measure_perf(t, name, fn, max, min=0, reps=200) {
	const results = [];
	for(let i = 0; i < reps; i++) {
		const start = performance.now();

		fn();

		const end = performance.now();
		results.push(end - start);
	}

	const sum = results.reduce((a, b) => a + b, 0);
	const avg = sum / results.length;

	const display = Math.ceil(avg * 100) / 100

	if(min > 0)
		t.ok(avg >= min, `${name}: ${display}ms >= ${min}ms`);

	t.ok(avg <= max, `${name}: ${display}ms <= ${max}ms`);
}

function recursive_repeat(t, i=0, reps=1000) {
	if(i < reps)
		return recursive_repeat(t, i+1, reps);
	return i;
}

// Main functionality of the libWrapper Shim
test('Performance', function (t) {
	setup();

	class A {
		y() { return 0; }
	}
	A.prototype.x = () => recursive_repeat(t);
	globalThis.A = A;

	class B {
		y() { return 0; }
	}
	B.prototype.x = () => recursive_repeat(t);
	globalThis.B = B;

	// Instantiate
	let a = new A();
	let b = new B();

	// Test many calls, unwrapped
	const call_reps = 1000;
	measure_perf(t, `Full: Unwrapped, ${call_reps} Calls`, () => {
		for(let i = 0; i < call_reps; i++)
			b.y()
	}, 0.1);

	// Test many calls with no wrappers
	game.add_module('m0');
	libWrapper.register('m0', 'B.prototype.y', (wrapped, ...args) => wrapped(...args));
	unwrap_all_from_obj(B.prototype, 'y');

	measure_perf(t, `Full: 0 Wrappers, ${call_reps} Calls`, () => {
		for(let i = 0; i < call_reps; i++)
			b.y()
	}, 1);

	// Test many calls with a single wrapper
	libWrapperShim.register('m0', 'A.prototype.y', (wrapped, ...args) => wrapped(...args));
	libWrapper.register('m0', 'B.prototype.y', (wrapped, ...args) => wrapped(...args));

	measure_perf(t, `Shim: 1 Wrapper , ${call_reps} Calls`, () => {
		for(let i = 0; i < call_reps; i++)
			a.y()
	}, 1);
	measure_perf(t, `Full: 1 Wrapper , ${call_reps} Calls`, () => {
		for(let i = 0; i < call_reps; i++)
			b.y()
	}, 10);

	// Test with many wrappers
	let wrapper_cnt;
	for(wrapper_cnt = 0; wrapper_cnt < 1000; wrapper_cnt++) {
		const module_nm = `m${wrapper_cnt}`;
		game.add_module(module_nm);

		libWrapperShim.register(module_nm, 'A.prototype.x', (wrapped, ...args) => wrapped(...args));
		libWrapper.register(module_nm, 'B.prototype.x', (wrapped, ...args) => wrapped(...args));
	}

	measure_perf(t, `Shim: ${wrapper_cnt} Wrappers, 1 Call`, () => a.x(), 0.1);
	measure_perf(t, `Full: ${wrapper_cnt} Wrappers, 1 Call`, () => b.x(), 1);

	// Done
	t.end();
});