// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {PROPERTIES_CONFIGURABLE, PACKAGE_TITLE} from '../consts.js';
import {WRAPPER_TYPES, PERF_MODES} from './enums.js';
import {WRAPPERS} from './storage.js';
import {decorate_name, set_function_name, decorate_class_function_names, is_promise} from '../utils/misc.js';
import {getHighPerformanceMode} from '../utils/settings.js';
import {PackageInfo} from '../shared/package_info.js';
import {Log} from '../shared/log.js';

import {ERRORS} from '../errors/errors.js';

import {LibWrapperNotifications} from '../ui/notifications.js';
import {LibWrapperStats} from '../ui/stats.js';
import {LibWrapperConflicts} from '../ui/conflicts.js';
import {onUnhandledError} from '../errors/listeners.js';


// Wrapper class - this class is responsible for the actual wrapping
export class Wrapper {
	// IDs
	get_id(is_setter=false) {
		return is_setter ? this.setter_id : this.getter_id;
	}



	// Names
	get name() {
		return this.names[0];
	}

	get frozen_names() {
		Object.freeze(this.names);
		return this.names;
	}

	get_name(is_setter=false) {
		return is_setter ? `${this.name}#set` : this.name;
	}

	get_names(is_setter=false) {
		if(!is_setter)
			return this.frozen_names;

		return this.names.map((name) => `${name}#set`);
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
					throw new ERRORS.internal(`'${name}' cannot be wrapped, the descriptor already has a wrapper, but of an unexpected class ('${wrapper.constructor.name}' vs '${this.constructor.name}').`);

				wrapper._add_name(name);

				return wrapper;
			}

			if(descriptor.configurable === false) {
				throw new ERRORS.package(`'${name}' cannot be wrapped, the corresponding descriptor has 'configurable=false'.`, package_info);
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
				throw new ERRORS.package(`Can't wrap '${name}', target does not exist or could not be found.`, package_info);

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
		[this.getter_id, this.setter_id] = WRAPPERS.get_next_id_pair();

		this.names = [];

		this.active = false;

		this._outstanding_wrappers = 0;

		if(!this.is_property) {
			this._current_handler_id = 0;
			this._pending_wrapped_calls = [];
			this._pending_wrapped_calls_cnt = 0;
		}

		this.use_static_dispatch = false;

		this.clear();

		// Add name
		if(!name)
			name = fn_name;
		this._add_name(name);

		// Do actual wrapping
		this._wrap();
	}



	// Handler
	_get_handler() {
		// Properties cannot use handlers
		if(this.is_property)
			throw new ERRORS.internal(`Unreachable: _get_handler with is_property=false`);

		// Return the cached handler, if it is still valid
		const handler_id = this._current_handler_id;
		if(handler_id === this._cached_handler_id)
			return this._cached_handler;

		// Create a handler function
		const _this = this;
		const handler_nm = this._callstack_name(handler_id, this.name);
		const wrapped = this._wrapped ?? null; // we explicitly convert undefined to null here, to force a inheritance chain search when calling get_wrapped

		// We use a trick here to be able to convince the browser to name the method the way we want it
		const obj = {
			[handler_nm]: function(...args) {
				const is_static_dispatch = _this.use_static_dispatch;

				// Check if we should skip wrappers
				if(_this.should_skip_wrappers(this, handler_id, is_static_dispatch)) {
					return _this.get_wrapped(this, false, wrapped).apply(this, args);
				}
				// Otherwise, trigger listeners and the wrapper dispatch chain
				else {
					// Trigger listeners
					_this.call_listeners(this, /*is_setter=*/ false, ...args);

					// Decide what to call next
					if(_this.get_fn_data(false, false).length == 0)
						return _this.get_wrapped(this, false, wrapped).apply(this, args);
					else if(is_static_dispatch)
						return _this.get_static_dispatch_chain(this).apply(_this, args);
					else
						return _this.call_wrapper(null, this, ...args);
				}
			}
		};
		const handler = obj[handler_nm];

		handler.toString = function () {
			return "/* WARNING: libWrapper wrappers present! */\n" + _this.get_wrapped(this).toString();
		}

		// Cache handler
		this._cached_handler = handler;
		this._cached_handler_id = handler_id;

		// Done
		return handler;
	}

	should_skip_wrappers(obj, handler_id, is_static_dispatch) {
		// We don't need to skip wrappers if the handler is still valid
		if(handler_id == this._current_handler_id)
			return false;

		// Sanity check
		if(handler_id > this._current_handler_id)
			throw new ERRORS.internal(`Unreachable: handler_id=${handler_id} > this._current_handler_id=${this._current_handler_id}`);

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



	// Static Dispatch Chain
	_get_static_dispatch_chain_cache(obj) {
		return this._static_dispatch_weakmap?.get(obj) ?? this._static_dispatch_strongmap?.get(obj);
	}

	_set_static_dispatch_chain_cache(obj, dispatch_chain) {
		try {
			if(!this._static_dispatch_weakmap)
				this._static_dispatch_weakmap = new WeakMap();
			this._static_dispatch_weakmap.set(obj, dispatch_chain);
		}
		catch {
			if(!this._static_dispatch_strongmap)
				this._static_dispatch_strongmap = new Map();
			this._static_dispatch_strongmap.set(obj, dispatch_chain);
		}
	}

	clear_static_dispatch_chain_cache() {
		this._static_dispatch_weakmap?.clear ? this._static_dispatch_weakmap.clear() : delete this._static_dispatch_weakmap;
		this._static_dispatch_strongmap?.clear();
	}

	get_static_dispatch_chain(obj) {
		// Properties cannot use handlers
		if(this.is_property)
			throw new ERRORS.internal(`Unreachable: get_static_dispatch_chain with is_property=false`);

		// Obtain dispatch chain
		let dispatch_chain = this._get_static_dispatch_chain_cache(obj);

		// Use the cached dispatch chain, if still valid
		if(!dispatch_chain) {
			dispatch_chain = this.call_wrapped.bind(this, /*state=*/ null, obj);

			// Walk wrappers in reverse order
			const fn_data = this.get_fn_data(false);
			for(let i = fn_data.length-1; i >= 0; i--) {
				const data = fn_data[i];
				const fn = data.fn;

				// OVERRIDE type will usually not continue the chain
				if(!data.chain)
					dispatch_chain = fn.bind(obj, ...(data.bind ?? []));
				// Else, bind the wrapper
				else
					dispatch_chain = fn.bind(obj, dispatch_chain, ...(data.bind ?? []));
			}

			// Cache static dispatch chain
			this._set_static_dispatch_chain_cache(obj, dispatch_chain);
		}

		// Done
		return dispatch_chain;
	}

	_calc_use_static_dispatch() {
		// Properties cannot use static dispatch
		if(this.is_property)
			return false;

		// Do all the wrappers in fn_data specify the same, explicit, performance mode wish?
		let perf_mode = PERF_MODES.AUTO;
		const fn_data = this.get_fn_data(false);

		for(const data of fn_data) {
			if(!data.perf_mode)
				continue;

			if(perf_mode === PERF_MODES.AUTO) {
				perf_mode = data.perf_mode;
			}
			else if(perf_mode !== data.perf_mode) {
				perf_mode = PERF_MODES.AUTO;
				break;
			}
		}

		// Automatic performance mode
		if(perf_mode === PERF_MODES.AUTO) {
			// Default to fast mode if user explicitly enabled it
			if(getHighPerformanceMode())
				perf_mode = PERF_MODES.FAST;

			// Otherwise, default to normal mode
			else
				perf_mode = PERF_MODES.NORMAL;
		}

		// Enable static dispatch only in fast mode
		return perf_mode === PERF_MODES.FAST;
	}

	update_use_static_dispatch() {
		this.use_static_dispatch = this._calc_use_static_dispatch();
	}



	// Wrap/unwrap logic
	_wrap() {
		if(this.active)
			return;

		// Create setter / getter functions
		// Note: We use a trick here to be able to convince the browser to name the method the way we want it
		const getter_nm = this._callstack_name('getter');
		const setter_nm = this._callstack_name('setter');

		const _this = this;
		let obj;

		if(!this.is_property) {
			obj = {
				[getter_nm]: _this._get_handler.bind(_this),

				[setter_nm]: function(value) {
					return _this.set_nonproperty(value, this);
				}
			};
		}
		else {
			obj = {
				[getter_nm]: function(...args) {
					// Trigger listeners
					_this.call_listeners(this, /*is_setter=*/ false, ...args);

					// Call wrappers
					return _this.call_wrapper(null, this, ...args);
				},

				[setter_nm]: function(...args) {
					// Trigger listeners
					_this.call_listeners(this, /*is_setter=*/ true, ...args);

					// Decide what to call next
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

		Log.debug$?.(`Wrapped '${this.name}'.`);
	}

	unwrap() {
		if(!this.active)
			return;

		if(!PROPERTIES_CONFIGURABLE)
			throw new ERRORS.internal(`${PACKAGE_TITLE}: Cannot unwrap when PROPERTIES_CONFIGURABLE==false`);


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

		Log.debug$?.(`Unwrapped '${this.name}'.`);
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
						throw new ERRORS.internal(`This wrapper is set up to wrap a property, but the inherited descriptor is a method.`);

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
			Log.warn$?.(`There is no wrapped method for '${this.name}', returning 'undefined'.`);

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
		if(is_promise(result)) {
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
		if(this._pending_wrapped_calls_cnt <= 0)
			throw new ERRORS.internal(`this._pending_wrapped_calls_cnt=${this._pending_wrapped_calls_cnt} should be unreachable at this point.`);
		this._pending_wrapped_calls_cnt--;

		if(is_dynamic_dispatch) {
			const pend_i = this._pending_wrapped_calls.indexOf(pend);
			if(pend_i < 0)
				throw new ERRORS.internal(`Could not find 'pend' inside 'this._pending_wrapped_calls'.`);

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
				throw new ERRORS.internal(`Must not have 'data===${data}' when 'fn_data.length==${fn_data.length}'.`);

			// There are no wrappers, return the wrapped value.
			return this.call_wrapped(state, obj, ...args);
		}

		// Grab wrapper function from function data object
		const fn = data.fn;

		// OVERRIDE type will usually not continue the chain
		if(!data.chain) {
			// Call next method in the chain
			return fn.call(obj, ...(data.bind ?? []), ...args);
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
			result = fn.call(obj, next_fn, ...(data.bind ?? []), ...args);
		}
		catch(e) {
			return this._cleanup_call_wrapper_thrown(next_state, e);
		}

		// If the result is a Promise, then we must wait until it fulfills before cleaning up.
		// Per the JS spec, the only way to detect a Promise (since Promises can be polyfilled, extended, wrapped, etc) is to look for the 'then' method.
		// Anything with a 'then' function is technically a Promise. This leaves a path for false-positives, but I don't see a way to avoid this.
		if(is_promise(result)) {
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
		if(state.valid === false) {
			throw new ERRORS.invalid_chain(
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
			throw new ERRORS.internal(`Outstanding wrappers = ${this._outstanding_wrappers}, should never fall below 0.`);
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
				let listener_user = false;

				if(collect_affected) {
					affectedPackages = fn_data.slice(next_state.index).filter((x) => {
						return !x.package_info.equals(data.package_info);
					}).map((x) => {
						return x.package_info;
					});

					is_last_wrapper = (affectedPackages.length == 0);

					if(!is_last_wrapper)
						listener_user = LibWrapperConflicts.register_conflict(data.package_info, affectedPackages, this, null, true);
				}

				// WRAPPER-type functions that do this are breaking an API requirement, as such we need to be loud about this.
				// As a "punishment" of sorts, we forcefully unregister them and ignore whatever they did.
				if(data.type === WRAPPER_TYPES.WRAPPER) {
					// We automatically trigger an unhandled error since we don't want to throw
					const error = new ERRORS.package(
						`The wrapper for '${data.target}' registered by ${data.package_info.type_plus_id} with type WRAPPER did not chain the call to the next wrapper, which breaks a libWrapper API requirement. This wrapper will be unregistered.`,
						data.package_info
					);
					onUnhandledError(error);
					Log.error$?.(error);

					// Unregister this module
					globalThis.libWrapper.unregister(data.package_info.id, this.get_id(data.setter));

					// Manually chain to the next wrapper if there are more in the chain
					if(!is_last_wrapper)
						result = next_fn.apply(obj, args);
				}

				// Other WRAPPER_TYPES get a generic 'conflict' message
				else if(listener_user && !data.warned_conflict) {
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



	// Notifications
	call_listeners(obj, is_setter, ...args) {
		// Get list of registered notification functions
		const fn_data = this.get_fn_data(is_setter, true);

		// Loop through notification functions and call them
		for(const data of fn_data) {
			// Grab notification function from function data object
			const fn = data.fn;

			// Call notification function
			fn.call(obj, ...(data.bind ?? []), ...args);
		}
	}



	// Non-property setter
	set_nonproperty(value, obj=null) {
		if(this.is_property)
			throw new ERRORS.internal('Must not call \'set_nonproperty\' for a property wrapper.');

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
			const listener_user = LibWrapperConflicts.register_conflict(package_info, affectedPackages, this, null, true);

			if(listener_user) {
				LibWrapperNotifications.conflict(package_info, affectedPackages, true, `Detected non-libWrapper wrapping of '${this.name}' by ${package_info.type_plus_id}. This will potentially lead to conflicts.`);
				Log.trace();
			}
		}

		if(!this.detected_classic_wrapper)
			this.detected_classic_wrapper = []
		this.detected_classic_wrapper.push(package_info.key);
	}



	// Wraper array methods
	// NOTE: These should only ever be called from libWrapper, they do not clean up after themselves
	get_fn_data(is_setter, is_listener=false, to_modify=false) {
		// to_modify=true must be used any time the fn_data array will be modified.
		// If there are any outstanding wrapper calls, this will force the creation of a copy of the array, to avoid affecting said outstanding wrapper calls.

		// Sanity check
		if(is_setter && !this.is_property)
			throw new ERRORS.internal(`'${this.name}' does not wrap a property, thus is_setter=true is illegal.`);

		// Get current fn_data
		const prop_nm = is_setter ? (is_listener ? 'setter_listener_data' : 'setter_data') : (is_listener ? 'getter_listener_data' : 'getter_data');
		let result = this[prop_nm];

		// If we are going to modify the return result...
		if(to_modify && !is_listener) {
			// Duplicate fn_data if we are modifying it and there are outstanding wrappers
			if(this._outstanding_wrappers > 0) {
				result = this[prop_nm].slice(0);
				this[prop_nm] = result;
			}
		}

		// Done
		return result;
	}

	_post_update_fn_data() {
		this.update_use_static_dispatch();
		this.clear_static_dispatch_chain_cache();
	}

	sort(setter=null, listener=null) {
		if(setter === null && this.is_property) {
			for(const _setter of [false, true])
				this.sort(_setter, listener);
		}
		else if(listener === null) {
			for(const _listener of [false, true])
				this.sort(setter, _listener);
		}
		else {
			if(setter && !this.is_property)
				return;

			let fn_data = this.get_fn_data(setter, listener);
			fn_data.sort((a,b) => { return a.type.value - b.type.value || b.priority - a.priority });
		}
	}

	add(data) {
		// Try to set a function name if there is none already
		const fn = data.fn;
		if(!fn.name || fn.name === 'anonymous')
			set_function_name(fn, this._callstack_name(data.package_info.id ?? '<unknown>'));

		// Add to fn_data
		const is_listener = (data.type == WRAPPER_TYPES.LISTENER);
		const fn_data = this.get_fn_data(data.setter, is_listener, /*to_modify=*/ true);

		fn_data.splice(0, 0, data);
		this.sort(data.setter, is_listener);

		if(!is_listener)
			this._post_update_fn_data();
	}

	remove(data) {
		const is_listener = (data.type == WRAPPER_TYPES.LISTENER);
		const fn_data = this.get_fn_data(data.setter, is_listener, /*to_modify=*/ true);

		const index = fn_data.indexOf(data);
		fn_data.splice(index, 1);

		if(!is_listener)
			this._post_update_fn_data();
	}

	clear() {
		this.getter_data        = [];
		this.getter_listener_data = [];

		if(this.is_property) {
			this.setter_data        = [];
			this.setter_listener_data = [];
		}

		this._post_update_fn_data();
	}

	is_empty() {
		return !this.getter_data         ?.length && !this.setter_data         ?.length &&
		       !this.getter_listener_data?.length && !this.setter_listener_data?.length;
	}
};
decorate_class_function_names(Wrapper);

// Prevent modifications
Object.freeze(Wrapper);