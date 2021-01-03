// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import test from 'tape';
import './utilities.js';
import '../src/lib/lib-wrapper.js';

function setup() {
	libWrapper._unwrap_all();

	game.clear_modules();
	global.A = undefined;
}


test('Library: Main', function (t) {
	setup();

	class A {
		x(in_value) {
			return in_value;
		}
	}
	globalThis.A = A;
	let a = new A();
	t.equal(a.x(1), 1, 'Original');

	// Register NORMAL
	game.add_module('module1');
	let module1_check = 1;
	libWrapper.register('module1', 'A.prototype.x', function(wrapped, ...args) {
		t.equal(wrapped.apply(this, args), module1_check, 'Module 1');
		return 1000;
	});
	t.equal(a.x(1), 1000, 'Wrapped #1');

	// Registering the same method twice with the same module should fail
	t.throws(function() {
		libWrapper.register('module1', 'A.prototype.x', () => {});
	}, null, 'Registering twice with same module should fail');

	// Register WRAPPER
	game.add_module('module2');
	let module2_check = 1000;
	libWrapper.register('module2', 'A.prototype.x', function(wrapped, ...args) {
		t.equal(wrapped.apply(this, args), module2_check, 'Module 1');
		return 20000;
	}, 'WRAPPER');
	t.equal(a.x(1), 20000, 'Wrapped #2');

	// Register OVERRIDE
	game.add_module('module3');
	let module3_check = 1;
	libWrapper.register('module3', 'A.prototype.x', function() {
		t.equal(arguments.length, 1, 'Module 3 arguments');
		t.equal(arguments[0], module3_check, 'Module 3 argument 0');
		return 30000;
	}, 'OVERRIDE');

	module1_check = 30000;
	t.equal(a.x(1), 20000, 'Wrapped #3');

	// Registing another OVERRIDE should fail
	game.add_module('double-override');
	t.throws(function() {
		libWrapper.register('double-override', 'A.prototype.x', () => {}, 'OVERRIDE');
	}, libWrapper.AlreadyOverriddenError, 'Registering second override should fail');

	// Try removing module2
	libWrapper.unregister('module2', 'A.prototype.x');
	module1_check = 30000;
	module2_check = -1;
	t.equal(a.x(1), 1000, 'Wrapped #3');

	// Add a WRAPPER that does not chain
	libWrapper.register('module2', 'A.prototype.x', function(wrapped, ...args) {
		return -2;
	}, 'WRAPPER');
	t.equal(a.x(1), 1000, 'WRAPPER priority without chaining');

	// Add a NORMAL that does not chain
	libWrapper.register('module2', 'A.prototype.x', function(wrapped, ...args) {
		return 20000;
	});
	t.equal(a.x(1), 20000, 'NORMAL priority without chaining');

	// Try clearing 'A.prototype.x'
	let pre_clear = A.prototype.x;
	libWrapper._clear('A.prototype.x');
	t.equal(a.x(1), 1, 'Unwrapped');
	t.equal(pre_clear.call(a, 1), 1, 'Unwrapped, pre-clear');

	// Try to wrap again
	let rewrap_check = 1;
	libWrapper.register('module2', 'A.prototype.x', function(wrapped, ...args) {
		t.equal(wrapped.apply(this, args), rewrap_check, 'Wrapper: Rewrap after clear');
		return 500;
	});
	t.equal(a.x(1), 500, 'Rewrap after clear');

	// Test manual wrapping
	A.prototype.x = (function() {
		const original = A.prototype.x;

		return function () {
			original.apply(this, arguments);
			return 5000;
		};
	})();
	rewrap_check = 5000;
	t.equal(a.x(1), 500, 'Rewrap after clear');

	// Done
	t.end();
});



test('Library: Special', function (t) {
	setup();

	class A {
		get xvalue() {
			return 1;
		}

		x() {
			return this.xvalue;
		}
	}
	globalThis.A = A;
	let a = new A();
	t.equal(a.x(), 1, 'Original');


	// Call wrapper twice
	game.add_module('module1');
	libWrapper.register('module1', 'A.prototype.x', function(wrapped, ...args) {
		t.equal(wrapped.apply(this, ...args), 1, 'Wrapper that calls twice #1');
		t.equal(wrapped.apply(this, ...args), 1, 'Wrapper that calls twice #2');
		return 10000;
	}, 'WRAPPER');
	t.equal(a.x(), 10000, 'Wrapped #1');

	// Unregister
	libWrapper.unregister('module1', 'A.prototype.x');
	t.equal(a.x(), 1, 'Unregistered');

	// Clear inside wrapper (before call)
	libWrapper.register('module1', 'A.prototype.x', function(wrapped, ...args) {
		libWrapper.clear_module('module1');
		t.throws(() => { wrapped.apply(this, ...args) }, libWrapper.InvalidWrapperChainError, 'Clear inside wrapper (before call)');
		return 20000;
	}, 'WRAPPER');
	t.equal(a.x(), 20000, 'Wrapped #2');

	// Clear inside wrapper (after call)
	libWrapper.register('module1', 'A.prototype.x', function(wrapped, ...args) {
		t.equal(wrapped.apply(this, ...args), 1, 'Clear inside wrapper (after call)');
		libWrapper.clear_module('module1');
		return 30000;
	}, 'WRAPPER');
	t.equal(a.x(), 30000, 'Wrapped #2');

	// Call from outside wrapper
	let stored_wrapped = undefined;
	libWrapper.register('module1', 'A.prototype.x', function(wrapped, ...args) {
		stored_wrapped = wrapped;
		return 40000;
	});
	t.equal(a.x(), 40000, 'Wrapped #3');
	t.throws(() => { stored_wrapped.apply(a) }, libWrapper.InvalidWrapperChainError, 'Call from outside wrapper');

	// Done
	t.end();
});



test('Library: Setter', function (t) {
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
	globalThis.A = A;
	let a = new A();
	t.equal(a.x, 1, 'Original');


	// Register NORMAL
	game.add_module('module1');
	let module1_check = 1;
	libWrapper.register('module1', 'A.prototype.x', function(wrapped, ...args) {
		t.equal(wrapped.apply(this, args), module1_check, 'Module 1');
		return 1000;
	});
	t.equal(a.x, 1000, 'Wrapped #1');

	a.x = 2;
	module1_check = 2;
	t.equal(a.x, 1000, 'Set 2');

	// Register NORMAL wrapper for setter
	libWrapper.register('module1', 'A.prototype.x#set', function(wrapped, value) {
		return wrapped.call(this, value + 1);
	});
	t.equal(a.x, 1000, 'Wrapped Setter #1');

	a.x = 3;
	module1_check = 4;
	t.equal(a.x, 1000, 'Set 3 (+1)');


	// Unregister getter wrapper
	libWrapper.unregister('module1', 'A.prototype.x');
	t.equal(a.x, 4, 'Unregistered getter wrapper');
	a.x = 5;
	t.equal(a.x, 6, 'Set 5 (+1)');

	// Unregister setter wrapper
	libWrapper.unregister('module1', 'A.prototype.x#set');
	t.equal(a.x, 6, 'Unregistered setter wrapper');
	a.x = 7;
	t.equal(a.x, 7, 'Set 7');

	// Done
	t.end();
});