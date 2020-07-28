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


test('Wrapper: Basic functionality', function (t) {
	setup();

	class A {
		x() {
			return 1;
		}
	}


	let originalValue = 1;
	let a = new A();
	t.equal(a.x(), originalValue, 'Original');


	wrap_front(A.prototype, 'x', function(original) {
		t.equal(original(), originalValue, 'xWrapper 1');
		return 10;
	});
	t.equal(a.x(), 10, "Wrapped with 10");


	wrap_front(A.prototype, 'x', function(original) {
		t.equal(original(), 10, 'xWrapper 2');
		return 20;
	});
	t.equal(a.x(), 20, "Wrapped with 20");


	A.prototype.x = function() { return 2; };
	originalValue = 2;
	t.equal(a.x(), 20, "Replaced with 2");


	wrap_front(A.prototype, 'x', function(original) {
		t.equal(original(), 20, 'xWrapper 3');
		return 30;
	});
	t.equal(a.x(), 30, "Wrapped with 30");


	A.prototype.x = function() { return 3; };
	originalValue = 3;
	t.equal(a.x(), 30, "Replaced with 3");


	// Done
	t.end();
});



test('Wrapper: Parameters', function(t) {
	setup();

	class A {
		y(ret=1) {
			return ret;
		}
	}


	let originalValue = 1;
	let a = new A();
	t.equal(a.y(), originalValue, 'Original');
	t.equal(a.y(100), 100, 'Original(100)');


	wrap_front(A.prototype, 'y', function(original, ret=originalValue) {
		t.equal(original(ret), ret, 'yWrapper 1');
		return 1000;
	});

	t.equal(a.y( ), 1000, "Wrapped (1)");
	t.equal(a.y(3), 1000, "Wrapped (2)");
	t.equal(a.y(5), 1000, "Wrapped (3)");


	// Done
	t.end();
});



test('Wrapper: Prototype redirection', function(t) {
	setup();

	class A {
		z(y) {
			return y;
		}
	}


	let originalValue = 1;
	let a = new A();
	t.equal(a.z(1), originalValue, 'Original');


	// Wrap normally first
	wrap_front(A.prototype, 'z', function(original, ...args) {
		t.equal(original.apply(this, args), originalValue, 'zWrapper 1');
		return 100;
	});
	t.equal(a.z(1), 100, "Wrapped with 100");


	// Wrap in the traditional way, by modifying prototype
	let wrappedValue = 1;
	A.prototype.z = (function() {
		let original = A.prototype.z;

		return function() {
			t.equal(original.apply(this, arguments), wrappedValue, 'Prototype Wrapper 1');
			return 2;
		};
	})();
	originalValue = 2;


	// Confirm it's working properly
	t.equal(a.z(1), 100, "Wrapped with prototype (1)");
	wrappedValue = 2;
	t.equal(a.z(2), 100, "Wrapped with prototype (2)");


	// Done
	t.end();
});



test('Wrapper: Replace on instance', function(t) {
	// Replace on instance
	class A {
		x() {
			return 1;
		}
	}


	let originalValue = 1;
	let a = new A();
	t.equal(a.x(), originalValue, 'Original');


	wrap_front(A.prototype, 'x', function(original) {
		t.equal(original(), originalValue, 'xWrapper 1');
		return 10;
	});
	t.equal(a.x(), 10, "Wrapped with 10");


	// Assign directly to b, not to B.prototype
	a.x = function() { return 20; };
	originalValue = 20;
	t.equal(a.x(), 20, 'Instance assign #1');


	// Calling another instance should return the old value
	let b = new A();
	originalValue = 1;
	t.equal(b.x(), 10, 'Instance assign #2');


	// Done
	t.end();
});