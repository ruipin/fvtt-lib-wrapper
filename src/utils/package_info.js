// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {PACKAGE_ID} from '../consts.js';

//*********************
// ID types
export const PACKAGE_TYPES = {
	UNKNOWN: 0,
	MODULE : 1,
	SYSTEM : 2,
	WORLD  : 3
};
Object.freeze(PACKAGE_TYPES);

export const PACKAGE_TYPES_REVERSE = {};
for(let key in PACKAGE_TYPES) {
	PACKAGE_TYPES_REVERSE[PACKAGE_TYPES[key]] = key;
}
Object.freeze(PACKAGE_TYPES_REVERSE);


const KEY_SEPARATOR = '~';


//*********************
// Package info class
// Stores package information. Able to auto-detect the package ID that is calling libWrapper.
export class PackageInfo {
	constructor(id=null, type=null) {
		this.set(id, type);
	}

	set(id=null, type=null, freeze=true) {
		if(!id)
			return this.detect_id();

		if(typeof id !== 'string')
			throw `libWrapper: PackageInfo IDs must be strings`;

		if(id.includes(KEY_SEPARATOR))
			return this.from_key(id);

		this.id = id;
		this.type = type;

		if(!type)
			this.detect_type();

		if(freeze)
			Object.freeze(this);
	}

	set_unknown() {
		this.id = '\u00ABunknown\u00BB';
		this.type = PACKAGE_TYPES.UNKNOWN;
	}

	equals(obj) {
		return obj && (obj.constructor === this.constructor) && (obj.id === this.id) && (obj.type === this.type);
	}

	detect_id(stack_trace=undefined) {
		this.set_unknown();

		if(stack_trace === undefined) {
			const old_stack_limit = Error.stackTraceLimit;
			Error.stackTraceLimit = Infinity;
			stack_trace = Error().stack;
			Error.stackTraceLimit = old_stack_limit;

			if(!stack_trace)
				return;
		}

		const matches = stack_trace.matchAll(/\/(worlds|systems|modules)\/(.+?)(?=\/)/ig);
		if(!matches)
			return;

		for(let match of matches) {
			const type = match[1];
			const name = match[2];

			if(type === 'worlds') {
				if(name == game.data.world.id)
					return this.set(name, PACKAGE_TYPES.WORLD);
			}
			else if(type === 'systems') {
				if(name == game.data.system.id)
					return this.set(name, PACKAGE_TYPES.SYSTEM);
			}
			else if(type === 'modules') {
				if(!name || name == PACKAGE_ID || !game?.modules?.has(name))
					continue;

				return this.set(name, PACKAGE_TYPES.MODULE);
			}
			else {
				throw new Error(`libWrapper: Invalid script type: ${type}`);
			}
		}
	}

	detect_type() {
		// We need to support this even when 'game.modules' hasn't been initialised yet
		if(!game?.modules) {
			if(this.id === PACKAGE_ID)
				this.type = PACKAGE_TYPES.MODULE;
			else
				this.type = PACKAGE_TYPES.UNKNOWN;

			return;
		}

		if(game.modules.get(this.id)?.active)
			this.type = PACKAGE_TYPES.MODULE;
		else if(this.id === game.data.system.id)
			this.type = PACKAGE_TYPES.SYSTEM;
		else if(this.id === game.data.world.id)
			this.type = PACKAGE_TYPES.WORLD;
		else
			this.type = PACKAGE_TYPES.UNKNOWN;
	}

	get known() {
		return this.type != PACKAGE_TYPES.UNKNOWN;
	}

	get exists() {
		switch(this.type) {
			case PACKAGE_TYPES.MODULE:
				return game.modules.get(this.id)?.active;
			case PACKAGE_TYPES.SYSTEM:
				return game.data.system.id === this.id;
			case PACKAGE_TYPES.WORLD:
				return game.data.world.id === this.id;
			default:
				return false;
		}
	}

	get data() {
		if(!this.exists)
			return null;

		switch(this.type) {
			case PACKAGE_TYPES.MODULE:
				return game.modules.get(this.id)?.data;
			case PACKAGE_TYPES.SYSTEM:
				return game.data.system.data;
			case PACKAGE_TYPES.WORLD:
				return game.data.world;
			default:
				return null;
		}
	}

	get title() {
		if(!this.exists)
			return 'Unknown';

		switch(this.type) {
			case PACKAGE_TYPES.MODULE:
			case PACKAGE_TYPES.SYSTEM:
			case PACKAGE_TYPES.WORLD :
				return this.data.title;
			default:
				return 'Unknown';
		}
	}

	get key() {
		return `${PACKAGE_TYPES_REVERSE[this.type].toLowerCase()}${KEY_SEPARATOR}${this.id}`;
	}

	from_key(key) {
		const split = key.split(KEY_SEPARATOR);
		if(split.length !== 2)
			throw `Error: Invalid key '${key}'`;

		this.set(split[1], PACKAGE_TYPES[split[0]]);
	}

	get logString() {
		if(!this.known)
			return 'an unknown package';

		return `${PACKAGE_TYPES_REVERSE[this.type].toLowerCase()} '${this.id}'`;
	}

	get logStringCapitalized() {
		let str = this.logString;
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	get settingsName() {
		switch(this.type) {
			case PACKAGE_TYPES.MODULE:
				return this.id;
			case PACKAGE_TYPES.SYSTEM:
				return `${this.id} [System]`;
			case PACKAGE_TYPES.WORLD:
				return `${this.id} [World]`;
			default:
				return this.id;
		}
	}
}
Object.freeze(PackageInfo);