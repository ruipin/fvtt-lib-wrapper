// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';


// HACK: The browser doesn't expose all global variables (e.g. 'Game') inside globalThis, but it does to an eval
// We declare this helper here so that the eval does not have access to the anonymous function scope
export let get_global_variable = function(__varname) {
	// Basic check to make sure we don't do anything too crazy by accident
	if(__varname == '__varname' || !/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(__varname))
		throw `libWrapper: Invalid identifier ${__varname}`;

	return globalThis[__varname] ?? eval(__varname);
}