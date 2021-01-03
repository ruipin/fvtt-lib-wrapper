// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {MODULE_ID} from '../consts.js';


// Already overridden Error type
export class AlreadyOverriddenError extends Error {
	constructor(module, target, conflicting_module, ...args) {
		super(`libWrapper: Failed to wrap '${target}' for module '${module}' with type OVERRIDE. The module '${conflicting_module}' has already registered an OVERRIDE wrapper for the same method.`, ...args);

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace)
			Error.captureStackTrace(this, AlreadyOverriddenError)

		this.name = 'AlreadyOverriddenError';

		// Custom debugging information
		this.module = module;
		this.target = target;
		this.conflicting_module = conflicting_module;
	}

	/**
	 * Returns the title of the module that caused the wrapping conflict
	 */
	get conflicting_module_title() {
		return game.modules.get(this.conflicting_module)?.data?.title;
	}
}

// Already overridden Error type
export class InvalidWrapperChainError extends Error {
	constructor(wrapper, msg, ...args) {
		super(`libWrapper: ${msg}`, ...args);

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace)
			Error.captureStackTrace(this, InvalidWrapperChainError)

		this.name = 'InvalidWrapperChainError';
		this._wrapper = wrapper;
	}

	get wrapper_name() {
		return this._wrapper?.name;
	}
}


// Find currently executing module name (that is not libWrapper)
export function get_current_module_name() {
	const stack_trace = Error().stack;
	if(!stack_trace)
		return null;

	const full_matches = stack_trace.matchAll(/(?<=\/)modules\/.+(?=\/)/ig);
	if(!full_matches)
		return null;

	for(const full_match of full_matches) {
		const matches = full_match[0]?.split('/');
		if(!matches)
			continue;

		for(const match of matches) {
			if(!match || match == MODULE_ID || !game.modules.has(match))
				continue;

			return match;
		}
	}

	return null;
}


// HACK: The browser doesn't expose all global variables (e.g. 'Game') inside globalThis, but it does to an eval
// We declare this helper here so that the eval does not have access to the anonymous function scope
const __eval_copy = eval;
export function get_global_variable(varname) {
	// Basic check to make sure we don't do anything too crazy by accident
	if(varname == 'varname' || !/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(varname))
		throw `libWrapper: Invalid identifier ${varname}`;

	return globalThis[varname] ?? __eval_copy(varname);
}


// Shared list of active wrappers
export const WRAPPERS = new Set();



// Notify GM
let GM_NOTIFICATION_SET = null;
export function notify_gm(msg, fn='error') {
	if(!game.settings.get(MODULE_ID, 'notify-issues'))
		return;

	if(!game.user.isGM)
		return;

	if(!GM_NOTIFICATION_SET)
		GM_NOTIFICATION_SET = new Set();
	else if(GM_NOTIFICATION_SET.has(msg))
		return;

	GM_NOTIFICATION_SET.add(msg);
	ui.notifications[fn](`libWrapper: ${msg}`);
}