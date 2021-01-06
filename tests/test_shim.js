// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro


'use strict';

import test from 'tape';
import {CallOrderChecker} from './call_order_checker.js';
import {wrap_front, unwrap_all_from_obj, test_sync_async, async_retval} from './utilities.js';
import {libWrapper as libWrapperShim} from '../shim/shim.js';
import '../src/lib/lib-wrapper.js';


function setup(to_clear=['A']) {
	libWrapper._unwrap_all();

	game.modules.clear();

	for(let prop of to_clear)
		globalThis[prop] = undefined;
}
'use strict';



// Main functionality of the libWrapper Shim
test_sync_async('Shim: Main', async function (t) {
	setup();
	const chkr = new CallOrderChecker(t);


	// Define class
	class A {};
	A.prototype.x = chkr.gen_rt('Orig');
	globalThis.A = A;


	// Check libWrapper fallback status
	t.equal(libWrapperShim.is_fallback, true, 'Check shim is fallback');
	t.equal(libWrapper.is_fallback, false, 'Check real is not fallback');


	// Instantiate
	let a = new A();
	await chkr.call(a, 'x', ['Orig',-1]);


	// Register MIXED (default value)
	game.add_module('m1');
	libWrapperShim.register('m1', 'A.prototype.x', chkr.gen_wr('S:1'));
	await chkr.call(a, 'x', ['S:1','Orig',-2]);

	// Register WRAPPER
	game.add_module('m2');
	libWrapperShim.register('m2', 'A.prototype.x', chkr.gen_wr('S:2'), 'WRAPPER');
	await chkr.call(a, 'x', ['S:2','S:1','Orig',-3]);


	// Register OVERRIDE
	game.add_module('m3');
	libWrapperShim.register('m3', 'A.prototype.x', chkr.gen_wr('S:3', {override: true}), 'OVERRIDE');
	await chkr.call(a, 'x', ['S:3',-1]);

	// Register another WRAPPER
	libWrapperShim.register('m2', 'A.prototype.x', chkr.gen_wr('S:4'), 'WRAPPER');
	await chkr.call(a, 'x', ['S:4','S:3',-2]);


	// Add a WRAPPER that does not chain
	libWrapperShim.register('m2', 'A.prototype.x', chkr.gen_wr('S:5', {nochain: true}), 'WRAPPER');
	await chkr.call(a, 'x', ['S:5',-1]);

	// Add a MIXED that does not chain, this time not relying on the default parameter
	libWrapperShim.register('m2', 'A.prototype.x', chkr.gen_wr('S:6'), 'MIXED');
	await chkr.call(a, 'x', ['S:6','S:5',-2]);


	// Register a real wrapper
	libWrapper.register('m1', 'A.prototype.x', chkr.gen_wr('7'));
	await chkr.call(a, 'x', ['7','S:6','S:5',-3]);

	// Unregister
	libWrapper.unregister('m1', 'A.prototype.x');
	await chkr.call(a, 'x', ['S:6','S:5',-2]);


	// Try Shim now
	libWrapperShim.register('m1', 'A.prototype.x', chkr.gen_wr('S:8'));
	await chkr.call(a, 'x', ['S:8','S:6','S:5',-3]);


	// Test invalid getter
	t.throws(() => libWrapperShim.register('m1', 'A.prototype.xyz', ()=>{}), undefined, "Wrap invalid getter");

	// Test invalid setter
	t.throws(() => libWrapperShim.register('m1', 'A.prototype.x#set', ()=>{}), undefined, "Wrap invalid setter");


	// Done
	t.end();
});



// Main functionality of the libWrapper Shim
test_sync_async('Shim: Inherited Methods', async function (t) {
	setup(['A','B','C','D','E','F']);
	const chkr = new CallOrderChecker(t);


	// Define class
	class A {};
	A.prototype.x = chkr.gen_rt('A:Orig');
	globalThis.A = A;

	class B extends A {};
	globalThis.B = B;

	class C extends A {};
	globalThis.C = C;

	class D extends A {};
	globalThis.D = D;

	class E extends D {};
	E.prototype.x = chkr.gen_rt('E:Orig');
	globalThis.E = E;

	class F extends A {
		// Long-form since we need to be inside the method to be able to use 'super'
		x(...args) {
			return chkr.gen_rt('F:Orig', {next: super.x}).apply(this, args);
		}
	}
	globalThis.F = F;


	// Instantiate A
	let a = new A();
	await chkr.call(a, 'x', ['A:Orig',-1], {title: 'a.Orig'});


	// Instantiate B
	let b = new B();
	await chkr.call(b, 'x', ['A:Orig',-1], {title: 'b.Orig'});


	// Wrap class B
	game.add_module('m1');
	libWrapperShim.register('m1', 'B.prototype.x', chkr.gen_wr('B:1'));
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
	libWrapperShim.register('m1', 'C.prototype.x', chkr.gen_wr('C:1'));
	await chkr.call(c, 'x', ['C:1','A:Orig',-2], {title: 'c.C:1'});


	// Wrapping A's prototype will work
	libWrapperShim.register('m1', 'A.prototype.x', chkr.gen_wr('A:1'));
	await chkr.call(a, 'x', ['A:1','A:Orig',-2], {title: 'a.A:1'});
	// And because of this being the shim, the inherited classes won't see it
	//await chkr.call(b2, 'x', ['B:1','A:1','A:Orig',-3], {title: 'b2.A:1'});
	//await chkr.call(c, 'x', ['C:1','A:1','A:Orig',-3], {title: 'c.A:1'});


	// Instantiate E
	let e = new E();
	await chkr.call(e, 'x', ['E:Orig', -1], {title: 'e.Orig'});


	// Wrapping E's prototype will work
	libWrapperShim.register('m1', 'E.prototype.x', chkr.gen_wr('E:1'));
	await chkr.call(e, 'x', ['E:1','E:Orig',-2], {title: 'e.E:1'});


	// Instantiate F
	// Using the 'super' construct will work, even if the inherited method is wrapped
	let f = new F();
	await chkr.call(f, 'x', ['F:Orig','A:1','A:Orig',-3], {title: 'f.Orig'});


	// Using the 'super' construct will work, even if the method itself is wrapped
	libWrapperShim.register('m1', 'F.prototype.x', chkr.gen_wr('F:1'));
	await chkr.call(f, 'x', ['F:1','F:Orig','A:1','A:Orig',-4], {title: 'f.F:1'});


	// Done
	t.end();
});



// Test Shim wrapping of Getters and Setters
test('Shim: Getter/Setter', function (t) {
	setup();
	const chkr = new CallOrderChecker(t);


	// Define class
	let x_id = 'Orig1';
	class A {
		constructor() {
			this.x_id = 'Orig1';
		}
	};

	Object.defineProperty(
		A.prototype,
		'x',
		{
			get: function(...args) {
				return chkr.gen_rt(this.x_id).apply(this, args);
			},
			set: function(...args) {
				const retval = chkr.gen_rt(`${this.x_id}#set`).apply(this, args);
				this.x_id = args[0];
				return retval;
			},
			configurable: true
		}
	);

	globalThis.A = A;


	// Instantiate
	let a = new A();
	chkr.check(a.x, ['Orig1',-1]);

	a.x = 'Orig2';
	chkr.check('Orig1#set', ['Orig1#set',-1], {param_in: ['Orig2']});

	t.equals(a.x_id, 'Orig2', 'Post-setter #1');
	chkr.check(a.x, ['Orig2',-1]);



	// Register MIXED
	game.add_module('m1');
	libWrapperShim.register('m1', 'A.prototype.x', chkr.gen_wr('m1:Mix:1'));
	chkr.check(a.x, ['m1:Mix:1','Orig2',-2]);


	// Register MIXED wrapper for setter
	libWrapperShim.register('m1', 'A.prototype.x#set', chkr.gen_wr('m1:Mix:1#set'));

	a.x = 'Orig3';
	chkr.check('m1:Mix:1#set', ['m1:Mix:1#set','Orig2#set',-2], {param_in: ['Orig3']});

	t.equals(a.x_id, 'Orig3', 'Post-setter #2');
	chkr.check(a.x, ['m1:Mix:1','Orig3',-2]);


	a.x = 'Orig4';
	chkr.check('m1:Mix:1#set', ['m1:Mix:1#set','Orig3#set',-2], {param_in: ['Orig4']});
	t.equals(a.x_id, 'Orig4', 'Post-setter #3');
	chkr.check(a.x, ['m1:Mix:1','Orig4',-2]);


	// Register second set of wrappers
	game.add_module('m2');
	libWrapperShim.register('m2', 'A.prototype.x', chkr.gen_wr('m2:Mix:2'));
	chkr.check(a.x, ['m2:Mix:2','m1:Mix:1','Orig4',-3]);

	libWrapperShim.register('m2', 'A.prototype.x#set', chkr.gen_wr('m2:Mix:2#set'));

	a.x = 'Orig5';
	chkr.check('m2:Mix:2#set', ['m2:Mix:2#set','m1:Mix:1#set','Orig4#set',-3], {param_in: ['Orig5']});

	t.equals(a.x_id, 'Orig5', 'Post-setter #4');
	chkr.check(a.x, ['m2:Mix:2','m1:Mix:1','Orig5',-3]);


	a.x = 'Orig6';
	chkr.check('m2:Mix:2#set', ['m2:Mix:2#set','m1:Mix:1#set','Orig5#set',-3], {param_in: ['Orig6']});
	t.equals(a.x_id, 'Orig6', 'Post-setter #5');
	chkr.check(a.x, ['m2:Mix:2','m1:Mix:1','Orig6',-3]);


	// Done
	t.end();
});