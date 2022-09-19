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

	game.reset();
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


// Main functionality of the libWrapper Shim
test('Performance', function (t) {
	setup();

	class A {
		x() { return 0 }
	}
	globalThis.A = A;

	class B {
		x() { return 0 }
	}
	globalThis.B = B;

	class C {
		x() { return 0 };
	}
	globalThis.C = C;

	class D {
		x() { return 0 };
	}
	globalThis.D = D;


	// Instantiate
	let a = new A();
	let b = new B();
	let c = new C();
	let d = new D();


	// Utility functions
	const original_A_prototype_x = A.prototype.x;
	const original_B_prototype_x = B.prototype.x;
	const wrap_many = function(wrappers) {
		A.prototype.x = original_A_prototype_x;
		B.prototype.x = original_B_prototype_x;
		unwrap_all_from_obj(C.prototype, 'x');
		unwrap_all_from_obj(D.prototype, 'x');

		for(let i = 0; i < wrappers; i++) {
			const module_nm = `m${i}`;
			game.add_module(module_nm);

			A.prototype.x = (() => { const wrapped = A.prototype.x; return (...args) => wrapped(...args); })();
			libWrapperShim.register(module_nm, 'B.prototype.x', (wrapped, ...args) => wrapped(...args));
			libWrapper.register(module_nm, 'C.prototype.x', (wrapped, ...args) => wrapped(...args));
			libWrapper.register(module_nm, 'D.prototype.x', (wrapped, ...args) => wrapped(...args), 'MIXED', {perf_mode: 'FAST'});
		}
	}

	const call_many_objects = function(t, title, cls, objs, calls, max) {
		const objarr = [];

		for(let i = 0; i < objs; i++)
			objarr[i] = new cls();

		measure_perf(t, title, () => {
			for(let call = 0; call < calls; call++) {
				for(const obj of objarr)
					cls.prototype.x.apply(obj);
			}
		}, max);
	}

	const measure_perf_all = function(t, wrappers, calls, objs, maxA, maxB, maxC, maxD) {
		wrap_many(wrappers);

		const info = `${wrappers} Wrappers, ${calls} Calls, ${objs} Objects`;
		call_many_objects(t, `Traditional ${info}`, A, objs, calls, maxA);
		call_many_objects(t, `Shim....... ${info}`, B, objs, calls, maxB);
		call_many_objects(t, `Library.... ${info}`, C, objs, calls, maxC);
		call_many_objects(t, `Fast Mode.. ${info}`, D, objs, calls, maxD);
	}


	// Test many calls with no wrappers
	measure_perf_all(t, 0, 1000, 1, 1.0, 1.0, 1.0, 1.0);

	// Test many calls with a single wrapper
	measure_perf_all(t, 1, 1000, 1, 1.0, 1.0, 2.5, 1.0);

	// Test with many wrappers
	measure_perf_all(t, 1000, 1, 1, 1.0, 1.0, 2.5, 1.0);

	// Test many objects
	measure_perf_all(t, 1, 1, 1000, 1.0, 1.0, 2.5, 1.0);

	// Test many objects and wrappers
	measure_perf_all(t, 10, 10, 10, 1.0, 1.0, 2.5, 1.0);


	// Done
	t.end();
}, {sync_async: false});