// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

// The browser doesn't expose all global variables (e.g. 'Game') inside globalThis, but it does to an eval
const _libWrapperShim_eval = (__code) => eval(__code);

// A shim for the libWrapper library
let libWrapperShim = undefined;
export { libWrapperShim as libWrapper };

Hooks.once('init', () => {
	// Check if the real module is already loaded
	if(globalThis.libWrapper && !(globalThis.libWrapper.is_fallback ?? true)) {
		libWrapperShim = globalThis.libWrapper;
		return;
	}

	// Warning message if libWrapper is not installed - leave empty to disable
	// e.g. "Module XYZ depends on the 'libWrapper' module, which is not present. A less-compatible fallback implementation will be used."
	const SHIM_WARNING_MESSAGE = "";

	// Shim class
	libWrapperShim = class {
		static get is_fallback() { return true };

		static register(module, target, fn) {
			const is_setter = target.endsWith('#set');
			target = !is_setter ? target : target.slice(0, -4);
			const split = target.split('.');
			const fn_name = split.pop();
			const root_nm = split.splice(0,1)[0];
			const obj = split.reduce((x,y)=>x[y], globalThis[root_nm] ?? _libWrapperShim_eval(root_nm));

			const descriptor = Object.getOwnPropertyDescriptor(obj, fn_name);
			if(descriptor.value) {
				const original = obj[fn_name];
				obj[fn_name] = function() { return fn.call(this, original, ...arguments); };
				return;
			}

			if(!is_setter) {
				let original = descriptor.get;
				descriptor.get = function() { return fn.call(this, original, ...arguments); };
			}
			else {
				let original = descriptor.set;
				descriptor.set = function() { return fn.call(this, original, ...arguments); };
			}
			descriptor.configurable = true;
			Object.defineProperty(obj, fn_name, descriptor);
		}
	}

	if(SHIM_WARNING_MESSAGE) {
		Hooks.once('ready', () => {
			if(game.user.isGM)
				ui.notifications.warn(SHIM_WARNING_MESSAGE);
		});
	}
});