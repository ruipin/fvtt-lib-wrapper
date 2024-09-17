// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import { PACKAGE_TITLE } from '../consts.js';
import { decorate_class_function_names, hash_string } from '../utils/misc.js';
import { i18n } from '../shared/i18n.js';
import { getNotifyIssues } from '../utils/settings.js';
import { Log, verbosity_to_mapped_value } from '../shared/log.js';


//*********************
// Constants
const VERBOSITY_LISTENER_FN_MAP = {
	[Log.INFO    .value]: 'info' ,
	[Log.WARNING .value]: 'warn' ,
	[Log.ERROR   .value]: 'error'
};


//*********************
// User notifications helper class
export class LibWrapperNotifications {
	/*
	 * Attributes
	 */
	static get ui_notifications_enabled() {
		// Make sure we don't accidentally throw a second time, while handling what might be another exception
		try {
			if(!getNotifyIssues())
				return false;
		}
		catch(e) {
			// We swallow the new error, and assume we want to display errors
			Log.error("Could not decide whether to show notifications or not. Defaulting to 'yes'.\n", e);
			return true;
		}

		return true;
	}


	/*
	 * Methods
	 */
	static init() {
		this.NOTIFICATION_SET = new Set();

		// Seal to prevent accidental modification
		Object.seal(this);
	}

	// UI Notification
	static _ui(msg, verbosity=Log.ERROR, add_title=true) {
		if(!this.ui_notifications_enabled)
			return;

		// Ensure that ui.notifications exists as if an error occurs too early it might not be defined yet
		const ui_notifications = globalThis?.ui?.notifications;
		if(!ui_notifications)
			return;

		// Calculate hash of message
		const hash = hash_string(msg);

		// Check if we've already notified the user of this
		if(this.NOTIFICATION_SET.has(hash))
			return;

		// Notify
		this.NOTIFICATION_SET.add(hash);
		const fn = verbosity_to_mapped_value(verbosity, VERBOSITY_LISTENER_FN_MAP, 'error');
		ui_notifications[fn].call(ui_notifications, add_title ? `${PACKAGE_TITLE}: ${msg}` : msg, {permanent: fn == 'error'});
	}

	static ui(...args) {
		// Wait until 'ready' in case we want to trigger a notification early during load
		if(!globalThis.game?.ready)
			Hooks.once('ready', this._ui.bind(this, ...args));
		else
			this._ui(...args);
	}


	// Console + UI notifications
	static console_ui(ui_msg, console_msg, verbosity=Log.ERROR, ...args) {
		const log = Log.fn(verbosity);
		if(log) {
			log(`${ui_msg}\n${console_msg}`, ...args);
			ui_msg += ` ${i18n.localize('lib-wrapper.error.see-js-console')}`;
		}

		this.ui(ui_msg, verbosity);
	}


	// Conflict report
	static conflict(package_info, other_info, potential, console_msg) {
		let other;
		if(Array.isArray(other_info)) {
			other = (other_info.length > 1) ?
				`[${other_info.map((x) => x.type_plus_title_i18n).join(', ')}]` :
				other_info[0].type_plus_title_i18n
			;
		}
		else {
			other = other_info.type_plus_title_i18n;
		}

		const format_obj = {
			main: package_info.type_plus_title_i18n,
			other: other
		};

		this.console_ui(
			potential ? i18n.format('lib-wrapper.error.conflict.potential', format_obj) :
			            i18n.format('lib-wrapper.error.conflict.confirmed', format_obj) ,
			console_msg,
			potential ? Log.WARNING : Log.ERROR
		);
	}
}
decorate_class_function_names(LibWrapperNotifications);