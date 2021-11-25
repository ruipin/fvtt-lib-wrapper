// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';


// Class meant to store active wrappers
class WrapperStorage {
	// Construction
	constructor() {
		this.clear();
	}


	// IDs
	index_for_id(id) {
		return Math.floor(id / 2);
	}

	index_for_wrapper(wrapper) {
		return this.index_for_id(wrapper.getter_id);
	}

	get_next_id_pair() {
		return [this.next_id++, this.next_id++];
	}


	// Utility
	exists(wrapper, idx=undefined) {
		if(idx === undefined)
			idx = this.index_for_wrapper(wrapper);

		const existing = this.data[idx];

		// If the index already exists, it must be the same object
		if(existing) {
			if(existing !== wrapper)
				throw new ERRORS.internal(`Sanity check failed: The WrapperStorage index ${idx} does not contain the wrapper object '${wrapper.name}'.`);

			return true;
		}

		// Otherwise, it does not exist
		return false;
	}


	// Insertion and Deletion
	add(wrapper) {
		const idx = this.index_for_wrapper(wrapper);

		// Add to storage if it does not exist yet
		if(!this.exists(wrapper, idx))
			this.data[idx] = wrapper;
	}

	remove(wrapper) {
		const idx = this.index_for_wrapper(wrapper);

		if(this.exists(wrapper, idx))
			this.data[idx] = undefined;
	}

	clear() {
		this.data = [];
		this.next_id = 0;
	}


	// Iteration
	forEach(callbackFn) {
		return this.data.forEach((element, ...args) => {
			if(!element)
				return false;

			return callbackFn(element, ...args);
		});
	}

	find(callbackFn) {
		return this.data.find((element, ...args) => {
			if(!element)
				return false;

			return callbackFn(element, ...args);
		});
	}

	find_id(id) {
		const array_id = this.index_for_id(id);
		return this.data[array_id];
	}
}


// Export singleton object containing the shared list of active wrappers
export const WRAPPERS = new WrapperStorage();