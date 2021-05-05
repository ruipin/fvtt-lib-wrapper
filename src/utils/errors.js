// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {IS_UNITTEST, DEBUG} from '../consts.js';
import {get_current_module_name, global_eval} from './misc.js';
import {LibWrapperNotifications} from '../ui/notifications.js';


// Custom libWrapper Error
export class LibWrapperError extends Error {
	constructor(ui_msg, console_msg, notification_fn, ...args) {
		super(`${ui_msg}\n${console_msg}`, ...args);

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace)
			Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;

		// Store arguments
		this.ui_msg = ui_msg;
		this.console_msg = console_msg;
		this.notification_fn = notification_fn ?? 'error';
	}

	/**
	 * Called if this error is unhandled
	 */
	onUnhandled() {
	}
}
Object.freeze(LibWrapperError);

// Internal error
export class LibWrapperInternalError extends LibWrapperError {
	constructor(console_msg, ...args) {
		const module = get_current_module_name();

		super(
			module ? `Internal error detected, possibly related to '${module}'.`
			       : 'Internal error detected.'
			,
			console_msg,
			'error',
			...args
		);

		// Custom debugging information
		this.module = module;
	}
}
Object.freeze(LibWrapperInternalError);

// Error caused by a module
export class LibWrapperModuleError extends LibWrapperError {
	constructor(console_msg, module, ...args) {
		let possibly = false;

		if(!module) {
			module = module ?? get_current_module_name();
			possibly = true;
		}

		super(
			(module ? (
				possibly ? `Error detected, possibly in '${module}'.` :
				           `Error detected in '${module}'.`
				) :
				'Error detected in unknown module.'
			),
			console_msg,
			'error',
			...args
		);

		// Custom debugging information
		this.module = module;
	}
}
Object.freeze(LibWrapperModuleError);

// Already Overridden Error
export class LibWrapperAlreadyOverriddenError extends LibWrapperError {
	constructor(module, conflicting_module, target, ...args) {
		super(
			`Conflict detected between '${module}' and '${conflicting_module}'.`,
			`Failed to wrap '${target}' for '${module}' with type OVERRIDE. An OVERRIDE wrapper for the same method has already been registered by '${conflicting_module}'.`,
			'error',
			...args
		);

		// Custom debugging information
		this.module = module;
		this.conflicting_module = conflicting_module;
		this.target = target;
	}

	/**
	 * Returns the title of the module that caused the wrapping conflict
	 */
	get conflicting_module_title() {
		return game.modules.get(this.conflicting_module)?.data?.title;
	}

	/**
	 * Called if this error is unhandled
	 */
	onUnhandled() {
		super.onUnhandled();

		LibWrapperStats.register_conflict(this.module, this.conflicting_module, this.target);
	}
}
Object.freeze(LibWrapperAlreadyOverriddenError);

// Invalid Wrapper Chain Error
export class LibWrapperInvalidWrapperChainError extends LibWrapperError {
	constructor(wrapper, module, console_msg, ...args) {
		let user_msg = (module) ?
			`Error detected in '${module}'.`:
			`Error detected in wrapper '${wrapper.name}'.`
		;

		super(
			user_msg,
			console_msg,
			'error',
			...args
		);

		// Custom debugging information
		this._wrapper = wrapper;
		this.module = module;
	}

	get wrapper_name() {
		return this._wrapper.name;
	}
}
Object.freeze(LibWrapperInvalidWrapperChainError);



// Error listeners for unhandled exceptions
export const onUnhandledError = function(e) {
	// We first check whether this exception is an instance of LibWrapperError.
	// If not, we will check if it was caused by one. Otherwise, we do nothing.
	while(!(e instanceof LibWrapperError)) {
		if(e.reason === undefined)
			return;

		e = e.reason;
	}

	// This is a LibWrapperError exception, and we need to handle it
	try {
		// Notify user of the issue
		if(e.ui_msg && e.notification_fn)
			LibWrapperNotifications.ui(`${e.ui_msg} (See JS console)`, e.notification_fn);

		// Trigger 'onUnhandled'
		if(e.onUnhandled)
			e.onUnhandled.apply(e);
	}
	catch (e) {
		console.warn('libWrapper: Exception thrown while processing unhandled libWrapper Exception.', e);
	}
}

export const init_error_listeners = function() {
	// Do nothing inside unit tests
	if(IS_UNITTEST)
		return;

	// Javascript native unhandled exception listeners
	globalThis.addEventListener('error', onUnhandledError);
	globalThis.addEventListener('unhandledrejection', onUnhandledError);

	// Wrap Hooks._call to intercept unhandled exceptions during hooks
	// We don't use libWrapper itself here as we can guarantee we come first (well, before any libWrapper wrapper) and we want to avoid polluting the callstack of every single hook.
	// Otherwise users might think libWrapper is causing failures, when they're actually the fault of another module.
	// We try to patch the existing method. If anything fails, we just alert the user and skip this section.
	try {
		// Patch original method
		const orig = '() => function ' + Hooks._call.toString();
		const patched = orig.replace(/^( *).*catch\((.*)\)\s*{/img, '$&\n$1  globalThis.libWrapper.onUnhandledError($2);');
		if(orig === patched)
			throw `Could not patch 'Hooks._call' method:\n${orig}`;
		if(DEBUG)
			console.log(`Patched Hooks._call: ${patched}`);

		const patched_fn = global_eval(patched)?.();
		if(typeof patched_fn !== 'function')
			throw `Evaluation of patched 'Hooks._call' method did not return a function:\nPatched Method: ${patched}\nReturned: ${patched_fn}`;

		Hooks._call = patched_fn;
	}
	catch(e) {
		// Handle a possible error gracefully
		LibWrapperNotifications.console_ui(
			"A non-critical error occurred while initializing libWrapper.",
			"Could not setup 'Hooks._call' wrapper.\n",
			'warn',
			e
		);
	}
}