// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {IS_UNITTEST, DEBUG} from '../consts.js';
import {global_eval} from './misc.js';
import {LibWrapperNotifications} from '../ui/notifications.js';
import {PackageInfo} from './package_info.js';
import {LibWrapperStats} from '../ui/stats.js';



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
		const package_info = new PackageInfo();

		super(
			package_info.known ? `Internal error detected, possibly related to ${package_info.logString}.`
			                   : 'Internal error detected.'
			,
			console_msg,
			'error',
			...args
		);

		// Custom debugging information
		this.package_info = package_info;
	}

	/**
	 * Returns the package ID
	 */
	get package_id() { return this.package_info?.id; }

	/**
	 * Deprecated since v1.6.0.0
	 * Returns the package ID
	 */
	get module() { return this.package_id; }
}
Object.freeze(LibWrapperInternalError);



// Error caused by a package
export class LibWrapperPackageError extends LibWrapperError {
	constructor(console_msg, package_info, ...args) {
		let possibly = false;

		if(!package_info) {
			package_info = new PackageInfo();
			possibly = true;
		}
		else if(package_info?.constructor !== PackageInfo) {
			package_info = new PackageInfo(package_info);
		}

		super(
			possibly ? `Error detected, possibly in ${package_info.logString}.` :
			           `Error detected in ${package_info.logString}.`,
			console_msg,
			'error',
			...args
		);

		// Custom debugging information
		this.package_info = package_info;
	}

	/**
	 * Returns the package ID
	 */
	get package_id() { return this.package_info?.id; }

	/**
	 * Deprecated since v1.6.0.0
	 * Returns the package ID
	 */
	get module() { return this.package_id; }
}
Object.freeze(LibWrapperPackageError);



// Already Overridden Error
export class LibWrapperAlreadyOverriddenError extends LibWrapperError {
	constructor(package_info, conflicting_info, target, ...args) {
		if(package_info?.constructor !== PackageInfo)
			package_info = new PackageInfo(package_info);

		if(conflicting_info?.constructor !== PackageInfo)
			conflicting_info = new PackageInfo(conflicting_info);

		super(
			`Conflict detected between ${package_info.logString} and ${conflicting_info.logString}.`,
			`Failed to wrap '${target}' for ${package_info.logString} with type OVERRIDE. An OVERRIDE wrapper for the same method has already been registered by ${conflicting_info.logString}.`,
			'error',
			...args
		);

		// Custom debugging information
		this.package_info = package_info;
		this.conflicting_info = conflicting_info;
		this.target = target;
	}

	/**
	 * Returns the package ID
	 */
	get package_id() { return this.package_info?.id; }

	/**
	 * Deprecated since v1.6.0.0
	 * Returns the package ID
	 */
	get module() { return this.package_id; }

	/**
	 * Returns the conflicting package ID
	 */
	get conflicting_id() { return this.conflicting_info?.id; }

	/**
	 * Deprecated since v1.6.0.0
	 * Returns the conflicting package ID
	 */
	get conflicting_module() { return this.conflicting_id; }

	/**
	 * Called if this error is unhandled
	 */
	onUnhandled() {
		super.onUnhandled();

		LibWrapperStats.register_conflict(this.package_info, this.conflicting_info, this.target);
	}
}
Object.freeze(LibWrapperAlreadyOverriddenError);



// Invalid Wrapper Chain Error
export class LibWrapperInvalidWrapperChainError extends LibWrapperError {
	constructor(wrapper, package_info, console_msg, ...args) {
		if(package_info?.constructor !== PackageInfo)
			package_info = new PackageInfo(package_info);

		super(
			`Error detected in '${package_info.logString}'.`,
			console_msg,
			'error',
			...args
		);

		// Custom debugging information
		this._wrapper = wrapper;
		this.package_info = package_info;
	}

	/**
	 * Returns the package ID
	 */
	get package_id() { return this.package_info?.id; }

	/**
	 * Deprecated since v1.6.0.0
	 * Returns the package ID
	 */
	get module() {
		return this.package_id;
	}
}
Object.freeze(LibWrapperInvalidWrapperChainError);



// Error listeners for unhandled exceptions
export const onUnhandledError = function(event) {
	// This is a LibWrapperError exception, and we need to handle it
	try {
		// We first check whether the cause of the event is an instance of LibWrapperError. Otherwise, we do nothing.
		const exc = event.reason ?? event.error ?? event;
		if(!exc || !(exc instanceof LibWrapperError))
			return;

		// Notify user of the issue
		if(exc.ui_msg && exc.notification_fn)
			LibWrapperNotifications.ui(`${exc.ui_msg} (See JS console)`, exc.notification_fn);

		// Trigger 'onUnhandled'
		if(exc.onUnhandled)
			exc.onUnhandled.apply(exc);
	}
	catch (e) {
		console.warn('libWrapper: Exception thrown while processing an unhandled exception.', e);
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
	// Otherwise users might think libWrapper is causing failures, when they're actually the fault of another package.
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

	// Wrap Application.prototype._render to intercept unhandled exceptions when rendering Applications
	try {
		libWrapper.register('lib-wrapper', 'Application.prototype._render', function(wrapped, ...args) {
			return wrapped(...args).catch(err => {
				onUnhandledError(err);
				throw err;
			});
		}, 'WRAPPER', {perf_mode: 'FAST'});
	}
	catch(e) {
		// Handle a possible error gracefully
		LibWrapperNotifications.console_ui(
			"A non-critical error occurred while initializing libWrapper.",
			"Could not setup 'Application.prototype._render' wrapper.\n",
			'warn',
			e
		);
	}
}