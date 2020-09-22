// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';


import test from 'tape';
import './utilities.js';
import {libWrapper as libWrapperShim} from '../shim/shim.js';
import '../src/main/lib-wrapper.js';

function setup() {
	game.clear_modules();
}


test('Shim: Basic functionality', async function (t) {
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


	t.end();
});