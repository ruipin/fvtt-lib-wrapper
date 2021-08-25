// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import { PACKAGE_ID } from '../consts.js';
import { PackageInfo, PACKAGE_TYPES } from '../shared/package_info.js';
import { decorate_name } from '../utils/misc.js';


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
	'/listeners.js', // ignore anything in the listeners.js file
	decorate_name('call_wrapped'), // shows up every time libWrapper is in the callstack
	decorate_name('Application.prototype._render'), // has a libWrapper patch for unhandled error detection
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
		return `[Detected 1 package: ${packages[0].logId}]`;

	// 2+ packages
	return`[Detected ${length} packages: ${packages.map((p)=>p.logId).join(', ')}]`;
}


function has_property_string_writable(obj, prop) {
	if(!(prop in obj))
		return false

	// Get the property's descriptor if available
	const desc = Object.getOwnPropertyDescriptor(obj, prop);
	if(desc) {
		// Check if the descriptor is not a getter/setter
		if(!('value' in desc))
			return false;

		// Check if the value is a string
		if(typeof desc.value !== 'string')
			return false;

		// Check if it is writable
		if(!desc.writable)
			return false;
	}
	// We assume that if the property descriptor doesn't exist, then it is writable by default
	// But we still need to validate that it is a string
	else {
		const value = obj[prop];

		if(typeof value !== 'string')
			return false;
	}

	// Done
	return true;
}


function can_inject_message(error) {
	// Can't modify a frozen object
	if(Object.isFrozen(error))
		return false;

	// We need both 'message' and 'stack' to be writable strings
	if(!has_property_string_writable(error, 'message') || !has_property_string_writable(error, 'stack'))
		return false;

	// Done
	return true;
}


export function inject_packages_into_error(error, ignore_ids=undefined) {
	// Sanity check
	if(!is_error_object(error))
		return;

	// Skip package detection is already marked
	if(error.skip_package_detection)
		return;

	// Test whether error object allows injection
	if(!can_inject_message(error))
		return;

	// Generate involved packages string
	const packages_str = get_involved_packages_message(error.stack, ignore_ids);

	// Not necessary to inject a second time, if already present
	if(error.message.endsWith(packages_str)) {
		error.skip_package_detection = true;
		return;
	}

	// Append to error message
	const orig_msg = error.message;
	error.message += `\n${packages_str}`;

	// If the stack contains the error message, replace that as well
	error.stack = error.stack.replace(orig_msg, error.message);

	// Done - signal this error doesn't need package detection any more
	error.skip_package_detection = true;
}