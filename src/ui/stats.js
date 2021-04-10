// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {MODULE_ID} from '../consts.js';
import {LibWrapperNotifications} from './notifications.js';

export class LibWrapperStats {
	static _collect_stats() {
		// We do this in a try-catch in case future Foundry versions break this code, it won't completely break libWrapper
		try {
			const userid = game.userId;
			if(!userid)
				return false;

			// Find user
			const user = game.data.users.find((x) => { return x._id == userid });
			if(!user)
				return false;

			// Game masters are allowed to do everything
			if(user.role == 4)
				return true;

			// We need to check if this user has the SETTINGS_MODIFY permission
			const key = 'SETTINGS_MODIFY';
			if ( key in user.permissions ) return user.permissions[key];

			const game_permissions_str = game.data.settings.find((x) => { return x.key == 'core.permissions'});
			if(game_permissions_str?.value) {
				const game_permissions = JSON.parse(game_permissions_str.value);

				const rolePerms = game_permissions[key];
				if(rolePerms && rolePerms.includes(user.role))
					return true;
			}

			// Otherwise, no reason to collect stats
			return false;
		}
		catch(e) {
			console.warn('A non-critical error occurred while initializing libWrapper: Could not read user permissions during initialization.\n', e);
			Hooks.once('ready', () => {
				LibWrapperNotifications.ui("A non-critical error occurred while initializing libWrapper. Check JS console for more details.", 'warn');
			});

			// Default to 'true' on error
			return true;
		}
	}

	static init() {
		this.collect_stats = this._collect_stats();

		// If we got this far, we're going to be collecting statistics, so initialize the containers
		if(!this.collect_stats)
			return;

		this.MODULES   = new Set();
		this.CONFLICTS = new Map();
	}

	static register_module(module) {
		if(!this.collect_stats)
			return;

		if(module == MODULE_ID)
			return;

		this.MODULES.add(module);
	}

	static register_conflict(module, other, target) {
		if(!this.collect_stats)
			return;

		if(Array.isArray(other)) {
			other.forEach((m) => {
				LibWrapperStats.register_conflict(module, m, target);
			});
			return;
		}

		const key = `${module}/${other}`;

		let data = this.CONFLICTS.get(key);
		if(!data) {
			data = {
				count: 0,
				module: module,
				other: other,
				targets: new Map()
			};
			this.CONFLICTS.set(key, data);
		}

		data.count++;
		data.targets.set(target, (data.targets.get(target) ?? 0) + 1);
	}

	static get conflicts() {
		return this.CONFLICTS;
	}

	static get modules() {
		return this.MODULES;
	}
}