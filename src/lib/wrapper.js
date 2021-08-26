// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {PACKAGE_ID, PROPERTIES_CONFIGURABLE, DEBUG} from '../consts.js';
import {WRAPPER_TYPES, PERF_MODES} from './enums.js';
import {decorate_name, set_function_name, decorate_class_function_names} from '../utils/misc.js';
import {PackageInfo} from '../shared/package_info.js';

import {LibWrapperInternalError, LibWrapperPackageError} from '../errors/base_errors.js';
import {LibWrapperInvalidWrapperChainError} from '../errors/api_errors.js';

import {LibWrapperNotifications} from '../ui/notifications.js';
import {LibWrapperStats} from '../ui/stats.js';
import {LibWrapperConflicts} from '../ui/conflicts.js';
import {onUnhandledError} from '../errors/listeners.js';



// Wrapper class - this class is responsible for the actual wrapping
export class Wrapper {
	// Names
	get name() {
		return this.names[0];
	}

	get frozen_names() {
		Object.freeze(this.names);
		return this.names;
	}

	_add_name(name) {
		if(!this.names.includes(name)) {
			// Note: 'this._names' might be frozen, assuming the 'this.frozen_names' getter has ever been used, in which case we need to clone it.
			if(Object.isFrozen(this.names))
				this.names = this.names.slice();

			this.names.push(name);
		}
	}


	// Callstack
	_callstack_name(nm, arg1=this.name) {
		return decorate_name(arg1, nm);
	}


	// Constructor
	constructor (obj, fn_name, name=undefined, package_info=undefined) {
		// Basic instance variables
		this.fn_name = fn_name;
		this.object  = obj;

		// Validate whether we can wrap this object
		let descriptor = Object.getOwnPropertyDescriptor(obj, fn_name);

		if(descriptor) {
			if(descriptor.get?._lib_wrapper) {
				const wrapper = descriptor.get?._lib_wrapper;

				if(!(wrapper instanceof this.constructor))
					throw new LibWrapperInternalError(`libWrapper: '${name}' cannot be wrapped, the descriptor already has a wrapper, but of an unexpected class ('${wrapper.constructor.name}' vs '${this.constructor.name}').`);

				wrapper._add_name(name);

				return wrapper;
			}

			if(descriptor.configurable === false) {
				throw new LibWrapperPackageError(`libWrapper: '${name}' cannot be wrapped, the corresponding descriptor has 'configurable=false'.`, package_info);
			}
			else {
				if(descriptor.get) {
					this.is_property = true;
					this._wrapped_getter = descriptor.get;
					this._wrapped_setter = descriptor.set;
				}
				else {
					this.is_property = false;
					this._wrapped = descriptor.value;
				}
			}
		}
		else {
			descriptor = this._get_inherited_descriptor();

			if(!descriptor)
				throw new LibWrapperPackageError(`libWrapper: Can't wrap '${name}', target does not exist or could not be found.`, package_info);

			const wrapper = descriptor.get?._lib_wrapper;

			if(wrapper) {
				this.is_property = wrapper.is_property;
			}
			else {
				if(descriptor.get ?? descriptor.set)
					this.is_property = true;
				else
					this.is_property = false;
			}
		}

		// Setup instance variables
		this.names = [];

		this.getter_data = [];
		this._getter_data_id = 0;
		if(this.is_property) {
			this.setter_data = [];
			this._setter_data_id = 0;
		}

		this.active  = false;

		this._outstanding_wrappers = 0;
		this._current_handler_id = 0;

		if(!this.is_property) {
			this._pending_wrapped_calls = [];
			this._pending_wrapped_calls_cnt = 0;
		}

		this.update_use_static_dispatch();

		// Add name
		if(!name)
			name = fn_name;
		this._add_name(name);

		// Do actual wrapping
		this._wrap();
	}


	// Handler
	_get_handler() {
		// Return the cached handler, if it is still valid
		const handler_id = this._current_handler_id;
		if(handler_id === this._cached_handler_id)
			return this._cached_handler;

		// Create a handler function
		const _this = this;
		const handler_nm = this._callstack_name(handler_id);
		const wrapped = this._wrapped ?? null; // we explicitly convert undefined to null here, to force a inheritance chain search when calling get_wrapped

		// We use a trick here to be able to convince the browser to name the method the way we want it
		const obj = {
			[handler_nm]: function(...args) {
				const is_static_dispatch = _this.use_static_dispatch;

				// Check if we should skip wrappers
				if(_this.should_skip_wrappers(this, handler_id, is_static_dispatch)) {
					return _this.get_wrapped(this, false, wrapped).apply(this, args);
				}
				// Otherwise, trigger the wrapper dispatch chain
				else {
					// Trigger the desired dispatch chain - dynamic or static
					if(is_static_dispatch)
						return _this.get_static_dispatch_chain(this).apply(this, args);
					else
						return _this.call_wrapper(null, this, ...args);
				}
			},

			toString: function () {
				return "/* WARNING: libWrapper wrappers present! */\n" + _this.get_wrapped(this).toString();
			}
		};
		const handler = obj[handler_nm];
		handler.toString = obj['toString'];

		// Cache handler
		this._cached_handler = handler;
		this._cached_handler_id = handler_id;

		// Done
		return handler;
	}

	get_static_dispatch_chain(obj) {
		const fn_data_id = this._getter_data_id;
		let dispatch_chain = null;

		// Use the cached dispatch chain, if still valid
		if(fn_data_id === this._cached_static_dispatch_chain_id && obj === this._cached_static_dispatch_chain_obj) {
			dispatch_chain = this._cached_static_dispatch_chain;
		}
		// Otherwise, generate a new static dispatch chain
		else {
			const _init_dispatch_chain = () => {
				dispatch_chain = this.call_wrapped.bind(this, /*state=*/ null, obj);
			};

			// Walk wrappers in reverse order
			const fn_data = this.get_fn_data(false);
			for(let i = fn_data.length-1; i >= 0; i--) {
				const data = fn_data[i];
				const fn = data.fn;

				// OVERRIDE type will usually not continue the chain
				if(!data.chain)
					dispatch_chain = fn.bind(obj);
				// Else, bind the wrapper
				else {
					if(!dispatch_chain)
						_init_dispatch_chain();

					dispatch_chain = fn.bind(obj, dispatch_chain);
				}
			}

			if(!dispatch_chain)
				_init_dispatch_chain();

			// Cache static dispatch chain
			this._cached_static_dispatch_chain_obj = obj;
			this._cached_static_dispatch_chain_id  = fn_data_id;
			this._cached_static_dispatch_chain     = dispatch_chain;
		}

		// Done
		return dispatch_chain;
	}

	should_skip_wrappers(obj, handler_id, is_static_dispatch) {
		// We don't need to skip wrappers if the handler is still valid
		if(handler_id == this._current_handler_id)
			return false;

		// Sanity check
		if(handler_id > this._current_handler_id)
			throw new LibWrapperInternalError(`Unreachable: handler_id=${handler_id} > this._current_handler_id=${this._current_handler_id}`);

		// Find pending calls that match this object - if any is found, skip wrappers
		if(!this.is_property) {
			// Check if there's any pending wrapped calls
			if(this._pending_wrapped_calls_cnt <= 0)
				return false;

			// Check if our object exists in the pending wrapped calls
			if(!is_static_dispatch) {
				const pend_i = this._pending_wrapped_calls.indexOf(obj);
				if(pend_i < 0)
					return false;
			}
		}

		return true;
	}

	skip_existing_handlers() {
		this._current_handler_id++;
	}

	_calc_use_static_dispatch() {
		// Do all the wrappers in fn_data specify the same, explicit, performance mode wish?
		const fn_data = this.get_fn_data(false);

		let perf_mode = undefined;
		for(const data of fn_data) {
			if(!data.perf_mode)
				continue;

			if(perf_mode === undefined) {
				perf_mode = data.perf_mode;
			}
			else if(perf_mode !== data.perf_mode) {
				perf_mode = PERF_MODES.AUTO;
				break;
			}
		}

		if(perf_mode === PERF_MODES.FAST)
			return true;
		else if(perf_mode === PERF_MODES.SAFE)
			return false;
		else /* PERF_MODES.AUTO */ {
			// Default to static dispatch in user-enabled high performance mode
			if(game?.settings?.get(PACKAGE_ID, 'high-performance-mode'))
				return true;

			// Finally, default to false
			return false;
		}
	}

	update_use_static_dispatch() {
		this.use_static_dispatch = this._calc_use_static_dispatch();
	}


	// Wrap/unwrap logic
	_wrap() {
		if(this.active)
			return;

		// Setup setter/getter
		// We use a trick here to be able to convince the browser to name the method the way we want it
		const getter_nm = this._callstack_name('getter');
		const setter_nm = this._callstack_name('setter');
		let obj;

		if(!this.is_property) {
			const _this = this;

			// Setup setter / getter
			obj = {
				[getter_nm]: () => _this._get_handler(),

				[setter_nm]: function(value) {
					return _this.set_nonproperty(value, this);
				}
			};
		}
		else {
			// Setup setter / getter
			const _this = this;

			obj = {
				[getter_nm]: function(...args) {
					return _this.call_wrapper(null, this, ...args);
				},

				[setter_nm]: function(...args) {
					return _this.call_wrapper({setter: true}, this, ...args);
				}
			}
		}

		const getter = obj[getter_nm];
		const setter = obj[setter_nm];

		// Store a reference to this in the getter so that we can support 'singleton'-like functionality
		getter._lib_wrapper = this;

		// Define a property with a getter/setter
		Object.defineProperty(this.object, this.fn_name, {
			get: getter,
			set: setter,
			configurable: PROPERTIES_CONFIGURABLE
		});

		this.active = true;

		console.debug(`libWrapper: Wrapped '${this.name}'.`);
	}

	unwrap() {
		if(!this.active)
			return;

		if(!PROPERTIES_CONFIGURABLE)
			throw new LibWrapperInternalError('libWrapper: Cannot unwrap when PROPERTIES_CONFIGURABLE==false');


		// Remove the property
		delete this.object[this.fn_name];

		if(this.is_property) {
			Object.defineProperty(this.object, this.fn_name, {
				get: this._wrapped_getter,
				set: this._wrapped_setter,
				configurable: true
			});
		}
		else {
			this.object[this.fn_name] = this._wrapped;
		}


		// Done
		this.active = false;

		console.debug(`libWrapper: Unwrapped '${this.name}'.`);
	}



	// Utilities related to getting the wrapped value
	_get_inherited_descriptor() {
		let iObj = Object.getPrototypeOf(this.object);

		while(iObj) {
			const descriptor = Object.getOwnPropertyDescriptor(iObj, this.fn_name);
			if(descriptor)
				return descriptor;

			iObj = Object.getPrototypeOf(iObj);
		}

		return null;
	}

	get_wrapped(obj, setter=false, wrapped=undefined) {
		let result;

		// A non-undefined "wrapped" parameter is taken as-is
		if(wrapped !== undefined)
			result = wrapped;
		// Otherwise we grab what is currently wrapped
		else if(this.is_property)
			result = setter ? this._wrapped_setter : this._wrapped_getter;
		else
			result = this._wrapped;

		// We convert 'null' to undefined. This means passing parameter 'wrapped==null' forces an inheritance chain search
		if(result === null)
			result = undefined;

		// If this wrapper is 'empty', we need to search up the inheritance hierarchy for the return value
		if(result === undefined) {
			const descriptor = this._get_inherited_descriptor();

			if(descriptor) {
				if(this.is_property) {
					if(!descriptor.get && !descriptor.set)
						throw new LibWrapperInternalError(`This wrapper is set up to wrap a property, but the inherited descriptor is a method.`);

					if(setter)
						result = descriptor.set;
					else
						result = descriptor.get;
				}
				else {
					result = descriptor.value ?? descriptor.get.apply(obj);
				}
			}
		}

		// Done
		if(result === undefined)
			console.warn(`libWrapper: There is no wrapped method for '${this.name}', returning 'undefined'.`);

		return result;
	}



	// Calling the wrapped method
	call_wrapped(state, obj, ...args) {
		// Keep track of call state
		if(state)
			this._call_wrapper_update_state(state);

		// Load necessary state
		const is_setter = state?.setter ?? false;
		const is_dynamic_dispatch = (!!state);

		// If necessary, set this wrapped call as pending
		let pend = undefined;
		if(!this.is_property) {
			this._pending_wrapped_calls_cnt++;

			if(is_dynamic_dispatch) {
				pend = obj;
				this._pending_wrapped_calls.push(pend);
			}
		}

		// Try-catch block to handle normal exception flow
		let result = undefined;
		try {
			const wrapped = this.get_wrapped(this.object, is_setter);
			result = wrapped?.apply(obj, args);
		}
		catch(e) {
			if(!this.is_property)
				this._cleanup_call_wrapped(pend, is_dynamic_dispatch);

			throw e;
		}

		// We only need to keep track of pending calls when we're not wrapping a property
		if(this.is_property)
			return result;

		// If the result is a Promise, then we must wait until it fulfills before cleaning up.
		// Per the JS spec, the only way to detect a Promise (since Promises can be polyfilled, extended, wrapped, etc) is to look for the 'then' method.
		// Anything with a 'then' function is technically a Promise. This leaves a path for false-positives, but I don't see a way to avoid this.
		if(typeof result?.then === 'function') {
			result = result.then(
				// onResolved
				v => {
					this._cleanup_call_wrapped(pend, is_dynamic_dispatch);
					return v;
				},
				// onRejected
				e => {
					this._cleanup_call_wrapped(pend, is_dynamic_dispatch);
					throw e;
				}
			);
		}
		// Otherwise, we can immediately cleanup.
		else {
			this._cleanup_call_wrapped(pend, is_dynamic_dispatch);
		}

		// Done
		return result;
	}

	_cleanup_call_wrapped(pend, is_dynamic_dispatch) {
		if(!this._pending_wrapped_calls_cnt)
			throw new LibWrapperInternalError(`this._pending_wrapped_calls_cnt=${this._pending_wrapped_calls_cnt} should be unreachable at this point.`);
		this._pending_wrapped_calls_cnt--;

		if(is_dynamic_dispatch) {
			const pend_i = this._pending_wrapped_calls.indexOf(pend);
			if(pend_i < 0)
				throw new LibWrapperInternalError(`Could not find 'pend' inside 'this._pending_wrapped_calls'.`);

			this._pending_wrapped_calls.splice(pend_i, 1);
		}
	}



	// Main call wrapper logic
	call_wrapper(state, obj, ...args) {
		// Keep track of call state
		if(state)
			this._call_wrapper_update_state(state);

		// Set up basic information about this wrapper
		const index = state?.index ?? 0;
		const is_setter = state?.setter ?? false;
		const fn_data = state?.fn_data ?? this.get_fn_data(is_setter);

		// Grab the next function data from the function data array
		const data = fn_data[index];

		// If no methods exist, then finish the chain
		if(!data) {
			if(fn_data.length > 0)
				throw new LibWrapperInternalError(`Must not have 'data===${data}' when 'fn_data.length==${fn_data.length}'.`);

			// There are no wrappers, return the wrapped value.
			return this.call_wrapped(null, obj, ...args);
		}

		// Grab wrapper function from function data object
		const fn = data.fn;

		// OVERRIDE type will usually not continue the chain
		if(!data.chain) {
			// Call next method in the chain
			return fn.apply(obj, args);
		}

		// Get next index
		const next_index = index + 1;
		const is_last = (next_index >= fn_data.length);

		// Prepare the continuation of the chain
		const next_state = {
			index    : next_index,
			called   : false,
			valid    : true,
			setter   : is_setter,
			prev_data: data,
			fn_data  : fn_data
		};

		// Create the next wrapper function
		const next_fn = is_last ? this.call_wrapped.bind(this, next_state, obj) : this.call_wrapper.bind(this, next_state, obj);
		this._outstanding_wrappers++;

		// Try-catch block to handle normal exception flow
		let result = undefined;
		try {
			// Call next method in the chain
			result = fn.call(obj, next_fn, ...args);
		}
		catch(e) {
			return this._cleanup_call_wrapper_thrown(next_state, e);
		}

		// If the result is a Promise, then we must wait until it fulfills before cleaning up.
		// Per the JS spec, the only way to detect a Promise (since Promises can be polyfilled, extended, wrapped, etc) is to look for the 'then' method.
		// Anything with a 'then' function is technically a Promise. This leaves a path for false-positives, but I don't see a way to avoid this.
		if(typeof result?.then === 'function') {
			result = result.then(
				// onResolved
				v => this._cleanup_call_wrapper(v, next_state, data, fn_data, next_fn, obj, args),
				// onRejected
				e => this._cleanup_call_wrapper_thrown(next_state, e)
			);
		}
		// Otherwise, we can immediately cleanup.
		else {
			result = this._cleanup_call_wrapper(result, next_state, data, fn_data, next_fn, obj, args);
		}

		// Done
		return result;
	}

	_call_wrapper_update_state(state) {
		// Keep track of call state
		if('valid' in state && !state.valid) {
			throw new LibWrapperInvalidWrapperChainError(
				this,
				state.prev_data?.package_info,
				`This wrapper function for '${this.name}' is no longer valid, and must not be called.`
			);
		}

		// Mark this state object as called
		state.called = true;
	}

	_invalidate_state(state) {
		state.valid = false;

		this._outstanding_wrappers--;
		if(this._outstanding_wrappers < 0)
			throw new LibWrapperInternalError(`Outstanding wrappers = ${this._outstanding_wrappers}, should never fall below 0.`);
	}

	_cleanup_call_wrapper_thrown(next_state, e) {
		// An exception/rejection causes invalidation of next_state
		this._invalidate_state(next_state);

		// Re-throw
		throw e;
	}

	_cleanup_call_wrapper(result, next_state, data, fn_data, next_fn, obj, args) {
		// Try-finally to ensure we invalidate the wrapper even if this logic fails
		try {
			// Check that next_fn was called
			if(!next_state.called) {
				// We need to collect affected package information if we're collecting statistics, or we haven't warned the user of this conflict yet.
				let collect_affected = (!data.warned_conflict || LibWrapperStats.collect_stats);
				let affectedPackages = null;
				let is_last_wrapper = false;
				let notify_user = false;

				if(collect_affected) {
					affectedPackages = fn_data.slice(next_state.index).filter((x) => {
						return !x.package_info.equals(data.package_info);
					}).map((x) => {
						return x.package_info;
					});

					is_last_wrapper = (affectedPackages.length == 0);

					if(!is_last_wrapper)
						notify_user = LibWrapperConflicts.register_conflict(data.package_info, affectedPackages, this, null, true);
				}

				// WRAPPER-type functions that do this are breaking an API requirement, as such we need to be loud about this.
				// As a "punishment" of sorts, we forcefully unregister them and ignore whatever they did.
				if(data.type === WRAPPER_TYPES.WRAPPER) {
					// We automatically trigger an unhandled error since we don't want to throw
					const error = new LibWrapperPackageError(
						`The wrapper for '${data.target}' registered by ${data.package_info.type_plus_id} with type WRAPPER did not chain the call to the next wrapper, which breaks a libWrapper API requirement. This wrapper will be unregistered.`,
						data.package_info
					);
					onUnhandledError(error);
					console.error(error);

					// Unregister this module
					globalThis.libWrapper.unregister(data.package_info.id, data.target);

					// Manually chain to the next wrapper if there are more in the chain
					if(!is_last_wrapper)
						result = next_fn.apply(obj, args);
				}

				// Other WRAPPER_TYPES get a generic 'conflict' message
				else if(notify_user && !data.warned_conflict) {
					LibWrapperNotifications.conflict(data.package_info, affectedPackages, true, `${data.package_info.type_plus_id_capitalized} did not chain the wrapper for '${data.target}'.`);
					data.warned_conflict = true;
				}
			}
		}
		finally {
			// Invalidate state to avoid asynchronous calls
			this._invalidate_state(next_state);
		}

		// Done
		return result;
	}



	// Non-property setter
	set_nonproperty(value, obj=null) {
		if(this.is_property)
			throw new LibWrapperInternalError('Must not call \'set_nonproperty\' for a property wrapper.');

		const inherited = (obj !== this.object);

		// If assigning to an instance directly, assign directly to instance
		if(inherited) {
			Object.defineProperty(obj, this.fn_name, {
				value: value,
				configurable: true,
				enumerable: true,
				writable: true
			});

			return;
		}

		// Wrap the new value
		this._wrapped = value;
		this.skip_existing_handlers();

		// Warn user and/or log conflict
		this.warn_classic_wrapper();
	}



	// Conflict logging utilities
	get_affected_packages() {
		const affectedPackages = this.getter_data.map((x) => {
			return x.package_info;
		});

		return affectedPackages;
	}

	warn_classic_wrapper() {
		const package_info = new PackageInfo();
		const affectedPackages = this.get_affected_packages();

		if(affectedPackages.length > 0) {
			const notify_user = LibWrapperConflicts.register_conflict(package_info, affectedPackages, this, null, true);

			if(notify_user) {
				LibWrapperNotifications.conflict(package_info, affectedPackages, true, `Detected non-libWrapper wrapping of '${this.name}' by ${package_info.type_plus_id}. This will potentially lead to conflicts.`);

				if(DEBUG && console.trace)
					console.trace();
			}
		}

		if(!this.detected_classic_wrapper)
			this.detected_classic_wrapper = []
		this.detected_classic_wrapper.push(package_info.key);
	}



	// Wraper array methods
	// NOTE: These should only ever be called from libWrapper, they do not clean up after themselves
	get_fn_data(setter, to_modify=false) {
		// to_modify=true must be used any time the fn_data array will be modified.
		// If there are any outstanding wrapper calls, this will force the creation of a copy of the array, to avoid affecting said outstanding wrapper calls.

		// Sanity check
		if(setter && !this.is_property)
			throw new LibWrapperInternalError(`libWrapper: '${this.name}' does not wrap a property, thus setter=true is illegal.`);

		// Get current fn_data
		const prop_nm = setter ? 'setter_data' : 'getter_data';
		let result = this[prop_nm];

		// If we are going to modify the return result...
		if(to_modify) {
			// Duplicate fn_data if we are modifying it and there are outstanding wrappers
			if(this._outstanding_wrappers > 0) {
				result = this[prop_nm].slice(0);
				this[prop_nm] = result;
			}

			// Increment unique ID
			this[`_${prop_nm}_id`]++;
		}

		// Done
		return result;
	}

	_post_update_fn_data() {
		this.update_use_static_dispatch();
	}

	sort() {
		for(let setter of [false, true]) {
			if(setter && !this.is_property)
				continue;

			let fn_data = this.get_fn_data(setter);
			fn_data.sort((a,b) => { return a.type.value - b.type.value || b.priority - a.priority });
		}
	}

	add(data) {
		// Try to set a function name if there is none already
		const fn = data.fn;
		if(!fn.name || fn.name === 'anonymous')
			set_function_name(fn, this._callstack_name(data.package_info.id ?? '<unknown>'));

		// Add to fn_data
		const fn_data = this.get_fn_data(data.setter, true);

		fn_data.splice(0, 0, data);
		this.sort(data.setter);

		this._post_update_fn_data();
	}

	remove(data) {
		const fn_data = this.get_fn_data(data.setter, true);

		const index = fn_data.indexOf(data);
		fn_data.splice(index, 1);

		this._post_update_fn_data();
	}

	clear() {
		this.getter_data = [];

		if(this.is_property)
			this.setter_data = [];

		this._post_update_fn_data();
	}

	is_empty() {
		return !this.getter_data.length && !this.setter_data?.length;
	}
};
decorate_class_function_names(Wrapper);

// Prevent modifications
Object.freeze(Wrapper);