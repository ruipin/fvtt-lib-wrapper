// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';


// Class meant to store active wrappers
class WrapperStorage {
	// Construction
	constructor() {
		this.data = new Map();
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


	// Data Storage
	_delete(idx) {
		this.data.delete(idx);
	}

	_set(idx, wrapper) {
		if(wrapper === null || wrapper === undefined)
			return this._delete(idx);

		const ref = new WeakRef(wrapper);
		this.data.set(idx, ref);
	}

	_deref(idx, ref) {
		const obj = ref?.deref();

		// If the weak reference dereferences to null, we can garbage-collect it from the Map
		if(!obj)
			this._delete(idx);

		return obj;
	}

	_get(idx) {
		const ref = this.data.get(idx);
		return this._deref(idx, ref);
	}


	// Utility
	exists(wrapper, idx=undefined) {
		if(idx === undefined)
			idx = this.index_for_wrapper(wrapper);

		const existing = this._get(idx);

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
			this._set(idx, wrapper);
	}

	remove(wrapper) {
		const idx = this.index_for_wrapper(wrapper);

		if(this.exists(wrapper, idx))
			this._delete(idx);
	}

	clear() {
		this.data.clear();
		this.next_id = 0;
	}


	// Iteration
	*wrappers() {
		for(const [idx, ref] of this.data.entries()) {
			const wrapper = this._deref(idx, ref);
			if(!wrapper)
				continue;

			yield wrapper;
		}
	}

	forEach(callbackFn) {
		for(const wrapper of this.wrappers())
			callbackFn(wrapper);
	}

	find(callbackFn) {
		for(const wrapper of this.wrappers()) {
			if(callbackFn(wrapper))
				return wrapper;
		}

		return undefined;
	}


	// Wrapper ID
	find_by_id(id) {
		const idx = this.index_for_id(id);
		return this._get(idx);
	}
}


// Export singleton object containing the shared list of active wrappers
export const WRAPPERS = new WrapperStorage();