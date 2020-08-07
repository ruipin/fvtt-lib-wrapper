// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

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


class FormApplication {
}
globalThis.FormApplication = FormApplication;


class GameSettings {
	register() {
	}

	get() {
		return true;
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


export let wrap_front = function(obj, fn_name, fn, is_setter=false) {
	const wrapper = libWrapper._create_wrapper_from_object(obj, fn_name);
	wrapper.get_fn_data(is_setter).splice(0, 0, {
		fn: fn,
		priority: undefined,
		active: true
	});
};