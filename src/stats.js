// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {MODULE_ID} from './consts.js';

export class LibWrapperStats {
	static init() {
		this.collect_stats = true;

		// This method is called before game.user initializes, so we need to look at game.data.users manually
		const userid = game.userId;
		if(!userid)
			return;

		const user = game.data.users.find((x) => { return x._id == userid });

		if(!user || user.role !== 4) {
			this.collect_stats = false;
			return;
		}

		// If we got this far, we're going to be collecting statistics, so initialize the containers
		this.MODULES   = new Set();
		this.CONFLICTS = new Map();
	}

	static register_module(module) {
		if(!this.collect_stats)
			return;

		this.MODULES.add(module);
	}

	static register_conflict(module, other, target) {
		if(!this.collect_stats)
			return;

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