// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

//*********************
// Module information
export const MODULE_ID    = 'lib-wrapper';
export const MODULE_TITLE = 'libWrapper';


//*********************
// Semantic versioning

export let VERSION        = '';
export let MAJOR_VERSION  = -1;
export let MINOR_VERSION  = -1;
export let PATCH_VERSION  = -1;
export let SUFFIX_VERSION = '';

export function parse_manifest_version() {
	if(VERSION)
		return;

	const version_str = game.modules?.get(MODULE_ID)?.data?.version;
	if(!version_str)
		throw `libWrapper: Unable to find version string inside 'game.modules'`;

	const match = version_str.match(/^([0-9]+)\.([0-9]+)\.([0-9]+)[.-]?(.*)$/i);
	if(!match)
		throw `libWrapper: Unable to parse version string '${version_str}'`

	VERSION        = match[0];
	MAJOR_VERSION  = parseInt(match[1]);
	MINOR_VERSION  = parseInt(match[2]);
	PATCH_VERSION  = parseInt(match[3]);
	SUFFIX_VERSION = parseInt(match[4]);
	if(isNaN(SUFFIX_VERSION)) SUFFIX_VERSION = match[4];
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