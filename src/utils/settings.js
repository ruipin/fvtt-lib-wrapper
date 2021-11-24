// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import { PACKAGE_ID } from '../consts.js';
import { game_user_isGM } from '../shared/polyfill.js'


// Query settings
export function getSetting(key, dflt=undefined) {
	try {
		return game?.settings?.get(PACKAGE_ID, key);
	}
	catch(e) {
		if(dflt !== undefined)
			return dflt;
		throw e;
	}
}

export function getNotifyIssues() {
	const isGM = game_user_isGM(/*return_null*/ true);

	if(isGM === null)
		return true;

	return getSetting(isGM ? 'notify-issues-gm' : 'notify-issues-player', true);
}

export function getHighPerformanceMode() {
	return getSetting('high-performance-mode', false);
}