// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {IS_UNITTEST, MODULE_ID} from '../consts.js';


// Find currently executing module name (that is not libWrapper)
export function get_current_module_name(stack_trace=undefined) {
	if(stack_trace === undefined) {
		const old_stack_limit = Error.stackTraceLimit;
		Error.stackTraceLimit = Infinity;
		stack_trace = Error().stack;
		Error.stackTraceLimit = old_stack_limit;

		if(!stack_trace)
			return null;
	}

	const matches = stack_trace.matchAll(/(?<=\/)(modules|systems)\/(.+?)(?=\/)/ig);
	if(!matches)
		return null;

	for(let match of matches) {
		const type = match[1];
		const name = match[2];

		if(type === 'systems') {
			if(name == game.data.system.id)
				return name;
		}
		else if(type === 'modules') {
			if(!name || name == MODULE_ID || !game?.modules?.has(name))
				continue;

			return name;
		}
		else {
			console.error("invalid type");
			throw new (globalThis.libWrapper?.LibWrapperInternalError ?? Error)(`Invalid type: ${type}`);
		}
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
		// Only supported by Firefox: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/displayName
		fn.displayName = name;

		// Hack: Try and over-ride the 'name' property
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

// Decorate name
export function decorate_name(name, suffix='') {
	if(suffix !== '')
		return `🎁${name}#${suffix}`;
	else
		return `🎁${name}`;
}

// Decorate the name of all functions of a given class
// Note: This is extremely hacky, and only works in some browsers, and only sometimes (usually when a function is anonymous)
export function decorate_class_function_names(klass) {
	const props = Object.getOwnPropertyNames(klass);
	props.push(...Object.getOwnPropertySymbols(klass))

	for(const prop of props) {
		const descriptor = Object.getOwnPropertyDescriptor(klass, prop);

		if(typeof descriptor.value === 'function')
			set_function_name(descriptor.value, decorate_name(prop));
		if(typeof descriptor.get === 'function')
			set_function_name(descriptor.get, decorate_name(prop, 'getter'));
		if(typeof descriptor.set === 'function')
			set_function_name(descriptor.set, decorate_name(prop, 'setter'));
	}

	if(klass.prototype)
		decorate_class_function_names(klass.prototype);
}


// Shared list of active wrappers
export const WRAPPERS = new Set();