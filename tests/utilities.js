// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

import test from 'tape';
import {MODULE_ID} from '../src/consts.js';


// Tell Node to give us longer callstacks
Error.stackTraceLimit = Infinity;


// Emulate hooks
class Hooks {
	static callAll(hook) {
		console.debug(`Hooks.callAll('${hook}') triggered`);
		return true;
	}

	static call(hook) {
		console.debug(`Hooks.call('${hook}') triggered`);
		return true;
	}

	static once(key, cb) {
		console.debug(`Hooks.once('${key}') triggered`);
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
		if(module !== MODULE_ID)
			throw `game.settings.register module must be '${MODULE_ID}', got '${module}'`;

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
		this.user = { isGM: true };
		this.ready = true;
	}

	add_module(nm) {
		const mdl = { active: true, data: { title: nm } };

		if(nm === MODULE_ID)
			mdl.data.version = '12.13.14.15ut';

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

		console.error(`(UI) ${msg}`);
	}

	warn(msg) {
		if(this !== globalThis.ui.notifications)
			throw "ui.notifications.warn 'this' is not 'globalThis.ui.notifications";

		console.warn(`(UI) ${msg}`);
	}
}
globalThis.ui = { notifications: new UiNotifications() };


// Dialog
class Dialog {
	render() {}
}
globalThis.Dialog = Dialog;



// Wrap helpers to bypass libWrapper public API
export const wrap_front = function(obj, fn_name, fn, is_setter=false, chain=true) {
	const wrapper = libWrapper._UT_create_wrapper_from_object(obj, fn_name);
	wrapper.get_fn_data(is_setter).splice(0, 0, {
		fn: fn,
		priority: undefined,
		active: true,
		chain: chain
	});
};

export const unwrap_all_from_obj = function(obj, fn_name, is_setter=false) {
	const wrapper = libWrapper._UT_create_wrapper_from_object(obj, fn_name);
	wrapper.get_fn_data(is_setter).splice(0);
}



// Async helpers
export const test_sync_async = async function(title, fn) {
	for(let is_async of [false, true]) {
		test(is_async ? `${title} (async)` : title, async function(t) {
			t.test_async = is_async;

			return fn(t);
		});
	}
}

export const ASYNC_TIMEOUT = 10;

export const async_retval = function(in_value) {
	return new Promise(resolve => setTimeout(() => { resolve(in_value) }, ASYNC_TIMEOUT));
}

export const is_promise = function(obj) {
	return (typeof obj?.then === 'function')
}

export const sync_async_then = function(obj, fn) {
	if(is_promise(obj))
		return obj.then(fn);

	return fn(obj);
}