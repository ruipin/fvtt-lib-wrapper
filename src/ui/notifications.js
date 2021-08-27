// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {PACKAGE_ID} from '../consts.js';
import {decorate_class_function_names} from '../utils/misc.js';
import {game_user_isGM} from '../shared/polyfill.js'
import { i18n } from '../shared/i18n.js';


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

	static _ui(msg, fn, add_title) {
		if(!this.ui_notifications_enabled)
			return;

		// Check if we've already notified the user of this
		if(this.NOTIFICATION_SET.has(msg))
			return;

		this.NOTIFICATION_SET.add(msg);

		// Notify - ensure that ui.notifications exists as if an error occurs too early it might not be defined yet
		let notify = globalThis?.ui?.notifications;
		if(notify)
			notify[fn].call(notify, add_title ? `libWrapper: ${msg}` : msg, {permanent: fn == 'error'});
	}

	static ui(msg, fn='error', add_title=true) {
		// Wait until 'ready' if the error occurs early during load
		if(!globalThis.game?.ready)
			Hooks.once('ready', this._ui.bind(this, msg, fn));
		else
			this._ui(msg, fn, add_title);
	}


	static console_ui(ui_msg, console_msg, fn='error', ...vargs) {
		console[fn].call(console, `libWrapper: ${ui_msg}\n${console_msg}`, ...vargs);

		this.ui(`${ui_msg} ${i18n.localize('lib-wrapper.error.see-js-console')}`, fn);
	}


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
			potential ? 'warn' : 'error'
		);
	}
}
decorate_class_function_names(LibWrapperNotifications);