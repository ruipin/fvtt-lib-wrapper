// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {
//#if !_ROLLUP
	parse_manifest_version,
//#endif
	VERSION, version_at_least
} from '../shared/version.js';

import {
	PACKAGE_ID, HOOKS_SCOPE, IS_UNITTEST, PROPERTIES_CONFIGURABLE,
} from '../consts.js';

import { WRAPPER_TYPES, PERF_MODES } from './enums.js';
import { Wrapper } from './wrapper.js';
import { WRAPPERS } from './storage.js';
import { get_global_variable, decorate_name, decorate_class_function_names } from '../utils/misc.js';
import { PackageInfo, PACKAGE_TYPES } from '../shared/package_info.js';

import { init_error_listeners, onUnhandledError } from '../errors/listeners.js';
import { ERRORS } from '../errors/errors.js';

import { LibWrapperNotifications } from '../ui/notifications.js'
import { LibWrapperStats } from '../ui/stats.js';
import { LibWrapperConflicts } from '../ui/conflicts.js';
import { LibWrapperSettings, PRIORITIES } from '../ui/settings.js';
import { i18n } from '../shared/i18n.js';
import { Log } from '../shared/log.js';



// Internal variables
let libwrapper_ready = false;
let allow_libwrapper_registrations = true;


// Regexes used in _get_target_object
const TGT_SPLIT_RE = new RegExp([
	'(',                     // {
		'[^.[]+',            //   Match anything not containing a . or [
	'|',                     // |
		'\\[',               //   Match anything starting with [
		'(',                 //   {
			"'",             //     Followed by a '
			'(',             //     {
				'[^\'\\\\]', //       That does not contain ' or \
			'|',             //     |
				'\\\\.',     //       Ignore any character that is escaped by \
			')+?',           //     } (Non-greedy)
			"'",             //     Ending in a '
		'|',                 //   |
			'"',             //     Followed by a "
			'(',             //     {
				'[^"\\\\]',  //       That does not contain " or \
			'|',             //     |
				'\\\\.',     //       Ignore any character that is escaped by \
			')+?',           //     } (Non-greedy)
			'"',             //     Ending in a "
		')',                 //   }
		'\\]',               //   And ending with ]
	')'                      // }
].join(''), 'g');

const TGT_CLEANUP_RE = new RegExp([
	'(',          // {
		'^\\[\'', //   Anything starting with ['
	'|',          // |
		'\'\\]$', //   Anything ending with ']
	'|',          // |
		'^\\["',  //   Anything starting with ["
	'|',          // |
		'"\\]$',  //   Anything ending with "]
	')'           // }
].join(''), 'g');


// Internal Methods
export function _create_wrapper_from_object(obj, fn_name, name=undefined, package_info=undefined) {
	const wrapper = new Wrapper(obj, fn_name, name, package_info);
	WRAPPERS.add(wrapper);
	return wrapper;
}

function _split_target_and_setter(target) {
	let is_setter = target.endsWith('#set');
	let _target = !is_setter ? target : target.slice(0, -4);

	return [_target, is_setter];
}

function _valid_root_scope_string(str) {
	return /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(str);
}

function _valid_target_string(str) {
	return /^[a-zA-Z_$][0-9a-zA-Z_$]*?([.[]|$)/.test(str);
}

function _get_target_object(_target, package_info=undefined) {
	// Parse the target
	const target = _split_target_and_setter(_target)[0];
	if(!_valid_target_string(target))
		throw new ERRORS.package(`Invalid target '${target}'.`, package_info);

	// Split the target
	const split = target.match(TGT_SPLIT_RE).map((x)=>x.replace(/\\(.)/g, '$1').replace(TGT_CLEANUP_RE,''));

	// Get root object
	const root_nm = split.splice(0,1)[0]; // equivalent to 'split.pop_front()' which JS doesn't have
	if(!_valid_root_scope_string(root_nm))
		throw new ERRORS.package(`Invalid target '${target}': Invalid root scope '${root_nm}'.`, package_info);
	if(root_nm == 'libWrapper')
		throw new ERRORS.package(`Not allowed to wrap libWrapper internals.`, package_info);

	// Figure out the object and function name we want to wrap
	let obj, fn_name;
	if(split.length == 0) {
		// In order to wrap something in global scope, it must be accessible from 'globalThis'
		if(!(root_nm in globalThis))
			throw new ERRORS.package(`Could not find target '${target}': Could not find scope 'globalThis.${root_nm}'.`, package_info);

		fn_name = root_nm;
		obj = globalThis;
	}
	else {
		// Get function name
		fn_name = split.pop();

		// Get root variable
		const root = get_global_variable(root_nm);
		if(!root)
			throw new ERRORS.package(`Could not find target '${target}': Could not find root scope '${root_nm}'.`, package_info);

		// Get target object
		obj = root;
		for(const scope of split) {
			obj = obj[scope];
			if(!obj)
				throw new ERRORS.package(`Could not find target '${target}': Could not find scope '${scope}'.`, package_info);
		}
	}

	// Done
	return [obj, fn_name, target];
}

function _create_wrapper(target, package_info=undefined) {
	// Get target information
	const tgt_info = _get_target_object(target, package_info);

	// Create wrapper
	return _create_wrapper_from_object(...tgt_info, package_info);
}

function _get_target_from_info(obj, fn_name) {
	const descriptor = Object.getOwnPropertyDescriptor(obj, fn_name);
	return descriptor?.get?._lib_wrapper ?? null;
}

export function _find_wrapper_by_name(_name, package_info=undefined) {
	// Get target information
	const tgt_info = _get_target_object(_name, package_info);

	// Return target wrapper
	return _get_target_from_info(...tgt_info);
}

function _find_wrapper_by_id(id) {
	const wrapper = WRAPPERS.find_by_id(id);
	return [wrapper, (id === wrapper?.setter_id)];
}

function _find_package_data_in_wrapper(package_info, wrapper, is_setter) {
	return wrapper.get_fn_data(is_setter).find((x) => x.package_info?.equals(package_info));
}

function _find_package_data_with_target(package_info, target) {
	let wrapper = null;
	let is_setter;

	if(typeof target === 'number') {
		[wrapper, is_setter] = _find_wrapper_by_id(target);
	}
	else {
		const target_and_setter = _split_target_and_setter(target);

		wrapper   = _find_wrapper_by_name(target_and_setter[0]);
		is_setter = target_and_setter[1];
	}

	// Return null if not found, or if we wanted a setter but there is none
	if(!wrapper)
		return null;
	if(is_setter && !wrapper.is_property)
		return null;

	// Otherwise return the data relevant to the requested package
	return _find_package_data_in_wrapper(package_info, wrapper, is_setter);
}

function _get_default_priority(package_info, target) {
	if(package_info.id === PACKAGE_ID)
		return Number.MAX_VALUE;

	const priority_cfg = PRIORITIES.get(package_info.key);
	if(priority_cfg !== undefined)
		return priority_cfg;

	return 0;
}

function _unwrap_if_possible(wrapper) {
	if(wrapper.is_empty() && PROPERTIES_CONFIGURABLE) {
		wrapper.unwrap();
		WRAPPERS.remove(wrapper);
	}
}

export function _clear(target) {
	const wrapper = _find_wrapper_by_name(target);

	if(wrapper) {
		wrapper.clear();
		_unwrap_if_possible(wrapper);

		Log.info$?.(`Cleared all wrapper functions for '${target}'.`);
	}
}

function _unregister(package_info, target, fail) {
	// Find wrapper
	const data = _find_package_data_with_target(package_info, target);
	if(!data) {
		if(fail)
			throw new ERRORS.package(`Cannot unregister '${target}' by ${package_info.type_plus_id} as no such wrapper has been registered`, package_info);
		return;
	}

	const wrapper = data.wrapper;

	// Remove from fn_data
	wrapper.remove(data);
	_unwrap_if_possible(wrapper);

	// Done
	return data;
}

export function _unwrap_all() {
	WRAPPERS.forEach((wrapper) => {
		wrapper.clear();
		_unwrap_if_possible(wrapper);
	});

	WRAPPERS.clear();
}

function _get_package_info(package_id) {
	// Auto-detect package info, initially
	let package_info = new PackageInfo();

	// Sanity check user provided ID
	if(!PackageInfo.is_valid_key_or_id(package_id))
		throw new ERRORS.package('Parameter \'package_id\' is invalid.', package_info);

	// Parse user provided ID into a PackageInfo object
	const user_package_info = new PackageInfo(package_id);

	// If we were able to auto-detect the package, validate user provided info against automatically detected info
	if(package_info.exists) {
		if(!package_info.equals(user_package_info))
			throw new ERRORS.package(`${package_info.type_plus_id_capitalized} is not allowed to call libWrapper with package_id='${package_id}'.`, package_info);
	}
	// Otherwise, just assume what the user provided is correct
	else {
		package_info = user_package_info;
	}

	// Sanity Check: Must not allow registering wrappers as lib-wrapper
	if(package_id == PACKAGE_ID) {
		if(!allow_libwrapper_registrations)
			throw new ERRORS.package(`Not allowed to call libWrapper with package_id='${package_id}'.`, package_info);
	}
	// Sanity Check: Package must exist (single exception is lib-wrapper, since we register wrappers before 'init')
	else {
		if(!package_info.exists && game.modules?.size)
			throw new ERRORS.package(`Package '${package_id}' is not a valid package.`, package_info);
	}

	// Done
	return package_info;
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
	static get version() { return VERSION.full; }

	/**
	 * Get libWrapper version
	 * @returns {[number,number,number,number,string]}  libWrapper version in array form, i.e. [<MAJOR>, <MINOR>, <PATCH>, <SUFFIX>, <META>]
	 */
	static get versions() { return [VERSION.major, VERSION.minor, VERSION.patch, VERSION.suffix, VERSION.meta]; }

	/**
	 * Get the Git version identifier.
	 * @returns {string}  Git version identifier, usually 'HEAD' or the commit hash.
	 */
	static get git_version() { return VERSION.git };


	/**
	 * @returns {boolean}  The real libWrapper module will always return false. Fallback implementations (e.g. poly-fill / shim) should return true.
	 */
	static get is_fallback() { return false; }


	// Errors
	static get LibWrapperError() { return ERRORS.base; };
	static get           Error() { return ERRORS.base; }

	static get LibWrapperInternalError() { return ERRORS.internal; };
	static get           InternalError() { return ERRORS.internal; };

	static get LibWrapperPackageError() { return ERRORS.package; };
	static get           PackageError() { return ERRORS.package; };

	static get LibWrapperAlreadyOverriddenError() { return ERRORS.already_overridden; };
	static get           AlreadyOverriddenError() { return ERRORS.already_overridden; };

	static get LibWrapperInvalidWrapperChainError() { return ERRORS.invalid_chain; };
	static get          InvalidWrapperChainError () { return ERRORS.invalid_chain; };

	/* Undocumented on purpose, do not use */
	static get onUnhandledError() { return onUnhandledError; };


	// Enums - First introduced in v1.9.0.0
	static get WRAPPER()  { return WRAPPER_TYPES.WRAPPER  };
	static get MIXED()    { return WRAPPER_TYPES.MIXED    };
	static get OVERRIDE() { return WRAPPER_TYPES.OVERRIDE };

	static get PERF_NORMAL() { return PERF_MODES.NORMAL };
	static get PERF_AUTO()   { return PERF_MODES.AUTO   };
	static get PERF_FAST()   { return PERF_MODES.FAST   };


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
	static get version_at_least() { return version_at_least };

	/**
	 * Register a new wrapper.
	 * Important: If called before the 'init' hook, this method will fail.
	 *
	 * In addition to wrapping class methods, there is also support for wrapping methods on specific object instances, as well as class methods inherited from parent classes.
	 * However, it is recommended to wrap methods directly in the class that defines them whenever possible, as inheritance/instance wrapping is less thoroughly tested and will incur a performance penalty.
	 *
	 * Triggers FVTT hook 'libWrapper.Register' when successful.
	 *
	 * Returns a unique numeric target identifier, which can be used as a replacement for 'target' in future calls to 'libWrapper.register' and 'libWrapper.unregister'.
	 *
	 * @param {string} package_id  The package identifier, i.e. the 'id' field in your module/system/world's manifest.
	 *
	 * @param {number|string} target The target identifier, specifying which wrapper should be unregistered.
	 *
	 *   This can be either:
	 *     1. A unique target identifier obtained from a previous 'libWrapper.register' call.
	 *     2. A string containing the path to the function you wish to add the wrapper to, starting at global scope, for example 'SightLayer.prototype.updateToken'.
	 *
	 *   Support for the unique target identifiers (option #1) was added in v1.11.0.0, with previous versions only supporting option #2.
	 *
	 *   Since v1.8.0.0, the string path (option #2) can contain string array indexing.
	 *   For example, 'CONFIG.Actor.sheetClasses.character["dnd5e.ActorSheet5eCharacter"].cls.prototype._onLongRest' is a valid path.
	 *   It is important to note that indexing in libWrapper does not work exactly like in JavaScript:
	 *     - The index must be a single string, quoted using the ' or " characters. It does not support e.g. numbers or objects.
	 *     - A backslash \ can be used to escape another character so that it loses its special meaning, e.g. quotes i.e. ' and " as well as the character \ itself.
	 *
	 *   By default, libWrapper searches for normal methods or property getters only. To wrap a property's setter, append '#set' to the name, for example 'SightLayer.prototype.blurDistance#set'.
	 *
	 * @param {function} fn        Wrapper function. The first argument will be the next function in the chain, except for 'OVERRIDE' wrappers.
	 *                             The remaining arguments will correspond to the parameters passed to the wrapped method.
	 *
	 * @param {string} type        [Optional] The type of the wrapper. Default is 'MIXED'.
	 *
	 *   The possible types are:
	 *
	 *   'WRAPPER' / libWrapper.WRAPPER:
	 *     Use if your wrapper will *always* continue the chain.
	 *     This type has priority over every other type. It should be used whenever possible as it massively reduces the likelihood of conflicts.
	 *     Note that the library will auto-detect if you use this type but do not call the original function, and automatically unregister your wrapper.
	 *
	 *   'MIXED' / libWrapper.MIXED:
	 *     Default type. Your wrapper will be allowed to decide whether it continue the chain or not.
	 *     These will always come after 'WRAPPER'-type wrappers. Order is not guaranteed, but conflicts will be auto-detected.
	 *
	 *   'OVERRIDE' / libWrapper.OVERRIDE:
	 *     Use if your wrapper will *never* continue the chain. This type has the lowest priority, and will always be called last.
	 *     If another package already has an 'OVERRIDE' wrapper registered to the same method, using this type will throw a <libWrapper.ERRORS.package> exception.
	 *     Catching this exception should allow you to fail gracefully, and for example warn the user of the conflict.
	 *     Note that if the GM has explicitly given your package priority over the existing one, no exception will be thrown and your wrapper will take over.
	 *
	 * @param {Object} options [Optional] Additional options to libWrapper.
	 *
	 * @param {boolean} options.chain [Optional] If 'true', the first parameter to 'fn' will be a function object that can be called to continue the chain.
	 *   Default is 'false' if type=='OVERRIDE', otherwise 'true'.
	 *   First introduced in v1.3.6.0.
	 *
	 * @param {string} options.perf_mode [Optional] Selects the preferred performance mode for this wrapper. Default is 'AUTO'.
	 *   It will be used if all other wrappers registered on the same target also prefer the same mode, otherwise the default will be used instead.
	 *   This option should only be specified with good reason. In most cases, using 'AUTO' in order to allow the GM to choose is the best option.
	 *   First introduced in v1.5.0.0.
	 *
	 *   The possible modes are:
	 *
	 *   'NORMAL' / libWrapper.PERF_NORMAL:
	 *     Enables all conflict detection capabilities provided by libWrapper. Slower than 'FAST'.
	 *     Useful if wrapping a method commonly modified by other packages, to ensure most issues are detected.
	 *     In most other cases, this mode is not recommended and 'AUTO' should be used instead.
	 *
	 *   'FAST' / libWrapper.PERF_FAST:
	 *     Disables some conflict detection capabilities provided by libWrapper, in exchange for performance. Faster than 'NORMAL'.
	 *     Will guarantee wrapper call order and per-package prioritization, but fewer conflicts will be detectable.
	 *     This performance mode will result in comparable performance to traditional non-libWrapper wrapping methods.
	 *     Useful if wrapping a method called repeatedly in a tight loop, for example 'WallsLayer.testWall'.
	 *     In most other cases, this mode is not recommended and 'AUTO' should be used instead.
	 *
	 *   'AUTO' / libWrapper.PERF_AUTO:
	 *     Default performance mode. If unsure, choose this mode.
	 *     Will allow the GM to choose which performance mode to use.
	 *     Equivalent to 'FAST' when the libWrapper 'High-Performance Mode' setting is enabled by the GM, otherwise 'NORMAL'.
	 *
	 * @param {any[]} options.bind [Optional] An array of parameters that should be passed to 'fn'.
	 *
	 *   This allows avoiding an extra function call, for instance:
	 *     libWrapper.register(PACKAGE_ID, "foo", function(wrapped, ...args) { return someFunction.call(this, wrapped, "foo", "bar", ...args) });
	 *   becomes
	 *     libWrapper.register(PACKAGE_ID, "foo", someFunction, "WRAPPER", {bind: ["foo", "bar"]});
	 *
	 *   First introduced in v1.12.0.0.
	 *
	 * @returns {number} Unique numeric 'target' identifier which can be used in future 'libWrapper.register' and 'libWrapper.unregister' calls.
	 *   Added in v1.11.0.0.
	 */
	static register(package_id, target, fn, type='MIXED', options={}) {
		// Get package information
		const package_info = _get_package_info(package_id);

		// Validate we're allowed to register wrappers at this moment
		if(package_id != PACKAGE_ID && !libwrapper_ready)
			throw new ERRORS.package('Not allowed to register wrappers before the \'libWrapperReady\' hook fires', package_info);

		// Validate other arguments
		if(typeof target !== 'string' && typeof target !== 'number')
			throw new ERRORS.package('Parameter \'target\' must be a number or a string.', package_info);

		if(!fn || !(fn instanceof Function))
			throw new ERRORS.package('Parameter \'fn\' must be a function.', package_info);

		type = WRAPPER_TYPES.get(type, null);
		if(type === null)
			throw new ERRORS.package(`Parameter 'type' must be one of [${WRAPPER_TYPES.list.join(', ')}].`, package_info);

		const chain = options?.chain ?? (type.value < WRAPPER_TYPES.OVERRIDE.value);
		if(typeof chain !== 'boolean')
			throw new ERRORS.package(`Parameter 'options.chain' must be a boolean.`, package_info);

		if(IS_UNITTEST && FORCE_FAST_MODE)
			options.perf_mode = 'FAST';
		const perf_mode = PERF_MODES.get(options?.perf_mode ?? 'AUTO', null);
		if(perf_mode === null)
			throw new ERRORS.package(`Parameter 'options.perf_mode' must be one of [${PERF_MODE.list.join(', ')}].`, package_info);

		const bind = options?.bind ?? null;
		if(bind !== null && !Array.isArray(bind))
			throw new ERRORS.package(`Parameter 'options.bind' must be an array.`, package_info);


		// Process 'target' parameter
		let wrapper = undefined;
		let is_setter;

		// In the case it is a number, then this means the wrapper must already exist, we simply need to find it
		if(typeof target === 'number') {
			[wrapper, is_setter] = _find_wrapper_by_id(target);

			if(!wrapper)
				throw new ERRORS.package(`Could not find target '${target}': Invalid or unknown unique identifier.`, package_info);
		}
		// Otherwise, we need to create a wrapper from a target string (or obtain it if it already exists)
		else {
			// Split '#set' from the target
			const target_and_setter  = _split_target_and_setter(target);
			const target_without_set = target_and_setter[0];

			is_setter = target_and_setter[1];

			// Create wrapper
			wrapper = _create_wrapper(target, package_info);

			// Sanity check
			if(!wrapper)
				throw new ERRORS.internal(`Sanity check failed: 'wrapper' must not be falsy after _create_wrapper call`);

			// Only allow '#set' when the wrapper is wrapping a property
			if(is_setter && !wrapper.is_property)
				throw new ERRORS.package(`Cannot register a wrapper for '${target}' by ${package_info.type_plus_id}' because '${target_without_set}' is not a property, and therefore has no setter.`, package_info);
		}

		// Get wrapper ID and name for log messages
		const wrapper_id = wrapper.get_id(is_setter);
		const wrapper_name = wrapper.get_name(is_setter);

		// Check if this wrapper is already registered
		if(_find_package_data_in_wrapper(package_info, wrapper, is_setter))
			throw new ERRORS.package(`A wrapper for '${wrapper_name}' (ID=${wrapper_id}) has already been registered by ${package_info.type_plus_id}.`, package_info);

		// Get priority
		const priority = _get_default_priority(package_info, target);

		// Register this package as having wrapped something
		// We do this before checking for duplicate OVERRIDEs to ensure users can change this package's priorities regardless
		if(package_info.id != PACKAGE_ID)
			LibWrapperStats.register_package(package_info);

		// Only allow one 'OVERRIDE' type
		if(type.value >= WRAPPER_TYPES.OVERRIDE.value) {
			const existing = wrapper.get_fn_data(is_setter).find((x) => { return x.type === WRAPPER_TYPES.OVERRIDE });

			if(existing) {
				if(priority <= existing.priority) {
					throw new ERRORS.already_overridden(package_info, existing.package_info, wrapper, target);
				}
				else {
					// We trigger a hook first
					if(Hooks.call(`${HOOKS_SCOPE}.OverrideLost`, existing.package_info.id, package_info.id, wrapper.name, wrapper.frozen_names) !== false) {
						const notify_user = LibWrapperConflicts.register_conflict(package_info, existing.package_info, wrapper, null, false);

						if(notify_user) {
							LibWrapperNotifications.conflict(existing.package_info, package_info, false,
								`${package_info.type_plus_id_capitalized} has higher priority, and is replacing the 'OVERRIDE' registered by ${package_info.type_plus_id} for '${wrapper_name}'.`
							);
						}
					}
				}
			}
		}

		// Wrap
		let data = {
			package_info : package_info,
			target       : target,
			setter       : is_setter,
			fn           : fn,
			type         : type,
			wrapper      : wrapper,
			priority     : priority,
			chain        : chain,
			perf_mode    : perf_mode,
			bind         : bind
		};

		wrapper.add(data);

		// Done
		if(package_info.id != PACKAGE_ID)
			Hooks.callAll(`${HOOKS_SCOPE}.Register`, package_info.id, (typeof target === 'number') ? wrapper_name : target, type, options, wrapper_id);

		Log.info$?.(`Registered a wrapper for '${wrapper_name}' (ID=${wrapper_id}) by ${package_info.type_plus_id} with type ${type}.`);

		return wrapper_id;
	}

	/**
	 * Unregister an existing wrapper.
	 *
	 * Triggers FVTT hook 'libWrapper.Unregister' when successful.
	 *
	 * @param {string} package_id     The package identifier, i.e. the 'id' field in your module/system/world's manifest.
	 *
	 * @param {number|string} target  The target identifier, specifying which wrapper should be unregistered.
	 *
	 *   This can be either:
	 *     1. A unique target identifier obtained from a previous 'libWrapper.register' call. This is the recommended option.
	 *     2. A string containing the path to the function you wish to remove the wrapper from, starting at global scope, with the same syntax as the 'target' parameter to 'libWrapper.register'.
	 *
	 *   Support for the unique target identifiers (option #1) was added in v1.11.0.0, with previous versions only supporting option #2.
	 *   It is recommended to use option #1 if possible, in order to guard against the case where the class or object at the given path is no longer the same as when `libWrapper.register' was called.
	 *
	 * @param {function} fail         [Optional] If true, this method will throw an exception if it fails to find the method to unwrap. Default is 'true'.
	 */
	static unregister(package_id, target, fail=true) {
		// Get package information
		const package_info = _get_package_info(package_id);

		// Validate arguments
		if(typeof target !== 'string' && typeof target !== 'number')
			throw new ERRORS.package('Parameter \'target\' must be a number or a string.', package_info);

		// Unregister wrapper
		const data = _unregister(package_info, target, fail);
		if(!data)
			return;

		// Done
		const wrapper_id   = data.wrapper.get_id(data.setter);
		const wrapper_name = data.wrapper.get_name(data.setter);

		if(package_info.id != PACKAGE_ID)
			Hooks.callAll(`${HOOKS_SCOPE}.Unregister`, package_info.id, (typeof target === 'number') ? wrapper_name : target, wrapper_id);

		Log.info$?.(`Unregistered the wrapper for '${wrapper_name}' (ID=${wrapper_id}) by ${package_info.type_plus_id}.`);
	}

	/**
	 * Unregister all wrappers created by a given package.
	 *
	 * Triggers FVTT hook 'libWrapper.UnregisterAll' when successful.
	 *
	 * @param {string} package_id  The package identifier, i.e. the 'id' field in your module/system/world's manifest.
	 */
	static unregister_all(package_id) {
		// Get package information
		const package_info = _get_package_info(package_id);

		// Clear package wrappers
		WRAPPERS.forEach((wrapper) => {
			this.unregister(package_info.id, wrapper.getter_id, false);

			if(wrapper.is_property)
				this.unregister(package_info.id, wrapper.setter_id, false);
		});

		if(package_info.id != PACKAGE_ID)
			Hooks.callAll(`${HOOKS_SCOPE}.UnregisterAll`, package_info.id);

		Log.info$?.(`Unregistered all wrapper functions by ${package_info.type_plus_id}.`);
	}

	/**
	 * Ignore conflicts matching specific filters when detected, instead of warning the user.
	 *
	 * This can be used when there are conflict warnings that are known not to cause any issues, but are unable to be resolved.
	 * Conflicts will be ignored if they involve both 'package_id' and one of 'ignore_ids', and relate to one of 'targets'.
	 *
	 * Note that the user can still see which detected conflicts were ignored, by toggling "Show ignored conflicts" in the "Conflicts" tab in the libWrapper settings.
	 *
	 * First introduced in v1.7.0.0.
	 *
	 * @param {string}            package_id  The package identifier, i.e. the 'id' field in your module/system/world's manifest. This will be the module that owns this ignore entry.
	 *
	 * @param {(string|string[])} ignore_ids  Other package ID(s) with which conflicts should be ignored.
	 *
	 * @param {(string|string[])} targets     Target(s) for which conflicts should be ignored, corresponding to the 'target' parameter to 'libWrapper.register'.
	 *   This method does not accept the unique target identifiers returned by 'libWrapper.register'.
	 *
	 * @param {Object} options [Optional] Additional options to libWrapper.
	 *
	 * @param {boolean} options.ignore_errors  [Optional] If 'true', will also ignore confirmed conflicts (i.e. errors), rather than only potential conflicts (i.e. warnings).
	 *   Be careful when setting this to 'true', as confirmed conflicts are almost certainly something the user should be made aware of.
	 *   Defaults to 'false'.
	 */
	static ignore_conflicts(package_id, ignore_ids, targets, options={}) {
		// Get package information
		const package_info = _get_package_info(package_id);

		// Validate we are allowed to call this method right now
		if(!libwrapper_ready)
			throw new ERRORS.package('Not allowed to ignore conflicts before the \'libWrapperReady\' hook fires', package_info);

		// Convert parameters to arrays
		if(!Array.isArray(ignore_ids))
			ignore_ids = [ignore_ids];
		if(!Array.isArray(targets))
			targets = [targets];

		// Validate parameters #2
		const is_string = (x) => (typeof x === 'string');

		if(!ignore_ids.every(is_string))
			throw new ERRORS.package(`Parameter 'ignore_ids' must be a string, or an array of strings.`, package_info);

		if(!targets.every(is_string))
			throw new ERRORS.package(`Parameter 'targets' must be a string, or an array of strings.`, package_info);
		if(!targets.every((x) => _valid_target_string(x)))
			throw new ERRORS.package(`Parameter 'targets' must only contain valid targets.`, package_info);

		const ignore_errors = options.ignore_errors ?? false;
		if(typeof ignore_errors !== 'boolean')
			throw new ERRORS.package(`Parameter 'options.ignore_errors' must be a boolean.`, package_info);


		// Convert 'other_ids' to PackageInfo objects and filter out any that do not exist
		const ignore_infos = ignore_ids.map((x) => new PackageInfo(x)).filter((x) => x.exists);

		// Ignore API call if no packages to be ignored
		if(ignore_infos.length == 0) {
			Log.debug$?.(`Ignoring 'ignore_conflict' call for ${package_info.type_plus_id} since none of the package IDs provided exist or are active.`)
			return;
		}

		// Register ignores
		LibWrapperConflicts.register_ignore(package_info, ignore_infos, targets, ignore_errors);

		if(package_info.id != PACKAGE_ID)
			Log.info$?.(`Ignoring conflicts involving ${package_info.type_plus_id} and [${ignore_infos.map((x) => x.type_plus_id).join(', ')}] for targets [${targets.join(', ')}].`);
	}
};
decorate_class_function_names(libWrapper);
if(IS_UNITTEST) {
	// Some methods should be exposed during unit tests
	libWrapper._UT_unwrap_all                 = _unwrap_all;
	libWrapper._UT_create_wrapper_from_object = _create_wrapper_from_object
	libWrapper._UT_clear                      = _clear;
	libWrapper._UT_force_fast_mode            = _force_fast_mode;
	libWrapper._UT_get_force_fast_mode        = (() => FORCE_FAST_MODE);
	libWrapper._UT_clear_ignores              = (() => LibWrapperConflicts.clear_ignores());
	libWrapper._UT_TGT_SPLIT_REGEX            = TGT_SPLIT_RE;
	libWrapper._UT_TGT_CLEANUP_REGEX          = TGT_CLEANUP_RE;
}
Object.freeze(libWrapper);



// Define as property so that it can't be deleted
delete globalThis.libWrapper;
Object.defineProperty(globalThis, 'libWrapper', {
	get: () => libWrapper,
	set: (value) => { throw new ERRORS.package("Not allowed to re-assign the global instance of libWrapper") },
	configurable: false
});



// Setup unhandled error listeners
init_error_listeners();

// Initialize libWrapper right before the 'init' hook. Unit tests just initialize immediately
{
	let GAME_INITIALIZE_ID;
	let GAME_TOSTRING_ID;

	const libWrapperInit = decorate_name('libWrapperInit');
	const obj = {
		[libWrapperInit]: async function(wrapped, ...args) {
			// Unregister our pre-initialisation patches as they are no longer necessary
			if(!IS_UNITTEST) {
				const lw_info = new PackageInfo('lib-wrapper', PACKAGE_TYPES.MODULE);
				_unregister(lw_info, GAME_TOSTRING_ID  , /*fail=*/ true);
				_unregister(lw_info, GAME_INITIALIZE_ID, /*fail=*/ true);
			}

			// Initialization steps
			libwrapper_ready = true;

			//#if !_ROLLUP
				parse_manifest_version();
			//#endif

			await i18n.init();
			LibWrapperSettings.init();
			LibWrapperStats.init();
			LibWrapperConflicts.init();
			LibWrapperNotifications.init();

			// Notify everyone the library has loaded and is ready to start registering wrappers
			Log.fn(Log.ALWAYS, /*fn_verbosity=*/ Log.INFO)(`Version ${VERSION.full_git} ready.`);
			Hooks.callAll(`${HOOKS_SCOPE}.Ready`, libWrapper);

			return wrapped(...args);
		}
	};

	if(!IS_UNITTEST) {
		GAME_INITIALIZE_ID = libWrapper.register('lib-wrapper', 'Game.prototype.initialize', obj[libWrapperInit], libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});

		// We need to prevent people patching 'Game' and breaking libWrapper.
		// Unfortunately we cannot re-define 'Game' as a non-settable property, but we can prevent people from using 'Game.toString'.
		GAME_TOSTRING_ID = libWrapper.register('lib-wrapper', 'Game.toString', function() {
			throw new ERRORS.package("Using 'Game.toString()' before libWrapper initialises is not allowed for compatibility reasons.");
		}, libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});

		// Add a sanity check hook, just in case someone breaks our initialisation procedure
		Hooks.once('init', ()=>{
			if(!libwrapper_ready)
				throw new ERRORS.internal("Could not successfuly initialise libWrapper, likely due to a compatibility issue with another module.");
		});
	}
	else
		obj[libWrapperInit](()=>{});
}

// Lock down registrations using package ID 'lib-wrapper'
allow_libwrapper_registrations = false;