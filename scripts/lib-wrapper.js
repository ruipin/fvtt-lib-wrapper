// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {MODULE_ID, MAJOR_VERSION, MINOR_VERSION, PATCH_VERSION, SUFFIX_VERSION, VERSION} from './consts.js';
import {get_global_variable} from './get_global_variable.js';
import {LibWrapperStats} from './stats.js';
import {LibWrapperSettings} from './settings.js';


// Debug
let DEBUG = false;
let PROPERTIES_CONFIGURABLE = true;


// TYPES
export const TYPES_LIST = ['WRAPPER', 'MIXED', 'OVERRIDE'];
Object.freeze(TYPES_LIST);

export const TYPES = {
	WRAPPER : 1,
	MIXED   : 2,
	OVERRIDE: 3
};
Object.freeze(TYPES);

export const TYPES_REVERSE = {};
for(let key in TYPES) {
	TYPES_REVERSE[TYPES[key]] = key;
}
Object.freeze(TYPES_REVERSE);


// Internal variables
let allow_libwrapper_registrations = true;
let libwrapper_ready = false;


// Handler class - owns the function that is returned by the wrapper class
class Handler {
	constructor(fn) {
		this.set(fn);

		let _this = this;
		this.fn = function() {
			return _this._fn(this, ...arguments);
		};
	}

	set(fn) {
		this._fn = fn;
	}
}
Object.freeze(Handler);


// Wrapper class - this class is responsible for the actual wrapping
class Wrapper {
	// Properties
	get name() {
		return this.names[0];
	}

	get is_property() {
		return this._wrapped_getter;
	}

	// Constructor
	constructor (obj, fn_name, name=undefined) {
		// Check if this object is already wrapped
		let descriptor = Object.getOwnPropertyDescriptor(obj, fn_name);

		if(descriptor) {
			if(descriptor.get?._lib_wrapper) {
				let wrapper = descriptor.get?._lib_wrapper;

				if(name && !wrapper.names.indexOf(name))
					wrapper.names.push(name);

				if(wrapper && wrapper instanceof this.constructor)
					return wrapper;
			}

			if(descriptor.configurable === false) {
				throw `libWrapper: '${name}' cannot be wrapped, the corresponding descriptor has 'configurable=false'.`;
			}
			else {
				if(descriptor.get) {
					this._wrapped_getter = descriptor.get;
					this._wrapped_setter = descriptor.set;
				}
				else
					this._wrapped = descriptor.value;
			}
		}
		else {
			this._wrapped = undefined;
		}

		// Setup instance variables
		this.object  = obj;
		this.names   = [];
		this.fn_name = fn_name;

		this.getter_data = [];
		if(this.is_property)
			this.setter_data = [];

		this.active  = false;

		this._modification_counter = 1;
		this._warned_detected_classic_wrapper = false;

		// Add name
		if(!name)
			name = fn_name;

		if(this.names.indexOf(name) == -1)
			this.names.push(name);

		// Do actual wrapping
		this._wrap();
	}

	_create_handler() {
		this.handler = new Handler(this.call_wrapper.bind(this, null));
	}

	_wrap() {
		if(this.active)
			return;

		// Setup setter/getter
		let getter = null;
		let setter = null;

		if(!this.is_property) {
			// Create a handler
			if(!this.handler)
				this._create_handler();

			// Setup setter / getter
			let _this = this;

			getter = function() {
				return _this.handler.fn;
			};

			setter = function(value) {
				return _this.set_nonproperty(value, this);
			};
		}
		else {
			// Setup setter / getter
			let _this = this;

			getter = function() {
				return _this.call_wrapper(null, this);
			}

			setter = function(value) {
				return _this.call_wrapper({setter: true}, this, value);
			};
		}

		// Store a reference to this in the getter so that we can support 'singleton'-like functionality
		getter._lib_wrapper = this;

		// Define a property with a getter/setter
		Object.defineProperty(this.object, this.fn_name, {
			get: getter,
			set: setter,
			configurable: PROPERTIES_CONFIGURABLE
		});

		this.active = true;

		if(DEBUG)
			console.info(`libWrapper: Wrapped '${this.name}'.`);
	}

	unwrap() {
		if(!this.active)
			return;

		if(!PROPERTIES_CONFIGURABLE)
			throw `libWrapper: Cannot unwrap when PROPERTIES_CONFIGURABLE==false`;


		// Kill the handler
		if(this.handler) {
			let _fn_name = this.fn_name;

			this.handler.set(function(obj, ...args) {
				return obj[_fn_name].apply(obj, args);
			});
		}
		this.handler = null

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

		if(DEBUG)
			console.info(`libWrapper: Unwrapped '${this.name}'.`);
	}


	// Getter/setters
	_get_parent_wrapper() {
		let descriptor = Object.getOwnPropertyDescriptor(this.object.constructor.prototype, this.methodName);
		let wrapper = descriptor?.get?._lib_wrapper;

		if(wrapper && wrapper != this)
			return wrapper;

		return null;
	}

	get_wrapped(obj, setter=false) {
		// If 'obj' is not this.object, then we need to see if it has a local wrapper
		if(obj && obj != this.object) {
			let descriptor = Object.getOwnPropertyDescriptor(obj, this.methodName);

			let wrapper = descriptor?.get?._lib_wrapper;
			if(wrapper)
				return wrapper.get_wrapped(obj);
		}

		// Otherwise we just return our wrapped value
		if(this.is_property)
			return setter ? this._wrapped_setter : this._wrapped_getter;
		else
			return this._wrapped;
	}

	call_wrapper(state, obj, ...args) {
		// Keep track of call state
		if(state) {
			if('valid' in state && !state.valid)
				throw `libWrapper: This wrapper function is no longer valid.`;
			if('called' in state && state.called)
				throw `libWrapper: This wrapper function has already been called.`;
			if('modification_counter' in state && state.modification_counter != this._modification_counter)
				throw `libWrapper: The wrapper '${this.name}' was modified while a call chain was in progress. The chain is not allowed proceed.`;

			state.called = true;
		}

		// Grab the next function from the function data array
		const index = state?.index ?? 0;
		const is_setter = state?.setter ?? false;
		const fn_data = is_setter ? this.setter_data : this.getter_data;
		const data = fn_data[index];
		let fn = data?.fn;

		// If no more methods exist, then finish the chain
		if(!data) {
			// We need to call parent wrappers if they exist
			// Otherwise, we can immediately return the wrapped value
			let parent_wrapper = this._get_parent_wrapper();

			if(parent_wrapper && parent_wrapper != this)
				return parent_wrapper.call_wrapper(null, obj, ...arguments);
			else
				return this.get_wrapped(obj, is_setter)?.apply(obj, args);
		}

		// OVERRIDE type does not continue the chain
		if(data.type >= TYPES.OVERRIDE) {
			// Call next method in the chain
			return fn.apply(obj, args);
		}

		// Prepare the continuation of the chain
		const next_state = {
			setter: is_setter,
			called: false,
			valid : true,
			index : index + 1,
			modification_counter: this._modification_counter
		};

		const next_fn = this.call_wrapper.bind(this, next_state, obj);

		let result = undefined;
		try {
			// Call next method in the chain
			result = fn.call(obj, next_fn, ...args);
		}
		finally {
			// Mark next_fn as invalid to prevent someone from calling it asynchronously
			next_state.valid = false;
		}

		// Check that next_fn was called
		if(!next_state.called && next_state.modification_counter == this._modification_counter) {
			let collect_information = (LibWrapperStats.collect_stats || !data.warned_conflict);
			let affectedModules = null;
			let is_last_wrapper = false;

			if(collect_information) {
				affectedModules = fn_data.slice(next_state.index).filter((x) => {
					return x.module != data.module;
				}).map((x) => {
					return x.module;
				});
				is_last_wrapper = (affectedModules.length == 0);

				if(LibWrapperStats.collect_stats) {
					affectedModules.forEach((affected) => {
						LibWrapperStats.register_conflict(data.module, affected, this.name);
					});
				}
			}

			// WRAPPER-type functions that do this are breaking an API requirement, as such we need to be loud about this.
			// As a "punishment" of sorts, we forcefully unregister them and ignore whatever they did.
			if(data.type == TYPES.WRAPPER) {
				console.error(`libWrapper: The wrapper for '${data.target}' registered by module '${data.module}' with type WRAPPER did not chain the call to the next wrapper, which breaks a libWrapper API requirement. This wrapper will be unregistered.`);
				libWrapper.unregister(data.module, data.target);

				// Manually chain to the next wrapper if there are more in the chain
				if(!is_last_wrapper) {
					next_state.index = index;
					next_state.valid = true;
					next_state.modification_counter = this._modification_counter;
					return next_fn.apply(obj, args);
				}
			}

			// Other TYPES only get a single log line
			else if(collect_information && (DEBUG || !data.warned_conflict) && !is_last_wrapper) {
				console.warn(`libWrapper: Possible conflict detected between '${data.module}' and [${affectedModules.join(', ')}]. The former did not chain the wrapper for '${data.target}'.`);
				data.warned_conflict = true;
			}
		}

		// Done
		return result;
	}

	set_nonproperty(value, obj=null, reuse_handler=false) {
		// If assigning to an instance directly, create a wrapper for the instance
		if(obj != this.object) {
			let objWrapper = new this.constructor(obj, this.fn_name, `instanceof ${this.name}`);
			objWrapper.set_nonproperty(value, obj, true);
			return;
		}

		// Redirect current handler to directly call the wrapped method
		if(!reuse_handler)
		{
			let wrapped = this._wrapped;

			this.handler.set(function(obj, ...args) {
				return wrapped.apply(obj, args);
			});

			this._create_handler();
		}

		// Wrap the new value and create a new handler
		this._wrapped = value;


		{
			if(LibWrapperStats.collect_stats) {
				const affectedModules = this.getter_data.map((x) => {
					return x.module;
				});

				affectedModules.forEach((affected) => {
					LibWrapperStats.register_conflict(affected, '<non-libWrapper>', this.name);
				});
			}

			if(DEBUG || !this.detected_classic_wrapper) {
				console.warn(`libWrapper: Detected non-libWrapper wrapping of '${this.name}'. This indicates a possible conflict with non-libWrapper modules.`);

				if(DEBUG && console.trace)
					console.trace();
			}

			this.detected_classic_wrapper = true;
		}
	}


	// Wraper array methods
	// NOTE: These should only ever be called from libWrapper, they do not clean up after themselves
	get_fn_data(setter) {
		if(setter && !this.is_property)
			throw `libWrapper: '${this.name}' does not wrap a property, thus setter=true is illegal.`;

		return setter ? this.setter_data : this.getter_data;
	}

	sort() {
		for(let setter of [false, true]) {
			if(setter && !this.is_property)
				continue;

			let fn_data = this.get_fn_data(setter);
			fn_data.sort((a,b) => { return a.type - b.type || b.priority - a.priority });
		}
	}

	add(data) {
		const fn_data = this.get_fn_data(data.setter);

		fn_data.splice(0, 0, data);
		this.sort(data.setter);

		this._modification_counter++;
	}

	remove(data) {
		const fn_data = this.get_fn_data(data.setter);

		const index = fn_data.indexOf(data);
		fn_data.splice(index, 1);

		this._modification_counter++;
	}

	clear() {
		this.getter_data = [];

		if(this.is_property)
			this.setter_data = [];

		this._modification_counter++;
	}

	is_empty() {
		return !this.getter_data.length && !this.setter_data?.length;
	}
};
Object.freeze(Wrapper);


// Already overridden Error type
class AlreadyOverriddenError extends Error {
	constructor(module, target, conflicting_module, ...args) {
		super(`libWrapper: Failed to wrap '${target}' for module '${module}' with type OVERRIDE. The module '${conflicting_module}' has already registered an OVERRIDE wrapper for the same method.`, ...args);

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace)
			Error.captureStackTrace(this, AlreadyOverriddenError)

		this.name = 'AlreadyOverriddenError';

		// Custom debugging information
		this.module = module;
		this.target = target;
		this.conflicting_module = conflicting_module;
	}

	/**
	 * Returns the title of the module that caused the wrapping conflict
	 */
	get conflicting_module_title() {
		return game.modules.get(this.conflicting_module)?.data?.title;
	}
}


// Manager class
export const WRAPPERS = new Set();
export const PRIORITIES = new Map();

export class libWrapper {
	// Properties
	static get version() { return VERSION; }
	static get versions() { return [MAJOR_VERSION, MINOR_VERSION, PATCH_VERSION, SUFFIX_VERSION]; }
	static get is_fallback() { return false; }

	static get debug() { return DEBUG; }
	static set debug(value) { DEBUG = !!value; }

	static get AlreadyOverriddenError() { return AlreadyOverriddenError; };


	// Variables
	static wrappers = WRAPPERS;

	// Utilities
	static _create_wrapper_from_object(obj, fn_name, name=undefined) {
		const wrapper = new Wrapper(obj, fn_name, name);
		this.wrappers.add(wrapper);
		return wrapper;
	}

	static _split_target_and_setter(target) {
		let is_setter = target.endsWith('#set');
		let _target = !is_setter ? target : target.slice(0, -4);

		return [_target, is_setter];
	}

	static _get_target_object(_target) {
		const target = this._split_target_and_setter(_target)[0];

		const split = target.split('.');
		const fn_name = split.pop();

		// Get root object
		const root_nm = split.splice(0,1)[0];
		const root = get_global_variable(root_nm);

		// Get target object
		let obj = root;
		for(let scope of split) {
			obj = obj[scope];
			if(!obj)
				throw `libWrapper: Invalid target '${target}'`;
		}

		return [obj, fn_name, target];
	}

	static _create_wrapper(target) {
		// Create wrapper
		return this._create_wrapper_from_object(...this._get_target_object(target));
	}

	static _find_wrapper_by_name(_name) {
		const name = this._split_target_and_setter(_name)[0];

		for(let wrapper of this.wrappers) {
			if(wrapper.names.indexOf(name) != -1)
				return wrapper;
		}

		return null;
	}

	static _find_module_data_in_wrapper(module, wrapper, is_setter) {
		return wrapper.get_fn_data(is_setter).find((x) => { return x.module == module; });
	}

	static _find_module_data_with_target(module, _target) {
		const target_and_setter = this._split_target_and_setter(_target);
		const target    = target_and_setter[0];
		const is_setter = target_and_setter[1];

		const wrapper = this._find_wrapper_by_name(target);
		if(!wrapper)
			return null;

		return this._find_module_data_in_wrapper(module, wrapper, is_setter);
	}

	static _get_default_priority(module, target) {
		if(module === MODULE_ID)
			return Number.MAX_VALUE;

		const priority_cfg = PRIORITIES.get(module);
		if(priority_cfg !== undefined)
			return priority_cfg;

		return 0;
	}


	static _unwrap_if_possible(wrapper) {
		if(wrapper.is_empty() && PROPERTIES_CONFIGURABLE) {
			wrapper.unwrap();
			this.wrappers.delete(wrapper);
		}
	}

	static _clear(target) {
		const wrapper = this._find_wrapper_by_name(target);

		if(wrapper) {
			wrapper.clear();
			this._unwrap_if_possible(wrapper);

			console.info(`libWrapper: Cleared all wrapper functions for '${target}'.`);
		}
	}


	static _unwrap_all() {
		for(let wrapper of this.wrappers) {
			wrapper.clear();
			wrapper.unwrap();
		}

		this.wrappers.clear();
	}


	static load_priorities(value=null) {
		PRIORITIES.clear();

		// Parse config
		const priority_cfg = value ?? game?.settings?.get(MODULE_ID, 'module-priorities');
		if(!priority_cfg)
			return;

		for(let type of ['prioritized', 'deprioritized']) {
			const current = priority_cfg[type];
			const base_priority = (type == 'prioritized') ? 10000 : -10000;

			if(!current)
				continue;

			Object.entries(current).forEach(entry => {
				const [module_id, module_info] = entry;

				if(PRIORITIES.has(module_id))
					return;

				PRIORITIES.set(module_id, base_priority - module_info.index);
			});
		}
	}


	// Public interface

	/**
	 * Register a new wrapper.
	 * Important: If called before the 'setup' hook, this method will fail.
	 *
	 * @param {string} module  The module identifier, i.e. the 'name' field in your module's manifest.
	 * @param {string} target  A string containing the path to the function you wish to add the wrapper to, starting at global scope, for example 'SightLayer.prototype.updateToken'.
	 *                         This works for both normal methods, as well as properties with getters. To wrap a property's setter, append '#set' to the name, for example 'SightLayer.prototype.blurDistance#set'.
	 * @param {function} fn    Wrapper function. When called, the first parameter will be the next function in the chain.
	 * @param {string} type    The type of the wrapper. Default is 'MIXED'. The possible types are:
	 *
	 *   'WRAPPER':
	 *     Use if your wrapper will always call the next function in the chain.
	 *     This type has priority over every other type. It should be used whenever possible as it massively reduces the likelihood of conflicts.
	 *     Note that the library will auto-detect if you use this type but do not call the original function, and automatically unregister your wrapper.
	 *
	 *   'MIXED':
	 *     Default type. Your wrapper will be allowed to decide whether it should call the next function in the chain or not.
	 *     These will always come after 'WRAPPER'-type wrappers. Order is not guaranteed, but conflicts will be auto-detected.
	 *
	 *   'OVERRIDE':
	 *     Use if your wrapper never calls the next function in the chain. This type has the lowest priority, and will always be called last.
	 *     If another module already has an 'OVERRIDE' wrapper registered to the same method, using this type will throw a <AlreadyOverriddenError> exception.
	 *     This should allow you to fail gracefully, and for example warn the user of the conflict.
	 */
	static register(module, target, fn, type='MIXED') {
		if(module != MODULE_ID && !libwrapper_ready)
			throw `libWrapper: Not allowed to register wrappers before the 'libWrapperReady' hook fires`;

		// Validate module
		if(module != MODULE_ID && !game.modules.get(module)?.active)
			throw `libWrapper: '${module}' is not a valid module`;

		if(module == MODULE_ID && !allow_libwrapper_registrations)
			throw `libWrapper: Not allowed to register wrappers using '${module}'.`;

		// Validate arguments
		if(!fn || !(fn instanceof Function))
			throw `libWrapper: Parameter 'fn' must be a function.`;

		type = TYPES[type.toUpperCase()];
		if(typeof type === 'undefined' || !(type in TYPES_REVERSE))
			throw `libWrapper: Parameter 'type' must be one of [${TYPES_LIST.join(', ')}].`;

		// Split '#set' from the target
		const target_and_setter  = this._split_target_and_setter(target);
		const target_without_set = target_and_setter[0];
		const is_setter          = target_and_setter[1];

		// Create wrapper
		let wrapper = this._create_wrapper(target);

		// Check if this wrapper is already registered
		if(this._find_module_data_in_wrapper(module, wrapper, is_setter))
			throw `libWrapper: '${module}' has already registered a wrapper for '${target}'.`;

		// Only allow '#set' when the wrapper is wrapping a property
		if(is_setter && !wrapper.is_property)
			throw `libWrapper: Cannot register a wrapper for '${target}' by '${module}' because '${target_without_set}' is not a property, and therefore has no setter.`

		// Get priority
		const priority = this._get_default_priority(module, target);

		// Only allow one 'OVERRIDE' type
		if(type == TYPES.OVERRIDE) {
			const existing = wrapper.get_fn_data(is_setter).find((x) => { return x.type == TYPES.OVERRIDE });

			if(existing) {
				if(priority <= existing.priority) {
					LibWrapperStats.register_conflict(existing.module, module, wrapper.name);
					throw new AlreadyOverriddenError(module, target, existing.module);
				}
				else {
					LibWrapperStats.register_conflict(module, existing.module, wrapper.name);
					console.warn(`libWrapper: Conflict detected between '${module}' and '${existing.module}'. The former has higher priority, and is replacing the OVERRIDE registered by the latter for '${wrapper.name}'.`);
				}
			}
		}

		// Register this module as having wrapped something
		if(module != MODULE_ID)
			LibWrapperStats.register_module(module);

		// Wrap
		let data = {
			module  : module,
			target  : target,
			setter  : is_setter,
			fn      : fn,
			type    : type,
			wrapper : wrapper,
			priority: priority
		};

		wrapper.add(data);

		// Done
		if(DEBUG || module != MODULE_ID)
			console.info(`libWrapper: Registered a wrapper for '${target}' by '${module}' with type ${TYPES_REVERSE[type]}.`);
	}

	/**
	 * Unregister an existing wrapper.
	 * Please do not use this to remove other module's wrappers.
	 *
	 * @param {string} module    The module identifier, i.e. the 'name' field in your module's manifest.
	 * @param {string} target    A string containing the path to the function you wish to remove the wrapper from, starting at global scope. For example: 'SightLayer.prototype.updateToken'
	 * @param {function} fail    [Optional] If true, this method will throw an exception if it fails to find the method to unwrap. Default is 'true'.
	 */
	static unregister(module, target, fail=true) {
		// Find wrapper
		const data = this._find_module_data_with_target(module, target);
		if(!data) {
			if(fail)
				throw `libWrapper: Cannot unregister '${target}' by '${module}' as no such wrapper has been registered`;
			return;
		}

		const wrapper = data.wrapper;

		// Remove from fn_data
		wrapper.remove(data);
		this._unwrap_if_possible(wrapper);

		// Done
		if(DEBUG || module != MODULE_ID)
			console.info(`libWrapper: Unregistered the wrapper for '${target}' by '${module}'.`);
	}

	/**
	 * Clear all wrappers created by a given module.
	 * Please do not use this to remove other module's wrappers.
	 *
	 * @param {string} module    The module identifier, i.e. the 'name' field in your module's manifest.
	 */
	static clear_module(module) {
		for(let wrapper of this.wrappers) {
			this.unregister(module, wrapper.name, false);

			if(wrapper.is_property)
				this.unregister(module, `${wrapper.name}#set`, false);
		}

		console.info(`libWrapper: Cleared all wrapper functions by module '${module}'.`);
	}

	/**
	 * Register a callback to be called once the libWrapper library is ready. If it is already ready, the callback gets called immediately.
	 *
	 * @param {function} callback   The callback. The first argument will be the libWrapper instance.
	 */
	static once_ready(callback) {
		if(!libwrapper_ready)
			return Hooks.once('libWrapperReady', callback);

		callback(this);
	}
};
Object.freeze(libWrapper);


// Make library available in the global scope or export it for unit testing
export default libWrapper;

// Define as property so that it can't be deleted
delete globalThis.libWrapper;
Object.defineProperty(globalThis, 'libWrapper', {
	get: () => libWrapper,
	set: (value) => { throw `libWrapper: Not allowed to re-assign the global instance of libWrapper` },
	configurable: false
});


// Detect game 'setup'
if(typeof Game !== 'undefined') {
	libWrapper.register('lib-wrapper', 'Game.prototype.initialize', function(wrapper, ...args) {
		// Notify everyone the library has loaded and is ready to start registering wrappers
		libwrapper_ready = true;

		LibWrapperSettings.init();
		LibWrapperStats.init();
		libWrapper.load_priorities();

		console.info(`libWrapper ${VERSION}: Ready.`);
		Hooks.callAll('libWrapperReady', libWrapper);

		const result = wrapper.apply(this, args);

		libWrapper.unregister('lib-wrapper', 'Game.prototype.initialize');

		return result;
	}, 'WRAPPER');
}
else {
	libwrapper_ready = true;
}


// Lock down registrations using module 'lib-wrapper'
allow_libwrapper_registrations = false;