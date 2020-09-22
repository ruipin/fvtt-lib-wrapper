// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {MODULE_ID, MAJOR_VERSION, MINOR_VERSION, PATCH_VERSION, SUFFIX_VERSION, VERSION, parse_manifest_version, IS_UNITTEST, PROPERTIES_CONFIGURABLE, DEBUG, setDebug, TYPES, TYPES_REVERSE, TYPES_LIST} from '../consts.js';
import {Wrapper} from './wrapper.js';
import {AlreadyOverriddenError, get_global_variable, WRAPPERS} from './utilities.js';
import {LibWrapperStats} from '../stats.js';
import {LibWrapperSettings} from '../settings.js';

// Local variables
let libwrapper_ready = false;
let allow_libwrapper_registrations = true;

// Manager class
export const PRIORITIES = new Map();

export class libWrapper {
	// Properties
	static get version() { return VERSION; }
	static get versions() { return [MAJOR_VERSION, MINOR_VERSION, PATCH_VERSION, SUFFIX_VERSION]; }
	static get is_fallback() { return false; }

	static get debug() { return DEBUG; }
	static set debug(value) { setDebug(value) }

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
	 * Important: If called before the 'init' hook, this method will fail.
	 *
	 * In addition to wrapping class methods, there is also support for wrapping methods on specific object instances, as well as class methods inherited from parent classes.
	 * However, it is recommended to wrap methods directly in the class that defines them whenever possible, as inheritance/instance wrapping is less thoroughly tested and will incur a performance penalty.
	 * Note: The provided compatibility shim does not support instance-specific nor inherited-method wrapping.
	 *
	 * @param {string} module  The module identifier, i.e. the 'name' field in your module's manifest.
	 * @param {string} target  A string containing the path to the function you wish to add the wrapper to, starting at global scope, for example 'SightLayer.prototype.updateToken'.
	 *                         This works for both normal methods, as well as properties with getters. To wrap a property's setter, append '#set' to the name, for example 'SightLayer.prototype.blurDistance#set'.
	* @param {function} fn    Wrapper function. The first argument will be the next function in the chain, except for 'OVERRIDE' wrappers.
	*                         The remaining arguments will correspond to the parameters passed to the wrapped method.
	 * @param {string} type    [Optional] The type of the wrapper. Default is 'MIXED'. The possible types are:
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
	 *     Use if your wrapper will *never* call the next function in the chain. This type has the lowest priority, and will always be called last.
	 *     If another module already has an 'OVERRIDE' wrapper registered to the same method, using this type will throw a <AlreadyOverriddenError> exception.
	 *     Catching this exception should allow you to fail gracefully, and for example warn the user of the conflict.
	 *     Note that if the GM has explicitly given your module priority over the existing one, no exception will be thrown and your wrapper will take over.
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
};
Object.freeze(libWrapper);


// Define as property so that it can't be deleted
delete globalThis.libWrapper;
Object.defineProperty(globalThis, 'libWrapper', {
	get: () => libWrapper,
	set: (value) => { throw `libWrapper: Not allowed to re-assign the global instance of libWrapper` },
	configurable: false
});


// Initialize libWrapper right before the 'init' hook. Unit tests just initialize immediately
if(!IS_UNITTEST) {
	libWrapper.register('lib-wrapper', 'Game.prototype.initialize', function(wrapped, ...args) {
		// Notify everyone the library has loaded and is ready to start registering wrappers
		libwrapper_ready = true;

		parse_manifest_version();
		LibWrapperSettings.init();
		LibWrapperStats.init();
		libWrapper.load_priorities();

		console.info(`libWrapper ${VERSION}: Ready.`);
		Hooks.callAll('libWrapperReady', libWrapper);

		const result = wrapped(...args);

		libWrapper.unregister('lib-wrapper', 'Game.prototype.initialize');

		return result;
	}, 'WRAPPER');
}
else {
	libwrapper_ready = true;
}


// Lock down registrations using module 'lib-wrapper'
allow_libwrapper_registrations = false;