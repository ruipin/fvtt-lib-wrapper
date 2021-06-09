// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import test from 'tape';
import {} from './utilities.js';
import '../src/lib/api.js';
import {LibWrapperConflicts} from '../src/ui/conflicts.js';
import {PackageInfo} from '../src/utils/package_info.js';


function setup() {
	libWrapper._UT_unwrap_all();
	libWrapper._UT_clear_ignores();

	game.modules.clear();
	globalThis.A = undefined;
}


class MockWrapper {
	constructor(names) {
		if(!Array.isArray(names))
			names = [names];

		this.names = names;
	}

	get name() {
		return this.names[0];
	}

	get frozen_names() {
		return this.names;
	}
}


function _test_conflict(t, expected, m1, m2, target, is_error) {
	const m1_info = new PackageInfo(m1);
	const m2_info = new PackageInfo(m2);

	const wrapper = new MockWrapper(target);

	const title = `'${m1}' vs '${m2}' @ '${target}'${is_error ? ' (error)' : ''} should be ${expected ? '*not* ' : ''}ignored`;

	const fn = expected ? t.true : t.false;
	fn(LibWrapperConflicts.register_conflict(m1_info, m2_info, wrapper, target, !is_error), title);
}

function test_conflict(t, expected, m1, m2, target) {
	_test_conflict(t, expected, m1, m2, target, false);
	_test_conflict(t, t.conflict_ignore_errors ? expected : true, m1, m2, target, true);
}



// Test the basic functionality of libWrapper
test('Ignoring Conflicts', function (t) {
	setup();

	// Add some modules
	game.add_module('m1');
	game.add_module('m2');
	game.add_module('m3');
	game.add_module('m4');


	for(const conflict_ignore_errors of [false, true]) {
		libWrapper._UT_clear_ignores();

		t.conflict_ignore_errors = conflict_ignore_errors;

		const options = {};
		if(conflict_ignore_errors)
			options.ignore_errors = true;

		// No arrays
		test_conflict(t, true, 'm1', 'm2', 'first.ignore');

		libWrapper.ignore_conflicts('m1', 'm2', 'first.ignore', options);

		test_conflict(t, false, 'm1', 'm2', 'first.ignore');

		test_conflict(t, true, 'm1', 'm3', 'first.ignore');

		test_conflict(t, true, 'm1', 'm2', 'not.ignored');



		// Multiple Package IDs
		test_conflict(t, true, 'm1', 'm2', 'second.ignore');
		test_conflict(t, true, 'm1', 'm3', 'second.ignore');
		test_conflict(t, true, 'm1', 'm4', 'second.ignore');

		libWrapper.ignore_conflicts('m1', ['m2', 'm3', 'm4'], 'second.ignore', options);

		test_conflict(t, false, 'm1', 'm2', 'second.ignore');
		test_conflict(t, false, 'm1', 'm3', 'second.ignore');
		test_conflict(t, false, 'm1', 'm4', 'second.ignore');

		test_conflict(t, true, 'm1', 'm2', 'not.ignored');
		test_conflict(t, true, 'm1', 'm3', 'not.ignored');
		test_conflict(t, true, 'm1', 'm4', 'not.ignored');

		test_conflict(t, true, 'm1', 'm5', 'second.ignore');



		// Multiple targets
		test_conflict(t, true, 'm1', 'm2', 'third.ignore');
		test_conflict(t, true, 'm1', 'm2', 'fourth.ignore');

		libWrapper.ignore_conflicts('m1', 'm2', ['third.ignore', 'fourth.ignore'], options);

		test_conflict(t, false, 'm1', 'm2', 'third.ignore');
		test_conflict(t, false, 'm1', 'm2', 'fourth.ignore');

		test_conflict(t, true, 'm1', 'm3', 'first.ignore');
		test_conflict(t, true, 'm1', 'm3', 'fourth.ignore');

		test_conflict(t, true, 'm1', 'm2', 'not.ignored');



		// Multiple Package IDs *and* multiple targets
		test_conflict(t, true, 'm1', 'm2', 'fifth.ignore');
		test_conflict(t, true, 'm1', 'm3', 'fifth.ignore');
		test_conflict(t, true, 'm1', 'm4', 'fifth.ignore');
		test_conflict(t, true, 'm1', 'm2', 'sixth.ignore');
		test_conflict(t, true, 'm1', 'm3', 'sixth.ignore');
		test_conflict(t, true, 'm1', 'm4', 'sixth.ignore');

		libWrapper.ignore_conflicts('m1', ['m2', 'm3', 'm4'], ['fifth.ignore', 'sixth.ignore'], options);

		test_conflict(t, false, 'm1', 'm2', 'fifth.ignore');
		test_conflict(t, false, 'm1', 'm3', 'fifth.ignore');
		test_conflict(t, false, 'm1', 'm4', 'fifth.ignore');
		test_conflict(t, false, 'm1', 'm2', 'sixth.ignore');
		test_conflict(t, false, 'm1', 'm3', 'sixth.ignore');
		test_conflict(t, false, 'm1', 'm4', 'sixth.ignore');

		test_conflict(t, true, 'm1', 'm2', 'not.ignored');
		test_conflict(t, true, 'm1', 'm3', 'not.ignored');
		test_conflict(t, true, 'm1', 'm4', 'not.ignored');

		test_conflict(t, true, 'm1', 'm5', 'fifth.ignore');
		test_conflict(t, true, 'm1', 'm5', 'sixth.ignore');
	}


	// Done
	t.end();
});