// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

import test from 'tape';


// Emulate hooks
class Hooks {
	static callAll() {}

	static once(key, cb) {
		console.log(`Hooks.once('${key}') triggered`);
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

	register() {
	}

	set(module, setting, value) {
		this.SETTINGS.set(`${module}.${setting}`, value);
	}

	get(module, setting) {
		return this.SETTINGS.get(`${module}.${setting}`);
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
		game.modules.set(nm, { active: true, data: { title: nm } });
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
		console.error(`(UI) ${msg}`);
	}

	warn(msg) {
		console.warn(`(UI) ${msg}`);
	}
}
globalThis.ui = { notifications: new UiNotifications() };




// Wrap helpers to bypass libWrapper public API
export const wrap_front = function(obj, fn_name, fn, is_setter=false) {
	const wrapper = libWrapper._create_wrapper_from_object(obj, fn_name);
	wrapper.get_fn_data(is_setter).splice(0, 0, {
		fn: fn,
		priority: undefined,
		active: true
	});
};

export const unwrap_all_from_obj = function(obj, fn_name, is_setter=false) {
	const wrapper = libWrapper._create_wrapper_from_object(obj, fn_name);
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