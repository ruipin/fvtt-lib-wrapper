// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {PACKAGE_ID, IS_UNITTEST} from '../consts.js';
import {LibWrapperNotifications} from './notifications.js';
import {game_user_can} from '../shared/polyfill.js'

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

		// Seal to prevent accidental modification
		Object.seal(this);
	}

	static register_package(package_info) {
		if(!this.collect_stats)
			return;

		if(package_info.id == PACKAGE_ID)
			return;

		this.PACKAGES.add(package_info.key);
	}

	static register_conflict(package_info, other_info, wrapper, ignored) {
		if(!this.collect_stats)
			return;

		// Grab conflict data from storage, or create it if this is a new conflict
		const key = `${package_info.key}/${other_info.key}`;

		let data = this.CONFLICTS.get(key);
		if(!data) {
			data = {
				count: 0,
				ignored: 0,
				package_info: package_info,
				other_info: other_info,
				targets: new Map()
			};
			this.CONFLICTS.set(key, data);
		}

		const target = wrapper.name;
		let target_data = data.targets.get(target);
		if(!target_data) {
			target_data = {
				count: 0,
				ignored: 0
			}
			data.targets.set(target, target_data);
		}

		// Increment the conflict counter
		if(!ignored) {
			data.count++;
			target_data.count++;
		}
		else {
			data.ignored++;
			target_data.ignored++;
		}
	}

	static get conflicts() {
		return this.CONFLICTS;
	}

	static get packages() {
		return this.PACKAGES;
	}
}