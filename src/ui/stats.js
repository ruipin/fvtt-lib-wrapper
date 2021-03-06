// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {MODULE_ID} from '../consts.js';

export class LibWrapperStats {
	static _collect_stats() {
		// This method is called before game.user initializes, so we need to look at game.data.users manually
		const userid = game.userId;
		if(!userid)
			return false;

		const user = game.data.users.find((x) => { return x._id == userid });

		if(!user || user.role !== 4)
			return false;

		return true;
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