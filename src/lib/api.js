// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {
	MAJOR_VERSION, MINOR_VERSION, PATCH_VERSION, SUFFIX_VERSION, META_VERSION,
	VERSION, GIT_VERSION, VERSION_WITH_GIT, parse_manifest_version, version_at_least
} from '../shared/version.js';

import {
	PACKAGE_ID, HOOKS_SCOPE, IS_UNITTEST, PROPERTIES_CONFIGURABLE, DEBUG, setDebug,
} from '../consts.js';

import {WRAPPER_TYPES, PERF_MODES} from './enums.js';
import {Wrapper} from './wrapper.js';
import {get_global_variable, WRAPPERS, decorate_name, decorate_class_function_names} from '../utils/misc.js';
import {PackageInfo, PACKAGE_TYPES} from '../shared/package_info.js';

import {init_error_listeners, onUnhandledError} from '../errors/listeners.js';
import {LibWrapperError, LibWrapperPackageError, LibWrapperInternalError} from '../errors/base_errors.js';
import {LibWrapperAlreadyOverriddenError, LibWrapperInvalidWrapperChainError} from '../errors/api_errors.js';

import {LibWrapperNotifications} from '../ui/notifications.js'
import {LibWrapperStats} from '../ui/stats.js';
import {LibWrapperConflicts} from '../ui/conflicts.js';
import {LibWrapperSettings, PRIORITIES} from '../ui/settings.js';



// Internal variables
let libwrapper_ready = false;
let allow_libwrapper_registrations = true;


// Regexes used in _get_target_object
const TGT_SPLIT_RE = new RegExp([
	'(',                  // {
		'[^.[]+',         //   Match anything not containing a . or [
	'|',                  // |
		'\\[',            //   Match anything starting with [
		'(',              //   {
			"'",          //     Followed by a '
			'(',          //     {
				'[^\']',  //       That does not contain '
			'|',          //     |
				"\\'",    //       Ignore ' if it is escaped
			'|',          //     |
				'\\\\',   //       Ignore \ if it is escaped
			')+?',        //     } (Non-greedy)
			"'",          //     Ending in a '
		'|',              //   |
			'"',          //     Followed by a "
			'(',          //     {
				'[^"]',   //       That does not contain "
			'|',          //     |
				'\\"',    //       Ignore " if it is escaped
			'|',          //     |
				'\\\\',   //       Ignore \ if it is escaped
			')+?',        //     } (Non-greedy)
			'"',          //     Ending in a '
		')',              //   }
		'\\]',            //   And ending with ]
	')'                   // }
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
		throw new LibWrapperPackageError(`Invalid target '${target}'.`, package_info);

	// Split the target
	const split = target.match(TGT_SPLIT_RE).map((x)=>x.replace(/\\(.)/g, '$1').replace(TGT_CLEANUP_RE,''));

	// Get root object
	const root_nm = split.splice(0,1)[0]; // equivalent to 'split.pop_front()' which JS doesn't have
	if(!_valid_root_scope_string(root_nm))
		throw new LibWrapperPackageError(`Invalid target '${target}': Invalid root scope '${root_nm}'.`, package_info);
	if(root_nm == 'libWrapper')
		throw new LibWrapperPackageError(`Not allowed to wrap libWrapper internals.`, package_info);

	// Figure out the object and function name we want to wrap
	let obj, fn_name;
	if(split.length == 0) {
		// In order to wrap something in global scope, it must be accessible from 'globalThis'
		if(!(root_nm in globalThis))
			throw new LibWrapperPackageError(`Could not find target '${target}': Could not find scope 'globalThis.${root_nm}'.`, package_info);

		fn_name = root_nm;
		obj = globalThis;
	}
	else {
		// Get function name
		fn_name = split.pop();

		// Get root variable
		const root = get_global_variable(root_nm);
		if(!root)
			throw new LibWrapperPackageError(`Could not find target '${target}': Could not find root scope '${root_nm}'.`, package_info);

		// Get target object
		obj = root;
		for(const scope of split) {
			obj = obj[scope];
			if(!obj)
				throw new LibWrapperPackageError(`Could not find target '${target}': Could not find scope '${scope}'.`, package_info);
		}
	}

	// Done
	return [obj, fn_name, target];
}

function _create_wrapper(target, package_info=null) {
	// Create wrapper
	return _create_wrapper_from_object(..._get_target_object(target), package_info);
}

function _find_wrapper_by_name(_name) {
	const name = _split_target_and_setter(_name)[0];

	for(let wrapper of WRAPPERS) {
		if(wrapper.names.includes(name))
			return wrapper;
	}

	return null;
}

function _find_package_data_in_wrapper(package_info, wrapper, is_setter) {
	return wrapper.get_fn_data(is_setter).find((x) => x.package_info?.equals(package_info));
}

function _find_package_data_with_target(package_info, _target) {
	const target_and_setter = _split_target_and_setter(_target);
	const target    = target_and_setter[0];
	const is_setter = target_and_setter[1];

	const wrapper = _find_wrapper_by_name(target);
	if(!wrapper)
		return null;

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

function _unregister(package_info, target, fail) {
	// Find wrapper
	const data = _find_package_data_with_target(package_info, target);
	if(!data) {
		if(fail)
			throw new LibWrapperPackageError(`Cannot unregister '${target}' by ${package_info.logString} as no such wrapper has been registered`, package_info);
		return;
	}

	const wrapper = data.wrapper;

	// Remove from fn_data
	wrapper.remove(data);
	_unwrap_if_possible(wrapper);
}

export function _unwrap_all() {
	for(let wrapper of WRAPPERS) {
		wrapper.clear();
		wrapper.unwrap();
	}

	WRAPPERS.clear();
}


function _get_package_info(package_id) {
	let package_info = new PackageInfo();

	if(!package_id || typeof package_id !== 'string')
		throw new LibWrapperPackageError('Parameter \'package_id\' must be a string.', package_info);

	if(package_info.exists) {
		if(package_id != package_info.id)
			throw new LibWrapperPackageError(`${package_info.logStringCapitalized} is not allowed to call libWrapper with package_id='${package_id}'.`, package_info);
	}
	else {
		package_info = new PackageInfo(package_id);
	}

	if(package_id == PACKAGE_ID) {
		if(!allow_libwrapper_registrations)
			throw new LibWrapperPackageError(`Not allowed to call libWrapper with package_id='${package_id}'.`, package_info);
	}
	else {
		if(!package_info.exists && game.modules?.size)
			throw new LibWrapperPackageError(`Package '${package_id}' is not a valid package.`, package_info);
	}

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
	static get version() { return VERSION; }

	/**
	 * Get libWrapper version
	 * @returns {[number,number,number,number,string]}  libWrapper version in array form, i.e. [<MAJOR>, <MINOR>, <PATCH>, <SUFFIX>, <META>]
	 */
	static get versions() { return [MAJOR_VERSION, MINOR_VERSION, PATCH_VERSION, SUFFIX_VERSION, META_VERSION]; }

	/**
	 * Get the Git version identifier.
	 * @returns {string}  Git version identifier, usually 'HEAD' or the commit hash.
	 */
	static get git_version() { return GIT_VERSION };


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

	static get LibWrapperPackageError() { return LibWrapperPackageError; };
	static get PackageError() { return LibWrapperPackageError; };

	static get LibWrapperAlreadyOverriddenError() { return LibWrapperAlreadyOverriddenError; };
	static get AlreadyOverriddenError() { return LibWrapperAlreadyOverriddenError; };

	static get LibWrapperInvalidWrapperChainError() { return LibWrapperInvalidWrapperChainError; };
	static get InvalidWrapperChainError() { return LibWrapperInvalidWrapperChainError; };

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
	 * @param {string} package_id  The package identifier, i.e. the 'id' field in your module/system/world's manifest.
	 *
	 * @param {string} target      A string containing the path to the function you wish to add the wrapper to, starting at global scope, for example 'SightLayer.prototype.updateToken'.
	 *
	 *   Since v1.8.0.0, the path can contain string array indexing.
	 *   For example, 'CONFIG.Actor.sheetClasses.character["dnd5e.ActorSheet5eCharacter"].cls.prototype._onLongRest' is a valid path.
	 *   It is important to note that indexing in libWrapper does not work exactly like in JavaScript:
	 *     - The index must be a single string, quoted using the ' or " characters. It does not support e.g. numbers or objects.
	 *     - Quotes i.e. ' and " can be escaped with a preceding '\'.
	 *     - The character '\' can be escaped with a preceding '\'.
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
	 *     If another package already has an 'OVERRIDE' wrapper registered to the same method, using this type will throw a <libWrapper.LibWrapperAlreadyOverriddenError> exception.
	 *     Catching this exception should allow you to fail gracefully, and for example warn the user of the conflict.
	 *     Note that if the GM has explicitly given your package priority over the existing one, no exception will be thrown and your wrapper will take over.
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
	 */
	static register(package_id, target, fn, type='MIXED', options={}) {
		// Get package information
		const package_info = _get_package_info(package_id);

		// Validate we're allowed to register wrappers at this moment
		if(package_id != PACKAGE_ID && !libwrapper_ready)
			throw new LibWrapperPackageError('Not allowed to register wrappers before the \'libWrapperReady\' hook fires', package_info);

		// Validate other arguments
		if(!target || typeof target !== 'string')
			throw new LibWrapperPackageError('Parameter \'target\' must be a string.', package_info);

		if(!fn || !(fn instanceof Function))
			throw new LibWrapperPackageError('Parameter \'fn\' must be a function.', package_info);

		type = WRAPPER_TYPES.get(type, null);
		if(type === null)
			throw new LibWrapperPackageError(`Parameter 'type' must be one of [${WRAPPER_TYPES.list.join(', ')}].`, package_info);

		const chain = options?.chain ?? (type.value < WRAPPER_TYPES.OVERRIDE.value);
		if(typeof chain !== 'boolean')
			throw new LibWrapperPackageError(`Parameter 'chain' must be a boolean.`, package_info);

		if(IS_UNITTEST && FORCE_FAST_MODE)
			options.perf_mode = 'FAST';
		const perf_mode = PERF_MODES.get(options?.perf_mode ?? 'AUTO', null);
		if(perf_mode === null)
			throw new LibWrapperPackageError(`Parameter 'perf_mode' must be one of [${PERF_MODE.list.join(', ')}].`, package_info);


		// Split '#set' from the target
		const target_and_setter  = _split_target_and_setter(target);
		const target_without_set = target_and_setter[0];
		const is_setter          = target_and_setter[1];

		// Create wrapper
		let wrapper = _create_wrapper(target, package_info);

		// Only allow '#set' when the wrapper is wrapping a property
		if(is_setter && !wrapper.is_property)
			throw new LibWrapperPackageError(`Cannot register a wrapper for '${target}' by ${package_info.logString}' because '${target_without_set}' is not a property, and therefore has no setter.`, package_info);

		// Check if this wrapper is already registered
		if(_find_package_data_in_wrapper(package_info, wrapper, is_setter))
			throw new LibWrapperPackageError(`A wrapper for '${target}' has already been registered by ${package_info.logString}.`, package_info);

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
					throw new LibWrapperAlreadyOverriddenError(package_info, existing.package_info, wrapper, target);
				}
				else {
					// We trigger a hook first
					if(Hooks.call(`${HOOKS_SCOPE}.OverrideLost`, existing.package_info.id, package_info.id, wrapper.name, wrapper.frozen_names) !== false) {
						const notify_user = LibWrapperConflicts.register_conflict(package_info, existing.package_info, wrapper, null, false);

						if(notify_user) {
							LibWrapperNotifications.conflict(existing.package_info, package_info, false,
								`${package_info.logStringCapitalized} has higher priority, and is replacing the 'OVERRIDE' registered by ${package_info.logString} for '${wrapper.name}'.`
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
			perf_mode    : perf_mode
		};

		wrapper.add(data);

		// Done
		if(DEBUG || (!IS_UNITTEST && package_info.id != PACKAGE_ID)) {
			Hooks.callAll(`${HOOKS_SCOPE}.Register`, package_info.id, target, type, options);
			console.info(`libWrapper: Registered a wrapper for '${target}' by ${package_info.logString} with type ${type}.`);
		}
	}

	/**
	 * Unregister an existing wrapper.
	 *
	 * Triggers FVTT hook 'libWrapper.Unregister' when successful.
	 *
	 * @param {string} package_id  The package identifier, i.e. the 'id' field in your module/system/world's manifest.
	 * @param {string} target      A string containing the path to the function you wish to remove the wrapper from, starting at global scope. For example: 'SightLayer.prototype.updateToken'
	 * @param {function} fail      [Optional] If true, this method will throw an exception if it fails to find the method to unwrap. Default is 'true'.
	 */
	static unregister(package_id, target, fail=true) {
		// Get package information
		const package_info = _get_package_info(package_id);

		// Unregister wrapper
		_unregister(package_info, target, fail);

		// Done
		if(DEBUG || package_info.id != PACKAGE_ID) {
			Hooks.callAll(`${HOOKS_SCOPE}.Unregister`, package_info.id, target);
			console.info(`libWrapper: Unregistered the wrapper for '${target}' by ${package_info.logString}.`);
		}
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
		for(let wrapper of WRAPPERS) {
			this.unregister(package_info.id, wrapper.name, false);

			if(wrapper.is_property)
				this.unregister(package_info.id, `${wrapper.name}#set`, false);
		}

		if(DEBUG || package_info.id != PACKAGE_ID) {
			Hooks.callAll(`${HOOKS_SCOPE}.UnregisterAll`, package_info.id);
			console.info(`libWrapper: Unregistered all wrapper functions by ${package_info.logString}.`);
		}
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
	 * @param {(string|string[])} ignore_ids  Other package ID(s) with which conflicts should be ignored.
	 * @param {(string|string[])} targets     Target(s) for which conflicts should be ignored, corresponding to the 'target' parameter to 'libWrapper.register'.
	 *
	 * @param {Object} options [Optional] Additional options to libWrapper.
	 *
	 * @param {boolean} options.ignore_errors  [Optional] If 'true', will also ignore confirmed conflicts (i.e. errors), rather than only potential conflicts (i.e. warnings).
	 *     Be careful when setting this to 'true', as confirmed conflicts are almost certainly something the user should be made aware of.
	 *     Defaults to 'false'.
	 */
	static ignore_conflicts(package_id, ignore_ids, targets, options={}) {
		// Get package information
		const package_info = _get_package_info(package_id);

		// Validate we are allowed to call this method right now
		if(!libwrapper_ready)
			throw new LibWrapperPackageError('Not allowed to ignore conflicts before the \'libWrapperReady\' hook fires', package_info);

		// Convert parameters to arrays
		if(!Array.isArray(ignore_ids))
			ignore_ids = [ignore_ids];
		if(!Array.isArray(targets))
			targets = [targets];

		// Validate parameters #2
		const is_string = (x) => (typeof x === 'string');

		if(!ignore_ids.every(is_string))
			throw new LibWrapperPackageError(`Parameter 'ignore_ids' must be a string, or an array of strings.`, package_info);

		if(!targets.every(is_string))
			throw new LibWrapperPackageError(`Parameter 'targets' must be a string, or an array of strings.`, package_info);
		if(!targets.every((x) => _valid_target_string(x)))
			throw new LibWrapperPackageError(`Parameter 'targets' must only contain valid targets.`, package_info);

		const ignore_errors = options.ignore_errors ?? false;
		if(typeof ignore_errors !== 'boolean')
			throw new LibWrapperPackageError(`Parameter 'options.ignore_errors' must be a boolean.`, package_info);


		// Convert 'other_ids' to PackageInfo objects and filter out any that do not exist
		const ignore_infos = ignore_ids.map((x) => new PackageInfo(x)).filter((x) => x.exists);

		// Ignore API call if no packages to be ignored
		if(ignore_infos.length == 0) {
			console.debug(`libWrapper: Ignoring 'ignore_conflict' call for ${package_info.logString} since none of the package IDs provided exist or are active.`)
			return;
		}

		// Register ignores
		LibWrapperConflicts.register_ignore(package_info, ignore_infos, targets, ignore_errors);

		if(DEBUG || package_info.id != PACKAGE_ID)
			console.debug(`libWrapper: Ignoring conflicts involving ${package_info.logString} and [${ignore_infos.map((x) => x.logString).join(', ')}] for targets [${targets.join(', ')}].`);
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
			// Unregister our pre-initialisation patches as they are no longer necessary
			if(!IS_UNITTEST) {
				const lw_info = new PackageInfo('lib-wrapper', PACKAGE_TYPES.MODULE);
				_unregister(lw_info, 'Game.toString', /*fail=*/ true);
				_unregister(lw_info, 'Game.prototype.initialize', /*fail=*/ true);
			}

			// Initialization steps
			libwrapper_ready = true;

			parse_manifest_version();
			LibWrapperSettings.init();
			LibWrapperStats.init();
			LibWrapperConflicts.init();
			LibWrapperNotifications.init();

			// Notify everyone the library has loaded and is ready to start registering wrappers
			console.info(`libWrapper ${VERSION_WITH_GIT}: Ready.`);
			Hooks.callAll(`${HOOKS_SCOPE}.Ready`, libWrapper);

			return wrapped(...args);
		}
	};

	if(!IS_UNITTEST) {
		libWrapper.register('lib-wrapper', 'Game.prototype.initialize', obj[libWrapperInit], libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});

		// We need to prevent people patching 'Game' and breaking libWrapper.
		// Unfortunately we cannot re-define 'Game' as a non-settable property, but we can prevent people from using 'Game.toString'.
		libWrapper.register('lib-wrapper', 'Game.toString', function() {
			throw new LibWrapperPackageError("Using 'Game.toString()' before libWrapper initialises is not allowed for compatibility reasons.");
		}, libWrapper.WRAPPER, {perf_mode: libWrapper.PERF_FAST});

		// Add a sanity check hook, just in case someone breaks our initialisation procedure
		Hooks.once('init', ()=>{
			if(!libwrapper_ready)
				throw new LibWrapperInternalError("Could not successfuly initialise libWrapper, likely due to a compatibility issue with another module.");
		});
	}
	else
		obj[libWrapperInit](()=>{});
}

// Lock down registrations using package ID 'lib-wrapper'
allow_libwrapper_registrations = false;