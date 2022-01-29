// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

import test from 'tape';
import fs from 'fs';
import {PACKAGE_ID} from '../src/consts.js';
import {Log} from '../src/shared/log.js';


// Tell Node to give us longer callstacks
Error.stackTraceLimit = Infinity;


// Emulate hooks
class Hooks {
	static callAll(hook) {
		Log.debug$?.(`Hooks.callAll('${hook}') triggered`);
		return true;
	}

	static call(hook) {
		Log.debug$?.(`Hooks.call('${hook}') triggered`);
		return true;
	}

	static once(key, cb) {
		Log.debug$?.(`Hooks.once('${key}') triggered`);
		cb();
	}
};
globalThis.Hooks = Hooks;


// Empty FormApplication
class FormApplication {
}
globalThis.FormApplication = FormApplication;


// Game
class GameSettings {
	constructor() {
		this.SETTINGS = new Map();
	}

	register(module, name, data) {
		if(module !== PACKAGE_ID)
			throw `game.settings.register module must be '${PACKAGE_ID}', got '${module}'`;

		this.set(module, name, data?.default);
	}

	set(module, setting, value) {
		this.SETTINGS.set(`${module}.${setting}`, value);
	}

	get(module, setting) {
		return this.SETTINGS.get(`${module}.${setting}`);
	}

	registerMenu() {
	}
}


class Game {
	constructor() {
		this.modules = new Map();
		this.settings = new GameSettings();
		this.user = { isGM: true, userId: 12345 };
		this.userId = 12345;
		this.data = {
			userId: 12345,
			users: [
				{
					_id: 12345,
					role: 4
				}
			],
			system: {
				id: 'example-system'
			},
			world: {
				id: 'example-world'
			}
		}
		this.ready = true;
	}

	add_module(nm) {
		const mdl = { id: nm, active: true, data: { title: nm } };

		if(nm === PACKAGE_ID)
			mdl.data = JSON.parse(fs.readFileSync('module.json', 'utf8'));
		else
			mdl.data = { title: nm };

		game.modules.set(nm, mdl);
	}

	clear_modules() {
		this.modules.clear();
		this.add_module('lib-wrapper');
	}
}
globalThis.game = new Game();
globalThis.game.clear_modules();


// UI Notifications
class UiNotifications {
	error(msg) {
		if(this !== globalThis.ui.notifications)
			throw "ui.notifications.error 'this' is not 'globalThis.ui.notifications";

		Log.error$?.(`(UI) ${msg}`);
	}

	warn(msg) {
		if(this !== globalThis.ui.notifications)
			throw "ui.notifications.warn 'this' is not 'globalThis.ui.notifications";

		Log.warn$?.(`(UI) ${msg}`);
	}
}
globalThis.ui = { notifications: new UiNotifications() };


// Dialog
class Dialog {
	render() {}
}
globalThis.Dialog = Dialog;



// Wrap helpers to bypass libWrapper public API
export const wrap_front = function(obj, fn_name, fn, {is_setter=false, chain=true, perf_mode='AUTO'}={}) {
	const wrapper = libWrapper._UT_create_wrapper_from_object(obj, fn_name);
	wrapper.get_fn_data(is_setter, true).splice(0, 0, {
		fn: fn,
		priority: undefined,
		active: true,
		chain: chain,
		perf_mode: libWrapper._UT_get_force_fast_mode() ? 'FAST' : perf_mode
	});
};

export const unwrap_all_from_obj = function(obj, fn_name, is_setter=false) {
	const wrapper = libWrapper._UT_create_wrapper_from_object(obj, fn_name);
	wrapper.clear();
}



// Async helpers
export const test_combinations = async function(title, fn, {sync_async=true, fast_mode=true}={}) {
	for(let is_async of sync_async ? [false, true] : [false]) {
		for(let is_fast_mode of fast_mode ? [false, true] : [false]) {
			test(`${title}${is_async ? ' (async)' : ''}${is_fast_mode ? ' (fast)' : ''}`, async function(t) {
				t.test_async = is_async;
				t.fast_mode = is_fast_mode;

				libWrapper._UT_force_fast_mode(is_fast_mode);

				return fn(t);
			});
		}
	}
}

export const ASYNC_TIMEOUT = 10;

export const async_retval = function(in_value, timeout=ASYNC_TIMEOUT) {
	return new Promise(resolve => setTimeout(() => { resolve(in_value) }, timeout));
}

export const retval = function(t, in_value, timeout=ASYNC_TIMEOUT) {
	return t.test_async ? async_retval(in_value, timeout) : in_value;
}

export const is_promise = function(obj) {
	return (typeof obj?.then === 'function')
}

export const sync_async_then = function(obj, fn) {
	if(is_promise(obj))
		return obj.then(fn);

	return fn(obj);
}