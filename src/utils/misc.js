// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {IS_UNITTEST, MODULE_ID} from '../consts.js';


// Find currently executing module name (that is not libWrapper)
export function get_current_module_name() {
	const stack_trace = Error().stack;
	if(!stack_trace)
		return null;

	const matches = stack_trace.matchAll(/(?<=\/modules\/).+?(?=\/)/ig);
	if(!matches)
		return null;

	for(let match of matches) {
		match = match[0];

		if(!match || match == MODULE_ID || !(game?.modules?.has(match) ?? true))
			continue;

		return match;
	}

	return null;
}


// HACK: The browser doesn't expose all global variables (e.g. 'Game') inside globalThis, but it does to an eval
// We declare this helper here so that the eval does not have access to the anonymous function scope
const __eval_copy = eval;
export function get_global_variable(varname) {
	try {
		return globalThis[varname] ?? __eval_copy(varname);
	}
	catch (e) {
		return undefined;
	}
}


// Change the name of a function object
// Note: This is extremely hacky, and only works in some browsers, and only sometimes (usually when a function is anonymous)
export function set_function_name(fn, name) {
	try {
		Object.defineProperty(fn, 'name', {
			value: name,
			writable: false,
			enumerable: false,
			configurable: true
		});
	}
	catch (e) {
		// disregard unless this is a unit test - probably unsupported by browser
		if(IS_UNITTEST)
			throw e;
	}
}


// Shared list of active wrappers
export const WRAPPERS = new Set();