// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {MODULE_ID} from '../consts.js';


// Notify user
export class LibWrapperNotifications {
	static init() {
	}

	static get ui_enabled() {
		try {
			if(game?.user?.isGM) {
				if(!game?.settings?.get(MODULE_ID, 'notify-issues-gm'))
					return false;
			}
			else {
				if(!game?.settings?.get(MODULE_ID, 'notify-issues-player'))
					return false;
			}
		}
		catch(e) {
			return false;
		}

		return true;
	}

	static ui(msg, fn='error') {
		if(!this.ui_enabled)
			return;


		// Check if we've already notified the user of this
		if(!this.NOTIFICATION_SET)
			this.NOTIFICATION_SET = new Set();
		else if(this.NOTIFICATION_SET.has(msg))
			return;

		this.NOTIFICATION_SET.add(msg);

		// Notify
		ui.notifications[fn](`libWrapper: ${msg}`, {permanent: fn == 'error'});
	}


	static console_ui(ui_msg, console_msg, fn='error') {
		this.ui(`${ui_msg} (See JS console)`, fn);
		console[fn](`libWrapper: ${ui_msg}\n${console_msg}`);
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
			potential ? `Potential conflict detected between ${module} and ${other}.` : `Conflict detected between module ${module} and ${other}.`,
			console_msg,
			potential ? 'warn' : 'error'
		);
	}
}