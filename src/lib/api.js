// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {
	MODULE_ID, MAJOR_VERSION, MINOR_VERSION, PATCH_VERSION, SUFFIX_VERSION, META_VERSION, VERSION, parse_manifest_version,
	IS_UNITTEST, PROPERTIES_CONFIGURABLE, DEBUG, setDebug,
	TYPES, TYPES_REVERSE, TYPES_LIST,
	PERF_MODES, PERF_MODES_REVERSE, PERF_MODES_LIST
} from '../consts.js';
import {Wrapper} from './wrapper.js';
import {init_error_listeners, LibWrapperError, LibWrapperModuleError, LibWrapperAlreadyOverriddenError, LibWrapperInvalidWrapperChainError, LibWrapperInternalError, onUnhandledError} from '../utils/errors.js';
import {get_global_variable, get_current_module_name, WRAPPERS, decorate_name, decorate_class_function_names} from '../utils/misc.js';
import {LibWrapperNotifications} from '../ui/notifications.js'
import {LibWrapperStats} from '../ui/stats.js';
import {LibWrapperSettings, PRIORITIES} from '../ui/settings.js';

// Internal variables
let libwrapper_ready = false;
let allow_libwrapper_registrations = true;


// Internal Methods
export function _create_wrapper_from_object(obj, fn_name, name=undefined, module=undefined) {
	const wrapper = new Wrapper(obj, fn_name, name, module);
	WRAPPERS.add(wrapper);
	return wrapper;
}

function _split_target_and_setter(target) {
	let is_setter = target.endsWith('#set');
	let _target = !is_setter ? target : target.slice(0, -4);

	return [_target, is_setter];
}

function _valid_identifier(ident) {
	return /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(ident);
}

function _get_target_object(_target, module=undefined) {
	// Parse the target
	const target = _split_target_and_setter(_target)[0];

	const split = target.split('.');
	const fn_name = split.pop();

	// Get root object
	const root_nm = split.splice(0,1)[0];
	if(!_valid_identifier(root_nm))
		throw new LibWrapperModuleError(`Invalid target '${target}.'`, module);
	if(root_nm == 'libWrapper')
		throw new LibWrapperModuleError(`Not allowed to wrap libWrapper internals.`, module);

	const root = get_global_variable(root_nm);
	if(!root)
		throw new LibWrapperModuleError(`Could not find target '${target}'.`, module);

	// Get target object
	let obj = root;
	for(let scope of split) {
		if(!_valid_identifier(scope))
			throw new LibWrapperModuleError(`Invalid target '${target}'.`, module);

		obj = obj[scope];
		if(!obj)
			throw new LibWrapperModuleError(`Could not find target '${target}'.`, module);
	}

	return [obj, fn_name, target];
}

function _create_wrapper(target, module=null) {
	// Create wrapper
	return _create_wrapper_from_object(..._get_target_object(target), module);
}

function _find_wrapper_by_name(_name) {
	const name = _split_target_and_setter(_name)[0];

	for(let wrapper of WRAPPERS) {
		if(wrapper.names.indexOf(name) != -1)
			return wrapper;
	}

	return null;
}

function _find_module_data_in_wrapper(module, wrapper, is_setter) {
	return wrapper.get_fn_data(is_setter).find((x) => { return x.module == module; });
}

function _find_module_data_with_target(module, _target) {
	const target_and_setter = _split_target_and_setter(_target);
	const target    = target_and_setter[0];
	const is_setter = target_and_setter[1];

	const wrapper = _find_wrapper_by_name(target);
	if(!wrapper)
		return null;

	return _find_module_data_in_wrapper(module, wrapper, is_setter);
}

function _get_default_priority(module, target) {
	if(module === MODULE_ID)
		return Number.MAX_VALUE;

	const priority_cfg = PRIORITIES.get(module);
	if(priority_cfg !== undefined)
		return priority_cfg;

	return 0;
}


function _unwrap_if_possible(wrapper) {
	if(wrapper.is_empty() && PROPERTIES_CONFIGURABLE) {
		wrapper.unwrap();
		WRAPPERS.delete(wrapper);
	}
}

export function _clear(target) {
	const wrapper = _find_wrapper_by_name(target);

	if(wrapper) {
		wrapper.clear();
		_unwrap_if_possible(wrapper);

		console.info(`libWrapper: Cleared all wrapper functions for '${target}'.`);
	}
}

export function _unwrap_all() {
	for(let wrapper of WRAPPERS) {
		wrapper.clear();
		wrapper.unwrap();
	}

	WRAPPERS.clear();
}

function _validate_module(module) {
	const real_module = get_current_module_name();

	if(!module || typeof module !== 'string')
		throw new LibWrapperModuleError('Parameter \'module\' must be a string.', real_module);

	if(module == MODULE_ID) {
		if(!allow_libwrapper_registrations)
			throw new LibWrapperModuleError(`Not allowed to call libWrapper with module='${module}'.`, real_module);
	}
	else {
		if(module != game.data.system.id && !game.modules.get(module)?.active)
			throw new LibWrapperModuleError(`Module '${module}' is not a valid module.`, real_module);
	}

	if(real_module && module != real_module)
		throw new LibWrapperModuleError(`Module '${real_module}' is not allowed to call libWrapper with module='${module}'.`, real_module);
}

let FORCE_FAST_MODE = false;
function _force_fast_mode(new_fast_mode) {
	FORCE_FAST_MODE = new_fast_mode;
}



// Publicly exposed class
export class libWrapper {
	// Properties
	/**
	 * Get libWrapper version
	 * @returns {string}  libWrapper version in string form, i.e. "<MAJOR>.<MINOR>.<PATCH>.<SUFFIX><META>"
	 */
	static get version() { return VERSION; }

	/**
	 * Get libWrapper version
	 * @returns {[number,number,number,number,string]}  libWrapper version in array form, i.e. [<MAJOR>, <MINOR>, <PATCH>, <SUFFIX>, <META>]
	 */
	static get versions() { return [MAJOR_VERSION, MINOR_VERSION, PATCH_VERSION, SUFFIX_VERSION, META_VERSION]; }

	/**
	 * @returns {boolean}  The real libWrapper module will always return false. Fallback implementations (e.g. poly-fill / shim) should return true.
	 */
	static get is_fallback() { return false; }

	/**
	 * @returns {boolean}  Whether libWrapper is in debug mode.
	 */
	static get debug() { return DEBUG; }
	/**
	 * @param {boolean} value  Whether to enable or disable libWrapper debug mode.
	 */
	static set debug(value) { setDebug(value) }

	// Errors
	static get LibWrapperError() { return LibWrapperError; };
	static get Error() { return LibWrapperError; }

	static get LibWrapperInternalError() { return LibWrapperInternalError; };
	static get InternalError() { return LibWrapperInternalError; }

	static get LibWrapperModuleError() { return LibWrapperModuleError; };
	static get ModuleError() { return LibWrapperModuleError; };

	static get LibWrapperAlreadyOverriddenError() { return LibWrapperAlreadyOverriddenError; };
	static get AlreadyOverriddenError() { return LibWrapperAlreadyOverriddenError; };

	static get LibWrapperInvalidWrapperChainError() { return LibWrapperInvalidWrapperChainError; };
	static get InvalidWrapperChainError() { return LibWrapperInvalidWrapperChainError; };

	static get onUnhandledError() { return onUnhandledError; };


	// Methods
	/**
	 * Test for a minimum libWrapper version.
	 * First introduced in v1.4.0.0.
	 *
	 * @param {number} major   Minimum major version
	 * @param {number} minor   [Optional] Minimum minor version. Default is 0.
	 * @param {number} patch   [Optional] Minimum patch version. Default is 0.
	 * @param {number} suffix  [Optional] Minimum suffix version. Default is 0.
	 * @returns {boolean}      Returns true if the libWrapper version is at least the queried version, otherwise false.
	 */
	static version_at_least(major, minor=0, patch=0, suffix=0) {
		if(MAJOR_VERSION == major) {
			if(MINOR_VERSION == minor) {
				if(PATCH_VERSION == patch) {
					return SUFFIX_VERSION == suffix;
				}

				return PATCH_VERSION >= patch;
			}

			return MINOR_VERSION > minor;
		}
		return MAJOR_VERSION > major;
	}

	/**
	 * Register a new wrapper.
	 * Important: If called before the 'init' hook, this method will fail.
	 *
	 * In addition to wrapping class methods, there is also support for wrapping methods on specific object instances, as well as class methods inherited from parent classes.
	 * However, it is recommended to wrap methods directly in the class that defines them whenever possible, as inheritance/instance wrapping is less thoroughly tested and will incur a performance penalty.
	 *
	 * Triggers FVTT hook 'libWrapper.Register' when successful.
	 *
	 * @param {string} module  The module identifier, i.e. the 'name' field in your module's manifest.
	 * @param {string} target  A string containing the path to the function you wish to add the wrapper to, starting at global scope, for example 'SightLayer.prototype.updateToken'.
	 *                         This works for both normal methods, as well as properties with getters. To wrap a property's setter, append '#set' to the name, for example 'SightLayer.prototype.blurDistance#set'.
	 * @param {function} fn    Wrapper function. The first argument will be the next function in the chain, except for 'OVERRIDE' wrappers.
	 *                         The remaining arguments will correspond to the parameters passed to the wrapped method.
	 * @param {string} type    [Optional] The type of the wrapper. Default is 'MIXED'.
	 *
	 *   The possible types are:
	 *
	 *   'WRAPPER':
	 *     Use if your wrapper will *always* call the next function in the chain.
	 *     This type has priority over every other type. It should be used whenever possible as it massively reduces the likelihood of conflicts.
	 *     Note that the library will auto-detect if you use this type but do not call the original function, and automatically unregister your wrapper.
	 *
	 *   'MIXED':
	 *     Default type. Your wrapper will be allowed to decide whether it should call the next function in the chain or not.
	 *     These will always come after 'WRAPPER'-type wrappers. Order is not guaranteed, but conflicts will be auto-detected.
	 *
	 *   'OVERRIDE':
	 *     Use if your wrapper will *never* call the next function in the chain. This type has the lowest priority, and will always be called last.
	 *     If another module already has an 'OVERRIDE' wrapper registered to the same method, using this type will throw a <libWrapper.LibWrapperAlreadyOverriddenError> exception.
	 *     Catching this exception should allow you to fail gracefully, and for example warn the user of the conflict.
	 *     Note that if the GM has explicitly given your module priority over the existing one, no exception will be thrown and your wrapper will take over.
	 *
	 * @param {Object} options [Optional] Additional options to libWrapper.
	 *
	 * @param {boolean} options.chain [Optional] If 'true', the first parameter to 'fn' will be a function object that can be called to continue the chain.
	 *   Default is 'false' if type=='OVERRIDE', otherwise 'true'.
	 *   First introduced in v1.3.6.0.
	 *
	 * @param {string} options.perf_mode [OPTIONAL] Selects the preferred performance mode for this wrapper. Default is 'AUTO'.
	 *   It will be used if all other wrappers registered on the same target also prefer the same mode, otherwise the default will be used instead.
	 *   This option should only be specified with good reason. In most cases, using 'AUTO' in order to allow the GM to choose is the best option.
	 *   First introduced in v1.5.0.0.
	 *
	 *   The possible modes are:
	 *
	 *   'NORMAL':
	 *     Enables all conflict detection capabilities provided by libWrapper. Slower than 'FAST'.
	 *     Useful if wrapping a method commonly modified by other modules, to ensure most issues are detected.
	 *     In most other cases, this mode is not recommended and 'AUTO' should be used instead.
	 *
	 *   'FAST':
	 *     Disables some conflict detection capabilities provided by libWrapper, in exchange for performance. Faster than 'NORMAL'.
	 *     Will guarantee wrapper call order and per-module prioritization, but fewer conflicts will be detectable.
	 *     This performance mode will result in comparable performance to traditional non-libWrapper wrapping methods.
	 *     Useful if wrapping a method called repeatedly in a tight loop, for example 'WallsLayer.testWall'.
	 *     In most other cases, this mode is not recommended and 'AUTO' should be used instead.
	 *
	 *   'AUTO':
	 *     Default performance mode. If unsure, choose this mode.
	 *     Will allow the GM to choose which performance mode to use.
	 *     Equivalent to 'FAST' when the libWrapper 'High-Performance Mode' setting is enabled by the GM, otherwise 'NORMAL'.
	 */
	static register(module, target, fn, type='MIXED', options={}) {
		// Validate module
		_validate_module(module);

		// Validate we're allowed to register wrappers at this moment
		if(module != MODULE_ID && !libwrapper_ready)
			throw new LibWrapperModuleError('Not allowed to register wrappers before the \'libWrapperReady\' hook fires', module);

		// Validate other arguments
		if(!target || typeof target !== 'string')
			throw new LibWrapperModuleError('Parameter \'target\' must be a string.', module);

		if(!fn || !(fn instanceof Function))
			throw new LibWrapperModuleError('Parameter \'fn\' must be a function.', module);

		type = TYPES[type.toUpperCase()];
		if(typeof type === 'undefined' || !(type in TYPES_REVERSE))
			throw new LibWrapperModuleError(`Parameter 'type' must be one of [${TYPES_LIST.join(', ')}].`, module);

		const chain = options?.chain ?? (type < TYPES.OVERRIDE);
		if(typeof chain !== 'boolean')
			throw new LibWrapperModuleError(`Parameter 'chain' must be a boolean.`, module);

		if(IS_UNITTEST && FORCE_FAST_MODE)
			options.perf_mode = 'FAST';
		const perf_mode = PERF_MODES[options?.perf_mode?.toUpperCase() ?? 'AUTO'];
		if(typeof perf_mode === 'undefined' || !(perf_mode in PERF_MODES_REVERSE))
			throw new LibWrapperModuleError(`Parameter 'perf_mode' must be one of [${PERF_MODES_LIST.join(', ')}].`, module);


		// Split '#set' from the target
		const target_and_setter  = _split_target_and_setter(target);
		const target_without_set = target_and_setter[0];
		const is_setter          = target_and_setter[1];

		// Create wrapper
		let wrapper = _create_wrapper(target, module);

		// Only allow '#set' when the wrapper is wrapping a property
		if(is_setter && !wrapper.is_property)
			throw new LibWrapperModuleError(`Cannot register a wrapper for '${target}' by '${module}' because '${target_without_set}' is not a property, and therefore has no setter.`, module);

		// Check if this wrapper is already registered
		if(_find_module_data_in_wrapper(module, wrapper, is_setter))
			throw new LibWrapperModuleError(`Module '${module}' has already registered a wrapper for '${target}'.`, module);

		// Get priority
		const priority = _get_default_priority(module, target);

		// Register this module as having wrapped something
		// We do this before checking for duplicate OVERRIDEs to ensure users can change this module's priorities regardless
		if(module != MODULE_ID)
			LibWrapperStats.register_module(module);

		// Only allow one 'OVERRIDE' type
		if(type >= TYPES.OVERRIDE) {
			const existing = wrapper.get_fn_data(is_setter).find((x) => { return x.type == TYPES.OVERRIDE });

			if(existing) {
				if(priority <= existing.priority) {
					throw new LibWrapperAlreadyOverriddenError(module, existing.module, wrapper.name);
				}
				else {
					// We trigger a hook first
					if(Hooks.call('libWrapper.OverrideLost', existing.module, module, wrapper.name) !== false) {
						LibWrapperStats.register_conflict(module, existing.module, wrapper.name);
						LibWrapperNotifications.conflict(existing.module, module, false,
							`Module '${module}' has higher priority, and is replacing the OVERRIDE registered by '${existing.module}' for '${wrapper.name}'.`
						);
					}
				}
			}
		}

		// Wrap
		let data = {
			module   : module,
			target   : target,
			setter   : is_setter,
			fn       : fn,
			type     : type,
			wrapper  : wrapper,
			priority : priority,
			chain    : chain,
			perf_mode: perf_mode
		};

		wrapper.add(data);

		// Done
		if(DEBUG || (!IS_UNITTEST && module != MODULE_ID)) {
			Hooks.callAll('libWrapper.Register', module, target, type, options);
			console.info(`libWrapper: Registered a wrapper for '${target}' by '${module}' with type ${TYPES_REVERSE[type]}.`);
		}
	}

	/**
	 * Unregister an existing wrapper.
	 *
	 * Triggers FVTT hook 'libWrapper.Unregister' when successful.
	 *
	 * @param {string} module    The module identifier, i.e. the 'name' field in your module's manifest.
	 * @param {string} target    A string containing the path to the function you wish to remove the wrapper from, starting at global scope. For example: 'SightLayer.prototype.updateToken'
	 * @param {function} fail    [Optional] If true, this method will throw an exception if it fails to find the method to unwrap. Default is 'true'.
	 */
	static unregister(module, target, fail=true) {
		// Validate module
		_validate_module(module);

		// Find wrapper
		const data = _find_module_data_with_target(module, target);
		if(!data) {
			if(fail)
				throw new LibWrapperModuleError(`Cannot unregister '${target}' by '${module}' as no such wrapper has been registered`, module);
			return;
		}

		const wrapper = data.wrapper;

		// Remove from fn_data
		wrapper.remove(data);
		_unwrap_if_possible(wrapper);

		// Done
		if(DEBUG || module != MODULE_ID) {
			Hooks.callAll('libWrapper.Unregister', module, target);
			console.info(`libWrapper: Unregistered the wrapper for '${target}' by '${module}'.`);
		}
	}

	/**
	 * Clear all wrappers created by a given module.
	 *
	 * Triggers FVTT hook 'libWrapper.ClearModule' when successful.
	 *
	 * @param {string} module    The module identifier, i.e. the 'name' field in your module's manifest.
	 */
	static clear_module(module) {
		// Validate module
		_validate_module(module);

		// Clear module wrappers
		for(let wrapper of WRAPPERS) {
			this.unregister(module, wrapper.name, false);

			if(wrapper.is_property)
				this.unregister(module, `${wrapper.name}#set`, false);
		}

		if(DEBUG || module != MODULE_ID) {
			Hooks.callAll('libWrapper.ClearModule', module);
			console.info(`libWrapper: Cleared all wrapper functions by module '${module}'.`);
		}
	}
};
decorate_class_function_names(libWrapper);
if(IS_UNITTEST) {
	// Some methods should be exposed during unit tests
	libWrapper._UT_unwrap_all = _unwrap_all;
	libWrapper._UT_create_wrapper_from_object = _create_wrapper_from_object
	libWrapper._UT_clear = _clear;
	libWrapper._UT_force_fast_mode = _force_fast_mode;
	libWrapper._UT_get_force_fast_mode = (() => FORCE_FAST_MODE);
}
Object.freeze(libWrapper);



// Define as property so that it can't be deleted
delete globalThis.libWrapper;
Object.defineProperty(globalThis, 'libWrapper', {
	get: () => libWrapper,
	set: (value) => { throw `libWrapper: Not allowed to re-assign the global instance of libWrapper` },
	configurable: false
});



// Setup unhandled error listeners
init_error_listeners();

// Initialize libWrapper right before the 'init' hook. Unit tests just initialize immediately
{
	const libWrapperInit = decorate_name('libWrapperInit');
	const obj = {
		[libWrapperInit]: function(wrapped, ...args) {
			// Initialization steps
			libwrapper_ready = true;

			parse_manifest_version();
			LibWrapperSettings.init();
			LibWrapperStats.init();
			LibWrapperNotifications.init();

			// Sanity check
			const system_id = game.data.system.id;
			if(game.modules.get(system_id)?.active)
				LibWrapperNotifications.console_ui(`Module '${system_id}' is active and has same ID as the current system '${system_id}'. This could cause issues, and is not recommended.`, '', 'warn');

			// Notify everyone the library has loaded and is ready to start registering wrappers
			console.info(`libWrapper ${VERSION}: Ready.`);
			Hooks.callAll('libWrapperReady', libWrapper); // Deprecated since v1.4.0.0
			Hooks.callAll('libWrapper.Ready', libWrapper);

			const result = wrapped(...args);

			return result;
		}
	};

	if(!IS_UNITTEST)
		libWrapper.register('lib-wrapper', 'Game.prototype.initialize', obj[libWrapperInit], 'WRAPPER', {perf_mode: 'FAST'});
	else
		obj[libWrapperInit](()=>{});
}

// Lock down registrations using module 'lib-wrapper'
allow_libwrapper_registrations = false;