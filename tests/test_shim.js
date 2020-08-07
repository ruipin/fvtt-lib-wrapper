// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';


import test from 'tape';
import './utilities.js';
import {libWrapper as libWrapperShim} from '../shim/shim.js';
import {} from '../scripts/lib-wrapper.js';

function setup() {
	game.modules.clear();
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

		x() {
			return this.xvalue;
		}
	}

	globalThis.A = A;
	let a = new A();
	t.equal(a.x(), 1, 'Original');

	// Check libWrapper is a shim
	t.equal(libWrapperShim.is_fallback, true, 'Check shim is fallback');
	t.equal(libWrapper.is_fallback, false, 'Check real is not fallback');

	// Use shim to wrap method
	game.add_module('module1');
	let module1_check = 1;
	libWrapperShim.register('module1', 'A.prototype.x', function(wrapped, ...args) {
		t.equal(wrapped.apply(this, args), module1_check, 'Module 1');
		return 1000;
	});
	t.equal(a.x(), 1000, 'Wrapped #1');

	// Wrap xvalue getter
	libWrapperShim.register('module1', 'A.prototype.xvalue', function(wrapped, ...args) {
		return wrapped.call(this)+1;
	});
	module1_check = 2;
	t.equal(a.x(), 1000, 'Wrapped getter #1');

	// Wrap xvalue setter
	libWrapperShim.register('module1', 'A.prototype.xvalue#set', function(wrapped, value) {
		wrapped.call(this, value+1);
	}, 'OVERRIDE');
	a.xvalue = 3;
	module1_check = 5;
	t.equal(a.x(), 1000, 'Wrapped setter #1');
	t.equal(__x, 4, 'Wrapper setter #2');

	// Register a real wrapper
	let module1_check_2 = 1000;
	libWrapper.register('module1', 'A.prototype.x', function(wrapped, ...args) {
		t.equal(wrapped.apply(this, args), module1_check_2, 'Module 1.2');
		return 2000;
	});
	t.equal(a.x(), 2000, 'Wrapped #2');

	// Unregister
	libWrapper.unregister('module1', 'A.prototype.x');


	t.end();
});