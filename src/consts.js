// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

//*********************
// Package information
export const PACKAGE_ID    = 'lib-wrapper';
export const PACKAGE_TITLE = 'libWrapper';


//*********************
// Versioning

export let   VERSION           = '';
export let   MAJOR_VERSION     = -1;
export let   MINOR_VERSION     = -1;
export let   PATCH_VERSION     = -1;
export let   SUFFIX_VERSION    = -1;
export let   META_VERSION      = '';
export let   GIT_VERSION       = '';
export let   GIT_VERSION_SHORT = '';
export let   VERSION_WITH_GIT  = '';

export function parse_manifest_version() {
	if(VERSION)
		return;

	// Find package manifest
	const manifest = game.modules?.get(PACKAGE_ID)?.data;
	if(!manifest)
		throw `libWrapper: Unable to find package manifest inside 'game.modules'`;

	// Grab git version
	GIT_VERSION       = manifest.flags?.git_version ?? 'unknown';
	GIT_VERSION_SHORT = (GIT_VERSION.length >= 40) ? GIT_VERSION.slice(0,7) : GIT_VERSION;

	// Parse version string
	const version_str = manifest.version;
	if(!version_str)
		throw `libWrapper: Unable to find version string inside package manifest`;

	const match = version_str.match(/^([0-9]+)\.([0-9]+)\.([0-9]+).([0-9]+)(.*)$/i);
	if(!match)
		throw `libWrapper: Unable to parse version string '${version_str}'`

	VERSION        = match[0];
	MAJOR_VERSION  = parseInt(match[1]);
	MINOR_VERSION  = parseInt(match[2]);
	PATCH_VERSION  = parseInt(match[3]);
	SUFFIX_VERSION = parseInt(match[4]);
	META_VERSION   = match[5].replace(/^-/gi, '');

	// Conclude
	VERSION_WITH_GIT = `${VERSION} (${GIT_VERSION_SHORT})`;
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