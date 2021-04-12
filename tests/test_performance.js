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
		x() { return recursive_repeat(t) };
		y() { return 0; }
	}
	globalThis.A = A;

	class B {
		x() { return recursive_repeat(t); }
		y() { return 0; }
		z() { return 0; }
	}
	globalThis.B = B;

	class C {
		x() { return recursive_repeat(t) };
		y() { return 0; }
	}
	globalThis.C = C;

	class D {
		x() { return recursive_repeat(t) };
		y() { return 0; }
	}
	globalThis.D = D;

	// Instantiate
	let a = new A();
	let b = new B();
	let c = new C();
	let d = new D();

	// Test many calls, unwrapped
	const call_reps = 1000;
	measure_perf(t, `........... Unwrapped, ${call_reps} Calls`, () => {
		for(let i = 0; i < call_reps; i++)
			a.y()
	}, 0.1);

	// Test many calls with no wrappers
	game.add_module('m0');
	libWrapper.register('m0', 'C.prototype.y', (wrapped, ...args) => wrapped(...args));
	unwrap_all_from_obj(C.prototype, 'y');
	libWrapper.register('m0', 'D.prototype.y', (wrapped, ...args) => wrapped(...args), 'MIXED', {perf_mode: 'FAST'});
	unwrap_all_from_obj(D.prototype, 'y');

	measure_perf(t, `Library.... 0 Wrappers, ${call_reps} Calls`, () => {
		for(let i = 0; i < call_reps; i++)
			c.y()
	}, 0.5);
	measure_perf(t, `Fast Mode.. 0 Wrappers, ${call_reps} Calls`, () => {
		for(let i = 0; i < call_reps; i++)
			d.y()
	}, 0.5);

	// Test many calls with a single wrapper
	A.prototype.y = (() => { const wrapped = A.prototype.y; return (...args) => wrapped(...args); })();
	libWrapperShim.register('m0', 'B.prototype.y', (wrapped, ...args) => wrapped(...args));
	libWrapper.register('m0', 'C.prototype.y', (wrapped, ...args) => wrapped(...args));
	libWrapper.register('m0', 'D.prototype.y', (wrapped, ...args) => wrapped(...args), 'MIXED', {perf_mode: 'FAST'});

	measure_perf(t, `Traditional 1 Wrapper , ${call_reps} Calls`, () => {
		for(let i = 0; i < call_reps; i++)
			a.y()
	}, 0.5);
	measure_perf(t, `Shim....... 1 Wrapper , ${call_reps} Calls`, () => {
		for(let i = 0; i < call_reps; i++)
			b.y();
	}, 0.5);
	measure_perf(t, `Library.... 1 Wrapper , ${call_reps} Calls`, () => {
		for(let i = 0; i < call_reps; i++)
			c.y()
	}, 2.5);
	measure_perf(t, `Fast Mode.. 1 Wrapper , ${call_reps} Calls`, () => {
		for(let i = 0; i < call_reps; i++)
			d.y()
	}, 0.5);

	// Test with many wrappers
	let wrapper_cnt;
	for(wrapper_cnt = 0; wrapper_cnt < 1000; wrapper_cnt++) {
		const module_nm = `m${wrapper_cnt}`;
		game.add_module(module_nm);

		A.prototype.x = (() => { const wrapped = A.prototype.x; return (...args) => wrapped(...args); })();
		libWrapperShim.register(module_nm, 'B.prototype.x', (wrapped, ...args) => wrapped(...args));
		libWrapper.register(module_nm, 'C.prototype.x', (wrapped, ...args) => wrapped(...args));
		libWrapper.register(module_nm, 'D.prototype.x', (wrapped, ...args) => wrapped(...args), 'MIXED', {perf_mode: 'FAST'});
	}

	measure_perf(t, `Traditional ${wrapper_cnt} Wrappers, 1 Call`, () => a.x(), 0.5);
	measure_perf(t, `Shim....... ${wrapper_cnt} Wrappers, 1 Call`, () => b.x(), 0.5);
	measure_perf(t, `Library.... ${wrapper_cnt} Wrappers, 1 Call`, () => c.x(), 2.5);
	measure_perf(t, `Fast Mode.. ${wrapper_cnt} Wrappers, 1 Call`, () => d.x(), 0.5);

	// Done
	t.end();
}, {sync_async: false});