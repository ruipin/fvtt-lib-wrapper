// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import { PACKAGE_ID } from '../consts.js';
import { PackageInfo } from '../shared/package_info.js';
import { inject_packages_into_error } from './error-utils.js';


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

		// Detect packages, inject them into error message
		// Note: We hide 'lib-wrapper' from the list of detected packages, except when this was a libWrapper-internal error
		inject_packages_into_error(this, this instanceof LibWrapperInternalError ? null : PACKAGE_ID);
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

export const InternalError = LibWrapperInternalError;



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