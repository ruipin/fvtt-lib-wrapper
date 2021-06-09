// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {LibWrapperError} from './base_errors.js';
import {PackageInfo} from '../package_info.js';
import {LibWrapperConflicts} from '../../ui/conflicts.js';


// Already Overridden Error
export class LibWrapperAlreadyOverriddenError extends LibWrapperError {
	constructor(package_info, conflicting_info, wrapper, target, ...args) {
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
		this._wrapper = wrapper;
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

		LibWrapperConflicts.register_conflict(this.package_info, this.conflicting_info, this._wrapper, this.target, false);
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