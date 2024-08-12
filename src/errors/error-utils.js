// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import { PACKAGE_ID } from '../consts.js';
import { PackageInfo, PACKAGE_TYPES } from '../shared/package_info.js';
import { decorate_name } from '../utils/misc.js';
import { Log } from '../shared/log.js';


/*
 * Utility methods for exceptions
 */
export function is_error_object(obj) {
	// We ignore anything that is not an object
	if(obj === null || obj === undefined || typeof obj !== 'object')
		return false;

	// We figure out if this cause has a message and a stack frame - i.e. duck typing of an error object
	if(!('message' in obj) || !('stack' in obj))
		return false;

	// This is (probably) an error
	return true;
}


const LIBWRAPPER_IGNORE_MATCHES = [
	'listeners.js', // ignore anything in the listeners.js file
	decorate_name('call_wrapped'), // shows up every time libWrapper is in the callstack
	decorate_name('Application.prototype._render'), // has a libWrapper patch for unhandled error detection
	decorate_name('Hooks.onError'), // has a libWrapper wrapper for unhandled error detection
];
function get_involved_packages(stack, ignore_ids=undefined) {
	return PackageInfo.collect_all(stack, /* include_fn= */ (id, type, match) => {
		// Include any module that isn't libWrapper
		if(id !== PACKAGE_ID || type !== PACKAGE_TYPES.MODULE)
			return true;

		// We don't include some libWrapper matches - specifically those that are in every single exception, or caused by a different module
		for(const needle of LIBWRAPPER_IGNORE_MATCHES) {
			if(match.includes(needle))
				return false;
		}

		// Otherwise it is included
		return true;
	}, ignore_ids);
}


function get_involved_packages_message(stack, ignore_ids=undefined) {
	const packages = get_involved_packages(stack, ignore_ids);
	const length = packages.length;

	// Zero packages
	if(length <= 0)
		return "[No packages detected]";

	// 1 package
	if(length == 1)
		return `[Detected 1 package: ${packages[0].logIdVersion}]`;

	// 2+ packages
	return`[Detected ${length} packages: ${packages.map((p)=>p.logIdVersion).join(', ')}]`;
}


function has_property_string_writable(obj, prop, allow_missing=false, allow_getter_setter=true) {
	if(!(prop in obj))
		return allow_missing;

	// Get the property's descriptor if available
	const desc = Object.getOwnPropertyDescriptor(obj, prop);
	if(desc) {
		// Handle getter/setter vs value
		if('value' in desc) {
			// Check if the value is a string
			if(typeof desc.value !== 'string') {
				Log.debug$?.(`Object has a non-string '${prop}' property:`, obj);
				return false;
			}

			// Check if it is writable
			if(!desc.writable) {
				Log.debug$?.(`Object has a non-writable '${prop}' property:`, obj);
				return false;
			}
		}
		// Getter/Setter and getter-only
		else if('get' in desc) {
			if(!allow_getter_setter) {
				Log.debug$?.(`Object has a getter '${prop}' property:`, obj);
				return false;
			}

			// Getter-only property
			if(!('set' in desc)) {
				Log.debug$?.(`Object has a getter-only '${prop}' property:`, obj);
				return false;
			}

			// Check if the getter return value is a string
			if(typeof obj[prop] !== 'string') {
				Log.debug$?.(`Object has a non-string-getter '${prop}' property:`, obj);
				return false;
			}
		}
		// Setter-only
		else if('set' in desc) {
			Log.debug$?.(`Object has a setter-only '${prop}' property:`, obj);
			return false;
		}
		// Unknown
		else {
			Log.debug$?.(`Object has an unexpected ${prop} property descriptor:`, obj, desc);
			return false;
		}
	}
	// We assume that if the property descriptor doesn't exist, then it is writable by default
	// But we still need to validate that it exists and is a string
	else {
		const value = obj[prop];

		// Check if the property is undefined
		if(value === undefined) {
			Log.debug$?.(`Object has an undefined '${prop}' property:`, obj);
			return allow_missing;
		}

		// Check if the property is a string
		if(typeof value !== 'string') {
			Log.debug$?.(`Object has a non-string '${prop}' property:`, obj);
			return false;
		}
	}

	// Done
	return true;
}


function can_inject_message(error) {
	// Can't modify a frozen object
	if(Object.isFrozen(error))
		return false;

	// We need both 'message' and 'stack' to be writable strings
	if(!has_property_string_writable(error, 'message') || !has_property_string_writable(error, 'stack', /*allow_missing=*/ false, /*allow_getter_setter=*/ true))
		return false;

	// Done
	return true;
}


export function inject_packages_into_error(error, prepend_stack=undefined) {
	let packages_str;

	try {
		// Sanity check
		if(!is_error_object(error)) {
			Log.debug$?.(`Skipping error package injection because it is not an error object:`, error);
			return;
		}

		// Skip package detection is already marked
		if(error.libwrapper_skip_package_detection)
			return;

		// Test whether error object allows injection
		if(!can_inject_message(error)) {
			Log.debug$?.(`Skipping error package injection because the error object prevents injection:`, error);
			return;
		}

		// Generate involved packages string
		packages_str = get_involved_packages_message(error.stack);

		// Not necessary to inject a second time, if already present
		if(error.message.endsWith(packages_str)) {
			error.libwrapper_skip_package_detection = true;
			return;
		}
	}
	catch (e) {
		Log.error('Exception thrown while attempting to inject package information into an error.', e);
	}

	// Separate try-catch, we don't need to be noisy if the error occurs due to assigning to 'error' members.
	try {
		// Append to error message
		const orig_msg = error.message;
		error.message += `\n${packages_str}`;

		// If the stack contains the error message, replace that as well
		// We use prepend_stack as a workaround to mimic FVTT's Hooks.onError behaviour, see https://github.com/ruipin/fvtt-lib-wrapper/issues/76
		error.stack = error.stack.replace(orig_msg, `${prepend_stack}. ${error.message}`);

		// Done - signal this error doesn't need package detection any more
		error.libwrapper_skip_package_detection = true;
	}
	catch (e) {
		Log.debug$?.('Exception thrown while modifying error object.', e);
	}
}