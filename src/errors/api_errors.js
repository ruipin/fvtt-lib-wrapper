// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import { LibWrapperError, LibWrapperPackageError } from './base_errors.js';
import { ERRORS } from './errors.js';
import { PackageInfo } from '../shared/package_info.js';
import { LibWrapperConflicts } from '../ui/conflicts.js';
import { i18n } from '../shared/i18n.js';


// Already Overridden Error
export class LibWrapperAlreadyOverriddenError extends LibWrapperError {
	static construct_message(package_info, conflicting_info, technical_msg) {
		const key_prefix = 'lib-wrapper.error';
		const type_prefix = `${key_prefix}.conflict`;

		const pkg_i18n = package_info.type_plus_title_i18n;
		const pkg_i18n_capitalized = pkg_i18n.charAt(0).toUpperCase() + pkg_i18n.slice(1);
		const confl_i18n = conflicting_info.type_plus_title_i18n;
		const confl_i18n_capitalized = confl_i18n.charAt(0).toUpperCase() + confl_i18n.slice(1);

		const conflict_msg = i18n.format(`${type_prefix}.confirmed`, {main: pkg_i18n, other: confl_i18n});

		// UI Message
		let ui_msg = `libWrapper: ${conflict_msg}`;


		// Console Message
		let console_msg = `${conflict_msg}\n\n${i18n.localize(`${key_prefix}.not-lw`)}\n\n`;

		// Info links
		let info_msg = '';

		const info1_url = package_info.url;
		if(typeof info1_url === 'string')
			info_msg += `\n- ${pkg_i18n_capitalized}: ${info1_url}`;

		const info2_url = conflicting_info.url;
		if(typeof info2_url === 'string')
			info_msg += `\n- ${confl_i18n_capitalized}: ${info2_url}`;

		if(info_msg)
			console_msg += `${i18n.localize(`${type_prefix}.info`)}${info_msg}\n\n`;

		// Report links
		let bugs_msg = '';

		const bugs1_url = package_info.bugs;
		if(typeof bugs1_url === 'string')
			bugs_msg += `\n- ${pkg_i18n_capitalized}: ${bugs1_url}`;

		const bugs2_url = conflicting_info.bugs;
		if(typeof bugs2_url === 'string')
			bugs_msg += `\n- ${confl_i18n_capitalized}: ${bugs2_url}`;

		if(bugs_msg)
			console_msg += `${i18n.localize(`${type_prefix}.report`)}${bugs_msg}\n\n`;

		// Support links
		const community_support_msg = LibWrapperPackageError.get_community_support_message();
		if(community_support_msg) {
			console_msg += i18n.localize(`${key_prefix}.community-support`);
			console_msg += '\n';
			console_msg += community_support_msg;
			console_msg += "\n\n";
		}

		// Tech details
		console_msg += i18n.localize(`${key_prefix}.tech-details`);
		console_msg += `\nDetected by libWrapper.\nPackage IDs= ${package_info.logId}, ${conflicting_info.logId}\nError= ${technical_msg}\n`


		// Done
		return [
			ui_msg,
			console_msg
		];
	}

	constructor(package_info, conflicting_info, wrapper, target, ...args) {
		if(package_info?.constructor !== PackageInfo)
			package_info = new PackageInfo(package_info);

		if(conflicting_info?.constructor !== PackageInfo)
			conflicting_info = new PackageInfo(conflicting_info);

		const [ui_msg, console_msg] = LibWrapperAlreadyOverriddenError.construct_message(package_info, conflicting_info,
			`Failed to wrap '${target}' for ${package_info.type_plus_id} with type OVERRIDE. An OVERRIDE wrapper for the same method has already been registered by ${conflicting_info.type_plus_id}.`
		);

		super(
			ui_msg,
			console_msg,
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
ERRORS.already_overridden = LibWrapperAlreadyOverriddenError;



// Invalid Wrapper Chain Error
export class LibWrapperInvalidWrapperChainError extends LibWrapperPackageError {
	constructor(wrapper, package_info, technical_msg, ...args) {
		if(package_info?.constructor !== PackageInfo)
			package_info = new PackageInfo(package_info);

		super(
			technical_msg,
			package_info,
			...args
		);

		// Custom debugging information
		this._wrapper = wrapper;
	}
}
Object.freeze(LibWrapperInvalidWrapperChainError);
ERRORS.invalid_chain = LibWrapperInvalidWrapperChainError;