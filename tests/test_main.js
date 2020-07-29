'use strict';

require('./utilities.js');

var test = require('tape');


function setup() {
}


test('Main Test', function (t) {
	setup();

	class A {
		x() {
			return 1;
		}
	}


	let originalValue = 1;
	let a = new A();
	{
		let result = a.x();
		t.ok(result === originalValue, `Original: ${result} === ${originalValue}`);
	}


	let xWrapper = new ResilientWrapper(A.prototype, 'x', function(original) {
		let ret = original();
		t.ok(ret === originalValue, `xWrapper 1: ${ret} === ${originalValue}`);
		return 10;
	});
	t.ok(a.x() === 10, "Wrapped with 10");


	xWrapper.push_front(function(original) {
		let ret = original();
		t.ok(ret === 10, `xWrapper 2: ${ret} === 10`);
		return 20;
	});
	t.ok(a.x() === 20, "Wrapped with 20");


	A.prototype.x = function() { return 2; };
	originalValue = 2;
	t.ok(a.x() === 20, "Replaced with 2");


	let xWrapper2 = new ResilientWrapper(A.prototype, 'x').push_front(function(original) {
		let ret = original();
		t.ok(ret === 20, `xWrapper 3: ${ret} === 20`);
		return 30;
	});
	t.ok(a.x() === 30, "Wrapped with 30");


	A.prototype.x = function() { return 3; };
	originalValue = 3;
	t.ok(a.x() === 30, "Replaced with 3");


	// Done
	t.end();
});


test('Prototype redirection', function(t) {
	setup();

	class A {
		z() {
			return 1;
		}
	}


	let originalValue = 1;
	let a = new A();
	{
		let result = a.z();
		t.ok(result === originalValue, `Original: ${result} === ${originalValue}`);
	}


	// Wrap normally first
	let zWrapper = new ResilientWrapper(A.prototype, 'z', function(original) {
		let result = original();
		t.ok(result === originalValue, `zWrapper 1: ${result} === ${originalValue}`);
		return 100;
	});
	t.ok(a.z() === 100, "Wrapped with 100");


	// Wrap in the traditional way, by modifying prototype
	A.prototype.z = (function() {
		let original = A.prototype.z;
		let storedValue = originalValue;

		return function() {
			let result = original.apply(this, arguments);
			t.ok(result === storedValue, `Prototype Wrapper 1: ${result} === ${storedValue}`);
			return 2;
		};
	})();
	originalValue = 2;


	// Confirm it's working properly
	t.ok(a.z() === 100, "Wrapped with prototype");


	// Done
	t.end();
});


test('Parameters', function(t) {
	setup();

	class A {
		y(ret=1) {
			return ret;
		}
	}


	let originalValue = 1;
	let a = new A();
	{
		let result = a.y();
		t.ok(result === originalValue, `Original: ${result} === ${originalValue}`);

		result = a.y(100);
		t.ok(result === 100, `Original(100): ${result} === 100`);
	}


	let yWrapper = new ResilientWrapper(A.prototype, 'y', function(original, ret=originalValue) {
		let result = original(ret);
		t.ok(result === ret, `yWrapper 1: ${result} === ${ret}`);
		return 1000;
	})

	t.ok(a.y() === 1000, "Wrapped (1)");
	t.ok(a.y(3) === 1000, "Wrapped (2)");
	t.ok(a.y(5) === 1000, "Wrapped (2)");


	// Done
	t.end();
});



test('Replace on instance', function(t) {
	// Replace on instance
	class A {
		x() {
			return 1;
		}
	}


	let originalValue = 1;
	let a = new A();
	{
		let result = a.x();
		t.ok(result === originalValue, `Original: ${result} === ${originalValue}`);
	}


	let xWrapper = new ResilientWrapper(A.prototype, 'x', function(original) {
		let ret = original();
		t.ok(ret === originalValue, `xWrapper 1: ${ret} === ${originalValue}`);
		return 10;
	});
	t.ok(a.x() === 10, "Wrapped with 10");


	// Assign directly to b, not to B.prototype
	a.x = function() { return 20; };
	originalValue = 20;
	t.ok(a.x() === 10, `Instance assign (1)`);


	// Calling another instance should return the old value
	let b = new A();
	originalValue = 1;
	t.ok(b.x() === 10, `Original instance (1)`);


	// Done
	t.end();
});