// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {MODULE_ID} from '../consts.js';
import {decorate_class_function_names} from '../utils/misc.js';
import {game_user_isGM} from '../utils/user.js'


// Notify user
export class LibWrapperNotifications {
	static init() {
	}

	static get ui_notifications_enabled() {
		// Make sure we don't accidentally throw a second time, while handling what might be another exception
		try {
			if(game_user_isGM()) {
				if(!game?.settings?.get(MODULE_ID, 'notify-issues-gm'))
					return false;
			}
			else {
				if(!game?.settings?.get(MODULE_ID, 'notify-issues-player'))
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

	static ui(msg, fn='error') {
		if(!this.ui_notifications_enabled)
			return;

		// Check if we've already notified the user of this
		if(!this.NOTIFICATION_SET)
			this.NOTIFICATION_SET = new Set();
		else if(this.NOTIFICATION_SET.has(msg))
			return;

		this.NOTIFICATION_SET.add(msg);

		// Wait until 'ready' if the error occurs early during load
		const do_notify = (is_hook) => {
			// Notify - ensure that ui.notifications exists as if an error occurs too early it might not be defined yet
			let notify = globalThis?.ui?.notifications;
			if(notify)
				notify[fn].call(notify, `libWrapper: ${msg}`, {permanent: fn == 'error'});
			else if(!is_hook && !game.ready) {
				Hooks.once('ready', do_notify, true);
			}
		};
		do_notify(false);
	}


	static console_ui(ui_msg, console_msg, fn='error', ...vargs) {
		console[fn].call(console, `libWrapper: ${ui_msg}\n${console_msg}`, ...vargs);

		this.ui(`${ui_msg} (See JS console)`, fn);
	}


	static conflict(module, other, potential, console_msg) {
		if(!module)
			module = 'an unknown module';
		else if(module.startsWith("\u00AB") && module.endsWith("\u00BB"))
			module = `module ${module}`;
		else
			module = `module '${module}'`;

		if(Array.isArray(other))
			other = (other.length > 1) ? `[${other.join(', ')}]` : `'${other[0]}'`
		else
			other = `'${other}'`;

		this.console_ui(
			potential ? `Potential conflict detected between ${module} and ${other}.` : `Conflict detected between ${module} and ${other}.`,
			console_msg,
			potential ? 'warn' : 'error'
		);
	}
}
decorate_class_function_names(LibWrapperNotifications);