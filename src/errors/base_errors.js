// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import { PACKAGE_ID, PACKAGE_TITLE } from '../consts.js';
import { ERRORS } from './errors.js';
import { PackageInfo } from '../shared/package_info.js';
import { inject_packages_into_error } from './error-utils.js';
import { i18n } from '../shared/i18n.js';
import { game_release_display } from '../shared/polyfill.js';
import { Log } from '../shared/log.js';


// Custom libWrapper Error
export class LibWrapperError extends Error {
	get notification_verbosity() { return Log.ERROR };

	constructor(ui_msg, console_msg, ...args) {
		// Create actual error object
		super(console_msg, ...args);

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace)
			Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;

		// Store arguments
		this.ui_msg = ui_msg;
		this.console_msg = console_msg;

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
ERRORS.base = LibWrapperError;



// Internal error
export class LibWrapperInternalError extends LibWrapperError {
	static construct_message(technical_msg, package_info) {
		const key_prefix = 'lib-wrapper.error';
		const type_prefix = `${key_prefix}.internal`;

		// User message
		const user_msg = (!package_info.known ?
			i18n.localize(`${type_prefix}.message`) :
			i18n.format(`${type.prefix}.message-with-package`, {type: package_info.type_i18n, title: package_info.title})
		);

		// Console message
		const info_msg = i18n.format(`${type_prefix}.info`, {url: 'https://github.com/ruipin/fvtt-lib-wrapper'});
		const report_msg = i18n.format(`${type_prefix}.report`, {url: 'https://github.com/ruipin/fvtt-lib-wrapper/issues'});
		const tech_details = i18n.localize(`${key_prefix}.tech-details`);

		const related_pkg_msg = (!package_info.known ? '' : `Related Package ID= ${package_info.logId}\n`);

		// Done
		return [
			`${PACKAGE_TITLE}: ${user_msg}`,
			`${user_msg}\n\n${info_msg}\n${report_msg}\n\n${tech_details}\nInternal libWrapper error.\n${related_pkg_msg}Error= ${technical_msg}\n`
		];
	}

	constructor(technical_msg, ...args) {
		const package_info = new PackageInfo();
		const [ui_msg, console_msg] = LibWrapperInternalError.construct_message(technical_msg, package_info);

		super(
			ui_msg,
			console_msg,
			...args
		);

		// Custom debugging information
		this.package_info = package_info;
	}

	/**
	 * Returns the package ID
	 */
	get package_id() { return this.package_info?.id; }
}
Object.freeze(LibWrapperInternalError);
ERRORS.internal = LibWrapperInternalError;



// Error caused by a package
export class LibWrapperPackageError extends LibWrapperError {
	static get_community_support_message() {
		const support_list = [];

		const key = `${PACKAGE_ID}.support-channels`;
		const list = i18n.localize(key);
		if(Array.isArray(list)) {
			for(const entry of list) {
				if(!('title' in entry) || !('url' in entry))
					continue;

				support_list.push(`- ${entry.title}: ${entry.url}`);
			}
		}

		return support_list.length > 0 ? support_list.join('\n') : null;
	}

	static construct_message(technical_msg, package_info) {
		const key_prefix = 'lib-wrapper.error';
		const type_prefix = `${key_prefix}.external`;

		const pkg_title = package_info.title;
		const pkg_type_i18n = package_info.type_i18n;

		// UI Message
		let ui_msg = i18n.format(`${type_prefix}.notification`, {title: pkg_title, type: pkg_type_i18n});
		let console_ui_msg = i18n.format(`${type_prefix}.message`, {title: pkg_title, type: pkg_type_i18n});

		if(!package_info.compatible_with_core) {
			const display_version = game_release_display(/*return_null=*/true);
			if(display_version) {
				const notupd_msg = ` ${i18n.format(`${type_prefix}.likely-not-updated`, {type: pkg_type_i18n, version: display_version})}`;

				ui_msg += notupd_msg;
				console_ui_msg += notupd_msg;
			}
		}

		// Console Message
		let console_msg = `${console_ui_msg}\n\n${i18n.localize(`${key_prefix}.not-lw`)}\n\n`;

		const info_url = package_info.url;
		if(typeof info_url === 'string') {
			console_msg += i18n.format(`${type_prefix}.info`, {type: pkg_type_i18n, url: info_url});
		}

		const report_url = package_info.bugs;
		if(typeof report_url === 'string') {
			console_msg += '\n';
			console_msg += i18n.format(`${type_prefix}.report`, {url: report_url});
		}
		else {
			const community_support_msg = this.get_community_support_message();
			if(community_support_msg) {
				console_msg += '\n\n';
				console_msg += i18n.localize(`${key_prefix}.community-support`);
				console_msg += '\n';
				console_msg += community_support_msg;
			}
		}
		console_msg += "\n\n";

		console_msg += i18n.localize(`${key_prefix}.tech-details`);
		console_msg += `\nDetected by libWrapper.\nPackage ID= ${package_info.logId}\nError= ${technical_msg}\n`


		// Done
		return [
			ui_msg,
			console_msg
		];
	}

	constructor(technical_msg, package_info, ...args) {
		if(!package_info)
			package_info = new PackageInfo();
		else if(package_info?.constructor !== PackageInfo)
			package_info = new PackageInfo(package_info);

		const [ui_msg, console_msg] = LibWrapperPackageError.construct_message(technical_msg, package_info);

		super(
			ui_msg,
			console_msg,
			...args
		);

		// Custom debugging information
		this.package_info = package_info;
	}

	/**
	 * Returns the package ID
	 */
	get package_id() { return this.package_info?.id; }
}
Object.freeze(LibWrapperPackageError);
ERRORS.package = LibWrapperPackageError;