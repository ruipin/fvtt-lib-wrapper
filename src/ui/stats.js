// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {MODULE_ID, IS_UNITTEST} from '../consts.js';
import {LibWrapperNotifications} from './notifications.js';
import {game_user_can} from '../utils/user.js'

export class LibWrapperStats {
	static _collect_stats() {
		// We do this in a try-catch in case future Foundry versions break this code, it won't completely break libWrapper
		try {
			return game_user_can('SETTINGS_MODIFY');
		}
		catch(e) {
			if(IS_UNITTEST)
				throw e;

			LibWrapperNotifications.console_ui(
				"A non-critical error occurred while initializing libWrapper.",
				"Could not read user permissions during initialization.\n",
				'warn',
				e
			);

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
			let notify = false;
			other.forEach((m) => {
				notify |= LibWrapperStats.register_conflict(module, m, target);
			});
			return notify;
		}

		// We first notify everyone that an override was just lost. This hook being handled will prevent us from registering the module conflict
		if(Hooks.call('libWrapper.ConflictDetected', module, other, target) === false) {
			console.debug(`Conflict between '${module}' and '${other}' over '${target}' ignored, as 'libWrapper.ConflictDetected' hook returned false.`);
			return false;
		}

		// We now register the conflict
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

		// Done
		return true;
	}

	static get conflicts() {
		return this.CONFLICTS;
	}

	static get modules() {
		return this.MODULES;
	}
}