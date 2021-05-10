// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {PACKAGE_ID, IS_UNITTEST} from '../consts.js';
import {LibWrapperNotifications} from './notifications.js';
import {game_user_can} from '../utils/polyfill.js'

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

		this.PACKAGES  = new Set();
		this.CONFLICTS = new Map();
	}

	static register_package(package_info) {
		if(!this.collect_stats)
			return;

		if(package_info.id == PACKAGE_ID)
			return;

		this.PACKAGES.add(package_info.key);
	}

	static register_conflict(package_info, other_info, target) {
		if(!this.collect_stats)
			return;

		if(!other_info)
			return;

		if(Array.isArray(other_info)) {
			let notify = false;
			other_info.forEach((other) => {
				notify |= LibWrapperStats.register_conflict(package_info, other, target);
			});
			return notify;
		}

		// We first notify everyone that an override was just lost. This hook being handled will prevent us from registering the package conflict
		if(Hooks.call('libWrapper.ConflictDetected', package_info.id, other_info.id, target) === false) {
			console.debug(`Conflict between ${package_info.logString} and ${other_info.logString} over '${target}' ignored, as 'libWrapper.ConflictDetected' hook returned false.`);
			return false;
		}

		// We now register the conflict
		const key = `${package_info.key}/${other_info.key}`;

		let data = this.CONFLICTS.get(key);
		if(!data) {
			data = {
				count: 0,
				package_info: package_info,
				other_info: other_info,
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

	static get packages() {
		return this.PACKAGES;
	}
}