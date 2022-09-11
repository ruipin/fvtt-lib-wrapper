// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {CallOrderChecker} from './call_order_checker.js';
import {wrap_front, unwrap_all_from_obj, test_combinations, async_retval, sync_async_then} from './utilities.js';
import '../src/lib/api.js';


function setup() {
	libWrapper._UT_unwrap_all();

	game.reset();
	globalThis.A = undefined;
}



// Test the basic functionality of libWrapper
test_combinations('Wrapper: Basic functionality', async function (t) {
	setup();
	const chkr = new CallOrderChecker(t);


	// Define class
	class A {};
	A.prototype.x = chkr.gen_rt('Orig');


	// Instantiate
	let a = new A();
	await chkr.call(a, 'x', ['Orig',-1]);

	// First wrapper
	wrap_front(A.prototype, 'x', chkr.gen_wr('1'));
	await chkr.call(a, 'x', ['1','Orig',-2]);

	// Second wrapper
	wrap_front(A.prototype, 'x', chkr.gen_wr('2'));
	await chkr.call(a, 'x', ['2','1','Orig',-3]);

	// Manual wrapper
	A.prototype.x = chkr.gen_rt('Man3');
	await chkr.call(a, 'x', ['2','1','Man3',-3]);

	// Third wrapper
	wrap_front(A.prototype, 'x', chkr.gen_wr('4'));
	await chkr.call(a, 'x', ['4','2','1','Man3',-4]);

	// Second Manual Wrapper
	A.prototype.x = chkr.gen_rt('Man5');
	await chkr.call(a, 'x', ['4','2','1','Man5',-4]);


	// Wrap in the traditional way, by storing the prototype, and then modifying it
	A.prototype.x = (function() {
		const wrapped = A.prototype.x;
		return chkr.gen_rt('Man6', {next: wrapped});
	})();
	await chkr.call(a, 'x', ['4','2','1','Man6','Man5',-5]);


	// Copy reference to method and call it
	const a_x = a.x;
	chkr.check(await a_x.call(this,1,"TOP",2,3), ['4','2','1','Man6','Man5',-5], {param_in: [1,"TOP",2,3]});

	// Fourth wrapper
	wrap_front(A.prototype, 'x', chkr.gen_wr('7'));
	await chkr.call(a, 'x', ['7','4','2','1','Man6','Man5',-6]);

	// Call previous reference to method again
	chkr.check(await a_x.call(this,1,"TOP",2,3), ['7','4','2','1','Man6','Man5',-6], {param_in: [1,"TOP",2,3]});


	// Done
	t.end();
});



// Test the usual libWrapper syntax, i.e. do not use automations from CallOrderChecker
test_combinations('Wrapper: libWrapper syntax', async function (t) {
	setup();


	// Define class
	class A {
		x(y,z) {
			return t.test_async ? async_retval(y + z) : (y + z);
		}
	}


	// Instantiate

	let a = new A();
	t.equal(await a.x(0,1), 1, 'Original #1');
	t.equal(await a.x(1,1), 2, 'Original #2');


	// Test 'wrapped(...args)'
	let wrapper1_check;
	wrap_front(A.prototype, 'x', async function(wrapped, ...args) {
		t.equal(await wrapped(...args), wrapper1_check, 'xWrapper 1');
		return args[0] - args[1];
	});

	wrapper1_check = 5;
	t.equal(await a.x(3,2), 1, "Wrapper1 #1");

	wrapper1_check = 20;
	t.equal(await a.x(10,10), 0, "Wrapper1 #2");


	// Test 'wrapped.apply(this, args)'
	let wrapper2_check;
	wrap_front(A.prototype, 'x', async function(wrapped, ...args) {
		t.equal(await wrapped.apply(this, args), wrapper2_check, 'xWrapper 2');
		return args[0] * args[1];
	});

	wrapper1_check = 15;
	wrapper2_check = 5;
	t.equal(await a.x(10,5), 50, "Wrapper2 #1");

	wrapper1_check = 6;
	wrapper2_check = -2;
	t.equal(await a.x(2,4), 8, "Wrapper2 #2");


	// Test 'wrapped.call(this, ...args)'
	let wrapper3_check;
	wrap_front(A.prototype, 'x', async function(wrapped, ...args) {
		t.equal(await wrapped.call(this, ...args), wrapper3_check, 'xWrapper 3');
		return Math.floor(args[0] / args[1]);
	});

	wrapper1_check = 6;
	wrapper2_check = 0;
	wrapper3_check = 9;
	t.equal(await a.x(3,3), 1, "Wrapper3 #1");

	wrapper1_check = 15;
	wrapper2_check = 1;
	wrapper3_check = 56;
	t.equal(await a.x(8,7), 1, "Wrapper3 #2");


	// Done
	t.end();
});



// Assign directly to an instance after wrapping the prototype
test_combinations('Wrapper: Instance assignment', async function(t) {
	setup();
	const chkr = new CallOrderChecker(t);


	// Define class
	class A {};
	A.prototype.x = chkr.gen_rt('A:Orig');


	// Instantiate
	let a = new A();
	await chkr.call(a, 'x', ['A:Orig',-1], {title: 'a.Orig'});


	// Create a normal class wrapper
	wrap_front(A.prototype, 'x', chkr.gen_wr('A:1'));
	await chkr.call(a, 'x', ['A:1','A:Orig',-2], {title: 'a.A:1'});


	// Assign directly to a, not to A.prototype
	a.x = chkr.gen_rt('a:1');
	await chkr.call(a, 'x', ['a:1',-1], {title: 'a.a:1'});


	// Calling another instance should not include wrapper 'a1' in the wrapper chain
	let b = new A();
	await chkr.call(b, 'x', ['A:1','A:Orig',-2], {title: 'b.Orig'});


	// Create manual instance wrapper
	b.x = (function() {
		const wrapped = b.x;
		return chkr.gen_rt('Man:b:1', {next: wrapped});
	})();
	await chkr.call(b, 'x', ['Man:b:1','A:1','A:Orig',-3], {title: 'b.Man:b:1'});


	// Done
	t.end();
});



// Test wrapping inherited methods
test_combinations('Wrapper: Inherited Methods', async function(t) {
	setup();
	const chkr = new CallOrderChecker(t);


	// Define class
	class A {};
	A.prototype.x = chkr.gen_rt('A:Orig');

	class B extends A {};

	class C extends A {};

	class D extends A {};

	class E extends D {};
	E.prototype.x = chkr.gen_rt('E:Orig');

	class F extends A {
		// Long-form since we need to be inside the method to be able to use 'super'
		x(...args) {
			return chkr.gen_rt('F:Orig', {next: super.x}).apply(this, args);
		}
	}

	class G extends A {};

	class H extends A {};


	// Instantiate A
	let a = new A();
	await chkr.call(a, 'x', ['A:Orig',-1], {title: 'a.Orig'});


	// Instantiate B
	let b = new B();
	await chkr.call(b, 'x', ['A:Orig',-1], {title: 'b.Orig'});


	// Wrap class B
	wrap_front(B.prototype, 'x', chkr.gen_wr('B:1'));
	await chkr.call(b, 'x', ['B:1','A:Orig',-2], {title: 'b.B:1'});


	// Assign directly to b, not to B.prototype
	b.x = chkr.gen_rt('b:1');
	await chkr.call(b, 'x', ['b:1',-1], {title: 'b.b:1'});


	// Create manual instance wrapper
	b.x = (function() {
		const wrapped = b.x;
		return chkr.gen_rt('Man:b:1', {next: wrapped});
	})();
	await chkr.call(b, 'x', ['Man:b:1','b:1',-2], {title: 'b.Man:b:1'});


	// Using another instance should not call b's instance wrappers
	let b2 = new B();
	await chkr.call(b2, 'x', ['B:1','A:Orig',-2], {title: 'b2.Orig'});


	// Using C will work correctly
	let c = new C();
	await chkr.call(c, 'x', ['A:Orig',-1], {title: 'c.Orig'});


	// Wrapping C's prototype will work
	wrap_front(C.prototype, 'x', chkr.gen_wr('C:1'));
	await chkr.call(c, 'x', ['C:1','A:Orig',-2], {title: 'c.C:1'});


	// Wrapping A's prototype will work
	wrap_front(A.prototype, 'x', chkr.gen_wr('A:1'));
	await chkr.call(a, 'x', ['A:1','A:Orig',-2], {title: 'a.A:1'});
	// And be seen by inherited classes
	await chkr.call(b2, 'x', ['B:1','A:1','A:Orig',-3], {title: 'b2.A:1'});
	await chkr.call(c, 'x', ['C:1','A:1','A:Orig',-3], {title: 'c.A:1'});


	// Instantiate E
	let e = new E();
	await chkr.call(e, 'x', ['E:Orig', -1], {title: 'e.Orig'});


	// Wrapping E's prototype will work
	wrap_front(E.prototype, 'x', chkr.gen_wr('E:1'));
	await chkr.call(e, 'x', ['E:1','E:Orig',-2], {title: 'e.E:1'});


	// Instantiate F
	// Using the 'super' construct will work, even if the inherited method is wrapped
	let f = new F();
	await chkr.call(f, 'x', ['F:Orig','A:1','A:Orig',-3], {title: 'f.Orig'});


	// Using the 'super' construct will work, even if the method itself is wrapped
	wrap_front(F.prototype, 'x', chkr.gen_wr('F:1'));
	await chkr.call(f, 'x', ['F:1','F:Orig','A:1','A:Orig',-4], {title: 'f.F:1'});


	// Instantiate G
	let g = new G();
	await chkr.call(g, 'x', ['A:1','A:Orig',-2], {title: 'g.Orig'});

	// Wrap G manually
	g.x = (function() {
		const wrapped = g.x;
		return chkr.gen_rt('Man:g:1', {next: wrapped});
	})();
	await chkr.call(g, 'x', ['Man:g:1','A:1','A:Orig',-3], {title: 'g.Man:g:1'});

	// Wrap A again
	wrap_front(A.prototype, 'x', chkr.gen_wr('A:2'));
	await chkr.call(a, 'x', ['A:2','A:1','A:Orig',-3], {title: 'a.A:2'});
	// Should be seen by inherited classes
	await chkr.call(b2, 'x', ['B:1','A:2','A:1','A:Orig',-4], {title: 'b2.A:2'});
	await chkr.call(c, 'x', ['C:1','A:2','A:1','A:Orig',-4], {title: 'c.A:2'});


	// Confirm G still sees A's wrappers
	await chkr.call(g, 'x', ['Man:g:1','A:2','A:1','A:Orig',-4], {title: 'g.A:2'});


	// Instantiate H
	let h = new H();
	await chkr.call(h, 'x', ['A:2','A:1','A:Orig',-3], {title: 'h.Orig'});


	// Create full wrapper for H
	wrap_front(H.prototype, 'x', chkr.gen_wr('H:1'));
	await chkr.call(h, 'x', ['H:1','A:2','A:1','A:Orig',-4], {title: 'h.H:1'});


	// Create manual wrapper for H
	// This is to confirm whether we can correctly handle manual wrappers on top of inherited-method wrappers
	H.prototype.x = (function() {
		const wrapped = H.prototype.x;
		return chkr.gen_rt('Man:H:1', {next: wrapped});
	})();
	await chkr.call(h, 'x', ['H:1','Man:H:1','A:2','A:1','A:Orig',-5], {title: 'h.Man:H:1'});



	// Done
	t.end();
});