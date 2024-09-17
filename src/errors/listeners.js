// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import { IS_UNITTEST } from '../consts.js';
import { global_eval } from '../utils/misc.js';
import { LibWrapperError } from './base_errors.js';
import { is_error_object, inject_packages_into_error } from './error-utils.js';
import { LibWrapperNotifications } from '../ui/notifications.js';
import { i18n } from '../shared/i18n.js';
import { Log } from '../shared/log.js';


/*
 * Make sure browser is allowed to collect full stack traces, for easier debugging of issues
 */
Error.stackTraceLimit = Infinity;


/*
 * Utility Methods
 */
function on_libwrapper_error(error) {
	// Notify user of the issue
	if(error.ui_msg && error.notification_verbosity)
		LibWrapperNotifications.ui(`${error.ui_msg} ${i18n.localize('lib-wrapper.error.see-js-console')}`, error.notification_verbosity, false);

	// Trigger 'onUnhandled'
	if(error.onUnhandled)
		error.onUnhandled.apply(error);
}

function on_any_error(error, prepend_stack=undefined) {
	// Detect packages and inject a list into the error object
	inject_packages_into_error(error, prepend_stack);
}


/*
 * Error Listeners
 */
export const onUnhandledError = function(error, prepend_stack=undefined) {
	try {
		// Sanity check
		if(!is_error_object(error)) {
			Log.debug$?.(`Ignoring unhandled error because it is not an error object:`, error);
			return;
		}

		// If we have an instance of LibWrapperError, we trigger the libWrapper-specific behaviour
		if(error instanceof LibWrapperError)
			on_libwrapper_error(error);

		// Trigger the error handling code for all errors
		on_any_error(error, prepend_stack);
	}
	catch (e) {
		Log.error('Exception thrown while processing an unhandled error.', e);
	}
}

const onUnhandledErrorEvent = function(event) {
	try {
		// The cause of the event is what we're interested in
		const cause = event.reason ?? event.error ?? event;

		// We've got our error object, call onUnhandledError
		return onUnhandledError(cause);
	}
	catch (e) {
		Log.error('Exception thrown while processing an unhandled error event.', e);
	}
}


/*
 * Set up error listeners
 */
function init_pre_v9p2_listeners() {
	// Wrap Hooks._call to intercept unhandled exceptions during hooks
	// We don't use libWrapper itself here as we can guarantee we come first (well, before any libWrapper wrapper) and we want to avoid polluting the callstack of every single hook.
	// Otherwise users might think libWrapper is causing failures, when they're actually the fault of another package.
	// We try to patch the existing method. If anything fails, we just alert the user and skip this section.
	try {
		// Patch original method
		const orig = '() => function ' + Hooks._call.toString();
		const patched = orig.replace(/catch[\s\n]*\((.*)\)[\s\n]*{/img, '$& globalThis.libWrapper.onUnhandledError($1);');
		if(orig === patched)
			throw new Error(`Could not patch 'Hooks._call' method:\n${orig}`);
		Log.debug$?.(`Patched Hooks._call: ${patched}`);

		const patched_fn = global_eval(patched)?.();
		if(typeof patched_fn !== 'function')
			throw new Error(`Evaluation of patched 'Hooks._call' method did not return a function:\nPatched Method: ${patched}\nReturned: ${patched_fn}`);

		Hooks._call = patched_fn;
	}
	catch(e) {
		// Handle a possible error gracefully
		LibWrapperNotifications.console_ui(
			"A non-critical error occurred while initializing libWrapper.",
			"Could not setup 'Hooks._call' wrapper.\n",
			Log.WARNING,
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
			Log.WARNING,
			e
		);
	}
}

function init_hooksOnError_listener() {
	// Wrap Hooks._onError to intercept unhandled exceptions
	// We could use the 'error' hook instead, but then we wouldn't be able to see an exception before it gets logged to the console
	try {
		libWrapper.register('lib-wrapper', 'Hooks.onError', function(...args) {
			// Handle error ourselves first
			const err = args[1];
			const msg = args?.[2]?.msg;
			onUnhandledError(err, msg);
		}, 'LISTENER', {perf_mode: 'FAST'});
	}
	catch(e) {
		// Handle a possible error gracefully
		LibWrapperNotifications.console_ui(
			"A non-critical error occurred while initializing libWrapper.",
			"Could not setup 'Hooks.onError' wrapper.\n",
			Log.WARNING,
			e
		);
	}
}

// Called during libWrapper initialisation
export const init_error_listeners = function() {
	// Do nothing inside unit tests
	if(IS_UNITTEST)
		return;

	// Javascript native unhandled exception listeners
	globalThis.addEventListener('error', onUnhandledErrorEvent);
	globalThis.addEventListener('unhandledrejection', onUnhandledErrorEvent);

	// v9p2 or newer triggers 'Hooks.onError' any time there is an unhandled error
	if(Hooks.onError) {
		init_hooksOnError_listener();
	}
	// v9p1 or older needs individual patching
	else {
		init_pre_v9p2_listeners();
	}
}