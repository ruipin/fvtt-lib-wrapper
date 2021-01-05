// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';


import test from 'tape';
import './utilities.js';
import {libWrapper as libWrapperShim} from '../shim/shim.js';
import '../src/lib/lib-wrapper.js';

function setup() {
	game.clear_modules();
}


test('Shim: Basic functionality', function (t) {
	setup();

	// Definitions
	let __x = 1;
	class A {
		get xvalue() {
			return __x;
		}

		set xvalue(value) {
			__x = value;
		}

		x(in_value=0) {
			return in_value + this.xvalue;
		}
	}

	globalThis.A = A;
	let a = new A();
	t.equal(a.x(1), 2, 'Original');

	// Check libWrapper is a shim
	t.equal(libWrapperShim.is_fallback, true, 'Check shim is fallback');
	t.equal(libWrapper.is_fallback, false, 'Check real is not fallback');

	// Use shim to wrap method
	game.add_module('module1');
	let module1_check = 2;
	libWrapperShim.register('module1', 'A.prototype.x', function(wrapped, ...args) {
		t.equal(wrapped(...args), module1_check, 'Module 1');
		return 1000;
	});
	t.equal(a.x(1), 1000, 'Wrapped #1');

	// Wrap xvalue getter
	libWrapperShim.register('module1', 'A.prototype.xvalue', function(wrapped, ...args) {
		return wrapped()+1;
	});
	module1_check = 3;
	t.equal(a.x(1), 1000, 'Wrapped getter #1');

	// Wrap xvalue setter
	libWrapperShim.register('module1', 'A.prototype.xvalue#set', function(wrapped, value) {
		wrapped(value+1);
	});
	a.xvalue = 3;
	module1_check = 6;
	t.equal(a.x(1), 1000, 'Wrapped setter #1');
	t.equal(__x, 4, 'Wrapper setter #2');

	// Test override
	libWrapperShim.register('module1', 'A.prototype.xvalue', function(wrapped, ...args) {
		return 2000;
	}, 'OVERRIDE');
	module1_check = 2001;
	t.equal(a.x(1), 1000, 'Override #1');

	// Register a real wrapper
	let module1_check_2 = 1000;
	libWrapper.register('module1', 'A.prototype.x', function(wrapped, ...args) {
		t.equal(wrapped(...args), module1_check_2, 'Module 1.2');
		return 2000;
	});
	t.equal(a.x(1), 2000, 'Wrapped #2');

	// Unregister
	libWrapper.unregister('module1', 'A.prototype.x');


	// Test invalid getter
	t.throws(() => { libWrapperShim.register('module1', 'A.prototype.xyz', ()=>{}); }, undefined, "Wrap invalid getter");

	// Test invalid setter
	t.throws(() => { libWrapperShim.register('module1', 'A.prototype.x#set', ()=>{}); }, undefined, "Wrap invalid setter");


	// Inherited method wrapping
	class B {
		x() {
			return 1;
		}
	}
	globalThis.B = B;

	class C extends B {
	}
	globalThis.C = C;

	let bxValue = 1;
	let c = new C();
	t.equal(c.x(), bxValue, 'Original');

	// Register wrapper for inherited class
	libWrapperShim.register('module1', 'C.prototype.x', function(original) {
		t.equal(original(), bxValue, 'xWrapper 1');
		return 10;
	});
	t.equal(c.x(), 10, "Wrapped with 10");


	// Setter
	let __dx = 1;
	class D {
		get x() {
			return __dx;
		}

		set x(value) {
			__dx = value;
		}
	}
	globalThis.D = D;
	let d = new D();
	t.equal(d.x, 1, 'Original');

	// Register wrapper for setter
	libWrapperShim.register('module1', 'D.prototype.x#set', function(wrapped, value) {
		return wrapped.call(this, value + 1);
	});
	t.equal(d.x, 1, 'Wrapped Setter #1');

	d.x = 3;
	t.equal(d.x, 4, 'Set 3 (+1)');


	// Done
	t.end();
});