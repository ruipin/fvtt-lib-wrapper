// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {IS_UNITTEST, MODULE_ID} from '../consts.js';
import {get_current_module_name} from './misc.js';
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
			module ? `Internal error detected, possibly related to module '${module}'.`
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
				possibly ? `Error detected, possibly in module '${module}'.` :
				         `Error detected in module '${module}'.`
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
			`Conflict detected between module '${module}' and '${conflicting_module}'.`,
			`Failed to wrap '${target}' for module '${module}' with type OVERRIDE. The module '${conflicting_module}' has already registered an OVERRIDE wrapper for the same method.`,
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
			`Error detected in module '${module}'.`:
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



// Listen for unhandled exceptions
if(!IS_UNITTEST) {
	const onUnhandledError = function(e) {
		if(!(e instanceof LibWrapperError))
			return false;

		try {
			if(e.ui_msg && e.notification_fn)
				LibWrapperNotifications.ui(`${e.ui_msg} (See JS console)`, e.notification_fn);

			if(e.onUnhandled)
				e.onUnhandled.apply(e);
		}
		catch (e) {
			console.warn('libWrapper: Exception thrown while processing unhandled libWrapper Exception.', e);
		}

		return false;
	}

	globalThis.addEventListener('error', onUnhandledError);
	globalThis.addEventListener('unhandledrejection', onUnhandledError);
}