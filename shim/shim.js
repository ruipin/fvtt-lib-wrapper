// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

// A shim for the libWrapper library
(function() {
	// The browser doesn't expose all global variables (e.g. 'Game') inside globalThis, but it does to an eval
	let _libWrapperShim_eval = (__code) => eval(__code);

	{

		const SHIM_SETTINGS ={
			/****************************/
			/* USER CONFIGURATION BEGIN */

			// Warn the GM if libWrapper is not installed
			// Note that if multiple modules use the shim, the final result will be an OR of all of these settings
			warn_missing: false

			/* USER CONFIGURATION END   */
			/****************************/
			// Please do not modify anything outside of the above tags
		}


		// Check if the real module is already loaded, or for a newer shim
		const SHIM_VERSION = 1;
		if(globalThis.libWrapper && (!globalThis.libWrapper.is_shim || globalThis.libWrapper.shim_version < SHIM_VERSION)) {
			globalThis.libWrapper.merge_shim_settings(SHIM_SETTINGS);
			return;
		}

		const SHIM_TITLE = `libWrapperShim v${SHIM_VERSION}`;

		// Shim class
		class libWrapperShim {
			static get shim_version() { return SHIM_VERSION };
			static get is_shim() { return true };
			static get module_active() { return (game.modules.get('lib-wrapper')?.data?.active === true); }
			static merge_shim_settings(settings) { SHIM_SETTINGS.warn_missing |= (settings?.value ?? false); }

			static register(module, target, fn) {
				if(globalThis.libWrapper && globalThis.libWrapper !== this)
					return globalThis.libWrapper.register(...arguments);
				if(globalThis.game === undefined)
					throw `${SHIM_TITLE}: Not allowed to register wrappers before the 'init' hook fires`;
				if(this.module_active)
					return Hooks.once('libWrapperReady', (libWrapper) => libWrapper.register(...arguments));

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

		// Call ready hook, and also warn user to install library
		if(typeof Hooks !== 'undefined') {
			Hooks.once('init', () => {
				if(globalThis.libWrapper !== libWrapperShim)
					return;

				console.info(`${SHIM_TITLE}: Ready.`);
				Hooks.callAll('libWrapperReady', libWrapperShim, false);

				if(SHIM_SETTINGS.warn_missing) {
					Hooks.once('ready', () => {
						if(game.user.isGM)
							ui.notifications.warn("One or more loaded modules depend on the 'libWrapper' module. Installing the module is recommended and will improve their compatibility.");
					});
				}
			});
		}

		// Make shim available at global scope
		globalThis.libWrapper = libWrapperShim;
	}
})();