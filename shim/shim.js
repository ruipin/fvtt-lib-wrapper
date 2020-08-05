// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

const _libWrapperShim_eval = (__code) => eval(__code);

// A shim for the libWrapper library
let libWrapperShimProxy = undefined;
(function() {
	// The browser doesn't expose all global variables (e.g. 'Game') inside globalThis, but it does to an eval

	{
		// Shim settings
		const SHIM_SETTINGS = {
			/****************************/
			/* USER CONFIGURATION BEGIN */

			// Shim title suffix - used for debug messages as well as exceptions thrown by the fallback implementation
			title_suffix: "",

			// Warn the GM if libWrapper is not installed
			warn_missing: false,
			// Warning message
			missing_message: "", //"Module XYZ depends on the 'libWrapper' module, which is not present. A less-compatible fallback implementation will be used.",

			// Debug enables
			debug: false,

			/* USER CONFIGURATION END   */
			/****************************/
		};


		// Check if the real module is already loaded
		const libWrapperExists = function() { return globalThis.libWrapper && !(globalThis.libWrapper.is_fallback ?? true) };
		if(libWrapperExists()) {
			libWrapperShimProxy = globalThis.libWrapper;
			return;
		}

		const SHIM_TITLE = `libWrapperShim${SHIM_SETTINGS.title_suffix}`;

		// Shim class
		class libWrapperShim {
			static _seen_init = false;
			static _ready_callbacks = [];

			static get is_fallback() { return true };

			static register(module, target, fn) {
				if(!this._seen_init)
					throw `${SHIM_TITLE}: Not allowed to register wrappers before the 'init' hook fires`;

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

			static once_ready(callback) {
				if(!this._seen_init)
					return this._ready_callbacks.push(callback);
				callback(this);
			};
		}

		const libWrapperProxyHandler = {
			get: function (target, prop, receiver) {
				// Redirect to the real libWrapper instance if it exists
				if(libWrapperExists())
					return globalThis.libWrapper[prop];

				// Otherwise call our shim
				if(SHIM_SETTINGS.debug)
					console.info(`${SHIM_TITLE}: proxying '${prop}'`);
				return Reflect.get(...arguments);
			},
		};
		libWrapperShimProxy = new Proxy(libWrapperShim, libWrapperProxyHandler);

		// Call ready hook, and also warn user to install library
		if(typeof Hooks !== 'undefined') {
			Hooks.once('init', () => {
				libWrapperShim._seen_init = true;
				if(SHIM_SETTINGS.debug)
					console.info(`${SHIM_TITLE}: Ready.`);

				const _libWrapperExists = libWrapperExists();
				const _libWrapper = _libWrapperExists ? globalThis.libWrapper : libWrapperShimProxy;

				for(let cb of libWrapperShim._ready_callbacks)
					cb(_libWrapper);
				libWrapperShim._ready_callbacks = undefined;

				if(_libWrapperExists)
					return;

				if(SHIM_SETTINGS.warn_missing) {
					Hooks.once('ready', () => {
						if(game.user.isGM)
							ui.notifications.warn(SHIM_SETTINGS.missing_message);
					});
				}
			});
		}
	}
})();

// Export the shim
export { libWrapperShimProxy as libWrapper };