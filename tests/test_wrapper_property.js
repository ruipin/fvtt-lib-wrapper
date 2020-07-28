// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';


import test from 'tape';
import {wrap_front} from './utilities.js';
import '../scripts/lib-wrapper.js';

function setup() {
	libWrapper._unwrap_all();

	game.modules.clear();
	global.A = undefined;
}


test('Wrap Property: Basic functionality', function (t) {
	setup();

	class A {
		get x() {
			return 1;
		}
	}


	let originalValue = 1;
	let a = new A();
	t.equal(a.x, originalValue, 'Original');


	wrap_front(A.prototype, 'x', function(original) {
		t.equal(original(), originalValue, 'xWrapper 1');
		return 10;
	});
	t.equal(a.x, 10, "Wrapped with 10");


	wrap_front(A.prototype, 'x', function(original) {
		t.equal(original(), 10, 'xWrapper 2');
		return 20;
	});
	t.equal(a.x, 20, "Wrapped with 20");


	// Done
	t.end();
});


test('Wrap Property: Setter', function (t) {
	setup();

	let __x = 1;
	class A {
		get x() {
			return __x;
		}

		set x(value) {
			__x = value;
		}
	}


	let originalValue = 1;
	let a = new A();
	t.equal(a.x, originalValue, 'Original');


	wrap_front(A.prototype, 'x', function(original) {
		t.equal(original(), originalValue, 'xWrapper 1');
		return 10;
	});
	t.equal(a.x, 10, "Wrapped with 10");


	wrap_front(A.prototype, 'x', function(original) {
		t.equal(original(), 10, 'xWrapper 2');
		return 20;
	});
	t.equal(a.x, 20, "Wrapped with 20");


	a.x = 2;
	originalValue = 2;
	t.equal(a.x, 20, "Replaced with 2");


	wrap_front(A.prototype, 'x', function(original) {
		t.equal(original(), 20, 'xWrapper 3');
		return 30;
	});
	t.equal(a.x, 30, "Wrapped with 30");

	a.x = 3;
	originalValue = 3;
	t.equal(a.x, 30, "Replaced with 3");

	// Wrap setter
	wrap_front(A.prototype, 'x', function(original, value) {
		return original.call(this, value+1);
	}, true);

	a.x = 4;
	originalValue = 5;
	t.equal(a.x, 30, "Replaced with 4 (+1)");


	// Done
	t.end();
});