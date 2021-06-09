// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {PACKAGE_ID} from '../consts.js';
import {decorate_class_function_names} from '../utils/misc.js';
import {game_user_isGM} from '../utils/polyfill.js'


// Notify user
export class LibWrapperNotifications {
	static init() {
		this.NOTIFICATION_SET = new Set();

		// Seal to prevent accidental modification
		Object.seal(this);
	}

	static get ui_notifications_enabled() {
		// Make sure we don't accidentally throw a second time, while handling what might be another exception
		try {
			if(game_user_isGM()) {
				if(!game?.settings?.get(PACKAGE_ID, 'notify-issues-gm'))
					return false;
			}
			else {
				if(!game?.settings?.get(PACKAGE_ID, 'notify-issues-player'))
					return false;
			}
		}
		catch(e) {
			// We swallow the new error, and assume we want to display errors
			console.error("libWrapper: Could not decide whether to show notifications or not. Defaulting to 'yes'.\n", e);
			return true;
		}

		return true;
	}

	static _ui(msg, fn) {
		if(!this.ui_notifications_enabled)
			return;

		// Check if we've already notified the user of this
		if(this.NOTIFICATION_SET.has(msg))
			return;

		this.NOTIFICATION_SET.add(msg);

		// Notify - ensure that ui.notifications exists as if an error occurs too early it might not be defined yet
		let notify = globalThis?.ui?.notifications;
		if(notify)
			notify[fn].call(notify, `libWrapper: ${msg}`, {permanent: fn == 'error'});
	}

	static ui(msg, fn='error') {
		// Wait until 'ready' if the error occurs early during load
		if(!globalThis.game?.ready)
			Hooks.once('ready', this._ui.bind(this, msg, fn));
		else
			this._ui(msg, fn);
	}


	static console_ui(ui_msg, console_msg, fn='error', ...vargs) {
		console[fn].call(console, `libWrapper: ${ui_msg}\n${console_msg}`, ...vargs);

		this.ui(`${ui_msg} (See JS console)`, fn);
	}


	static conflict(package_info, other_info, potential, console_msg) {
		let other;
		if(Array.isArray(other_info))
			other = (other_info.length > 1) ? `[${other_info.map((x) => x.id).join(', ')}]` : other_info[0].logString
		else
			other = other_info.logString;

		this.console_ui(
			potential ? `Potential conflict detected between ${package_info.logString} and ${other}.` : `Conflict detected between ${package_info.logString} and ${other}.`,
			console_msg,
			potential ? 'warn' : 'error'
		);
	}
}
decorate_class_function_names(LibWrapperNotifications);