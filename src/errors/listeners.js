// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {IS_UNITTEST, DEBUG} from '../consts.js';
import {global_eval} from '../utils/misc.js';
import {LibWrapperError} from './base_errors.js';
import {LibWrapperNotifications} from '../ui/notifications.js';


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