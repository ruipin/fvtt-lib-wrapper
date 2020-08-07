// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

//*********************
// Module information
export const MODULE_ID    = 'lib-wrapper';
export const MODULE_TITLE = 'libWrapper';


//*********************
// Semantic versioning
export const MAJOR_VERSION  = 1;
export const MINOR_VERSION  = 0;
export const PATCH_VERSION  = 0;

// Used to denote special/unstable builds.
export const SUFFIX_VERSION = 'rc4';

// Stringified version
export const VERSION        = `${MAJOR_VERSION}.${MINOR_VERSION}.${PATCH_VERSION}${SUFFIX_VERSION}`;


//*********************
// Miscellaneous definitions
export const IS_UNITTEST = (typeof Game === 'undefined');
export const PROPERTIES_CONFIGURABLE = IS_UNITTEST ? true : false;