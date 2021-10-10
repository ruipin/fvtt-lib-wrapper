// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {DEBUG, HOOKS_SCOPE} from '../consts.js';
import {ERRORS} from '../errors/errors.js';
import {LibWrapperStats} from './stats.js';
import {PackageInfo} from '../shared/package_info.js';


class IgnoredConflictEntry {
	constructor(ignore_infos, targets, ignore_errors) {
		// Packages to ignore
		this.ignore_infos = new Set(ignore_infos.map((x) => x.key));

		// Targets to ignore
		this.targets = new Set(targets);

		// Whether this ignore also should match errors, and not just warnings
		this.ignore_errors = ignore_errors;

		// Done
		Object.seal(this);
	}

	is_ignored(package_info, wrapper, is_warning) {
		// Skip if this is an error and we aren't set to ignore errors
		if(!is_warning && !this.ignore_errors)
			return false;

		// Search for a matching package
		const found_package = this.ignore_infos.has(package_info.key);
		if(!found_package)
			return false;

		// Find matching target
		const found_target = wrapper.names.find((name) => this.targets.has(name));
		return (found_target !== undefined);
	}
}

export class LibWrapperConflicts {
	static init() {
		this.IGNORED = new Map();

		// Seal to prevent accidental modification
		Object.seal(this);
	}

	static register_ignore(package_info, ignore_infos, targets, is_warning) {
		// Create IgnoredConflictEntry
		const entry = new IgnoredConflictEntry(ignore_infos, targets, is_warning);

		// Get the existing list of ignore entries for this package, or create a new one and add it to the map
		const key = package_info.key;
		let ignore_entries = this.IGNORED.get(key);
		if(!ignore_entries) {
			ignore_entries = [];
			this.IGNORED.set(key, ignore_entries);
		}

		// Add new entry to list
		ignore_entries.push(entry);
	}

	static clear_ignores() {
		this.IGNORED.clear();
	}

	static _is_ignored_oneway(package_info, other_info, wrapper, is_warning) {
		// Get the existing list of ignore entries for this package
		const key = package_info.key;
		const ignore_entries = this.IGNORED.get(key);
		if(!ignore_entries)
			return false;

		// Check if any of the entries causes this conflict to be ignored
		for(const entry of ignore_entries) {
			if(entry.is_ignored(other_info, wrapper, is_warning))
				return true;
		}

		// Otherwise, it's not ignored
		return false;
	}

	static _is_ignored(package_info, other_info, wrapper, is_warning) {
		return this._is_ignored_oneway(package_info, other_info, wrapper, is_warning) ||
		       this._is_ignored_oneway(other_info, package_info, wrapper, is_warning);
	}

	static register_conflict(package_info, other_info, wrapper, target, is_warning) {
		// Ignore an empty conflict
		if(!other_info)
			return false;

		// Convert from array if necessary
		if(Array.isArray(other_info)) {
			let notify = false;
			other_info.forEach((other) => {
				notify |= this.register_conflict(package_info, other, wrapper, target, is_warning);
			});
			return notify;
		}

		// Sanity checks #2
		if(package_info.constructor !== PackageInfo)
			throw new ERRORS.internal(`LibWrapperConflicts.register_conflict: 'package_info' must be a PackageInfo object, but got '${package_info}'.`);

		if(other_info.constructor !== PackageInfo)
			throw new ERRORS.internal(`LibWrapperConflicts.register_conflict: 'other_info' must be a PackageInfo object, but got '${other_info}'.`);

		// Note: Not checked because of cyclic dependency
		//if(wrapper.constructor != Wrapper)
		//	throw new ERRORS.internal(`LibWrapperConflicts.register_conflict: 'wrapper' must be a Wrapper object, but got '${wrapper}'.`);

		if(target != null && typeof target !== 'string')
			throw new ERRORS.internal(`LibWrapperConflicts.register_conflict: 'target' must be a string, or null, but got '${target}'.`);

		if(typeof is_warning !== 'boolean')
			throw new ERRORS.internal(`LibWrapperConflicts.register_conflict: 'is_warning' must be a boolean, but got '${is_warning}'.`);


		// We first check if this conflict is ignored
		let ignored = false;

		if(!ignored && this._is_ignored(package_info, other_info, wrapper, is_warning)) {
			ignored = true;
			if(DEBUG)
				console.debug(`Conflict between ${package_info.type_plus_id} and ${other_info.type_plus_id} over '${wrapper.name}' ignored through 'ignore_conflicts' API.`);
		}

		// We then notify everyone that a conflict was just detected. This hook being handled will prevent us from registering the package conflict
		if(!ignored && Hooks.call(`${HOOKS_SCOPE}.ConflictDetected`, package_info.id, other_info.id, target, wrapper.frozen_names) === false) {
			ignored = true;
			if(DEBUG)
				console.debug(`Conflict between ${package_info.type_plus_id} and ${other_info.type_plus_id} over '${wrapper.name}' ignored, as 'libWrapper.ConflictDetected' hook returned false.`);
		}

		// We now register the conflict with LibWrapperStats
		LibWrapperStats.register_conflict(package_info, other_info, wrapper, ignored);

		// Done
		return !ignored;
	}
}