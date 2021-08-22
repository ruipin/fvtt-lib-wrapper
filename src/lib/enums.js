// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-event-viewer Rui Pinheiro

'use strict';


import {Enum} from '../shared/enums.js';


//*********************
// WRAPPER TYPES
export const WRAPPER_TYPES = Enum('WrapperType', {
	'WRAPPER' : 1,
	'MIXED'   : 2,
	'OVERRIDE': 3
});


//*********************
// PERFORMANCE MODES
export const PERF_MODES = Enum('PerformanceMode', {
	'NORMAL': 1,
	'AUTO'  : 2,
	'FAST'  : 3
});