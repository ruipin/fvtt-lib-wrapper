// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

//*********************
// Package information
export const PACKAGE_ID    = 'lib-wrapper';
export const PACKAGE_TITLE = 'libWrapper';


//*********************
// Versioning

export let   VERSION_KNOWN     = false;
export let   VERSION           = '1.99.99.99';
export let   MAJOR_VERSION     = 1;
export let   MINOR_VERSION     = 99;
export let   PATCH_VERSION     = 99;
export let   SUFFIX_VERSION    = 99;
export let   META_VERSION      = '';
export let   GIT_VERSION       = 'unknown';
export let   GIT_VERSION_SHORT = 'unknown';
export let   VERSION_WITH_GIT  = '1.99.99.99 (unknown)';


export function parse_manifest_version() {
	if(VERSION_KNOWN)
		return;

	try {
		const throw_error = (msg) => { throw `libWrapper: ${msg}.\nFoundry might not have initialized properly, please try refreshing.` };

		// Get package manifest
		if(!game.modules)
			throw_error(`Could not find 'game.modules'`);

		if(!game.modules.size)
			throw_error(`Map 'game.modules' is empty`);

		const lw_module = game.modules.get('lib-wrapper');
		if(!lw_module)
			throw_error(`Could not find 'game.modules.get("lib-wrapper")'`);

		const manifest = lw_module.data;
		if(!manifest)
			throw_error(`Could not find 'game.modules.get("lib-wrapper").data'`);

		// Grab git version
		GIT_VERSION       = manifest.flags?.git_version ?? 'unknown';
		GIT_VERSION_SHORT = (GIT_VERSION.length >= 40) ? GIT_VERSION.slice(0,7) : GIT_VERSION;

		// Parse version string
		const version_str = manifest.version;
		if(!version_str)
			throw_error(`libWrapper: Unable to find version string inside package manifest`);

		const match = version_str.match(/^([0-9]+)\.([0-9]+)\.([0-9]+).([0-9]+)(.*)$/i);
		if(!match)
			throw_error(`libWrapper: Unable to parse version string '${version_str}'`);

		VERSION        = match[0];
		MAJOR_VERSION  = parseInt(match[1]);
		MINOR_VERSION  = parseInt(match[2]);
		PATCH_VERSION  = parseInt(match[3]);
		SUFFIX_VERSION = parseInt(match[4]);
		META_VERSION   = match[5].replace(/^-/gi, '');

		// Conclude
		VERSION_WITH_GIT = `${VERSION} (${GIT_VERSION_SHORT})`;
		VERSION_KNOWN  = true;
	}
	catch(e) {
		console.error(e);
		Hooks?.once('ready', () => globalThis?.ui?.notifications?.error?.(e));
	}
}


//*********************
// Miscellaneous definitions
export const IS_UNITTEST = (typeof Game === 'undefined');
export const PROPERTIES_CONFIGURABLE = IS_UNITTEST ? true : false;


//*********************
// Debug
export let DEBUG = false;
export function setDebug(new_debug) { DEBUG = new_debug; }


//*********************
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


//*********************
// PERFORMANCE MODES
export const PERF_MODES_LIST = ['STANDARD', 'AUTO', 'FAST'];
Object.freeze(PERF_MODES_LIST);

export const PERF_MODES = {
	STANDARD: 1,
	AUTO    : 2,
	FAST    : 3
};
Object.freeze(PERF_MODES);

export const PERF_MODES_REVERSE = {};
for(let key in PERF_MODES) {
	PERF_MODES_REVERSE[PERF_MODES[key]] = key;
}
Object.freeze(PERF_MODES_REVERSE);