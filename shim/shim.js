// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

// A shim for the libWrapper library
export let libWrapper = undefined;

Hooks.once('init', () => {
	// Check if the real module is already loaded - if so, use it
	if(globalThis.libWrapper && !(globalThis.libWrapper.is_fallback ?? true)) {
		libWrapper = globalThis.libWrapper;
		return;
	}

	// Fallback implementation
	libWrapper = class {
		static get is_fallback() { return true };

		static register(module, target, fn) {
			const is_setter = target.endsWith('#set');
			target = !is_setter ? target : target.slice(0, -4);
			const split = target.split('.');
			const fn_name = split.pop();
			const root_nm = split.splice(0,1)[0];
			const _eval = eval; // The browser doesn't expose all global variables (e.g. 'Game') inside globalThis, but it does to an eval. We copy it to a variable to have it run in global scope.
			const obj = split.reduce((x,y)=>x[y], globalThis[root_nm] ?? _eval(root_nm));

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

	//************** USER CUSTOMIZABLE:
	// Whether to warn GM that the fallback is being used
	const WARN_FALLBACK = true;

	// Set up the ready hook that shows the "libWrapper not installed" warning dialog
	if(WARN_FALLBACK) {
		//************** USER CUSTOMIZABLE:
		// Module ID - by default attempts to auto-detect, but you might want to hardcode your module ID here to avoid potential auto-detect issues
		const MODULE_ID = ((import.meta?.url ?? Error().stack)?.match(/(?<=\/)modules\/.+(?=\/)/i)??[])[0]?.split('/')?.find(n => n && game.modules.has(n));
		if(!MODULE_ID) {
			console.error("libWrapper Shim: Could not auto-detect module ID. The libWrapper fallback warning dialog will be disabled.");
			return;
		}

		Hooks.once('ready', () => {
			// Module title
			const MODULE_TITLE = game.modules.get(MODULE_ID).data.title;

			//************** USER CUSTOMIZABLE:
			// Title and message for the dialog shown when the real libWrapper is not installed.
			const FALLBACK_MESSAGE_TITLE = MODULE_TITLE;
			const FALLBACK_MESSAGE = `
				<p><b>'${MODULE_TITLE}' depends on the 'libWrapper' module, which is not present.</b></p>
				<p>A fallback implementation will be used, which increases the chance of compatibility issues with other modules.</p>
				<small><p>'libWrapper' is a library which provides module developers with a simple way to modify core Foundry VTT code, while reducing the likelihood of conflict with other modules.</p>
				<p>You can install it from the "Add-on Modules" tab in the <a href="javascript:game.shutDown()">Foundry VTT Setup</a>, from the <a href="https://foundryvtt.com/packages/lib-wrapper">Foundry VTT package repository</a>, or from <a href="https://github.com/ruipin/fvtt-lib-wrapper/">libWrapper's Github page</a>.</p></small>
			`;

			// Settings key used for the "Don't remind me again" setting
			const DONT_REMIND_AGAIN_KEY = "libwrapper-dont-remind-again";

			// Dialog code
			console.warn(`${MODULE_TITLE}: libWrapper not present, using fallback implementation.`);
			game.settings.register(MODULE_ID, DONT_REMIND_AGAIN_KEY, { name: '', default: false, type: Boolean, scope: 'world', config: false });
			if(game.user.isGM && !game.settings.get(MODULE_ID, DONT_REMIND_AGAIN_KEY)) {
				new Dialog({
					title: FALLBACK_MESSAGE_TITLE,
					content: FALLBACK_MESSAGE, buttons: {
						ok: { icon: '<i class="fas fa-check"></i>', label: 'Understood' },
						dont_remind: { icon: '<i class="fas fa-times"></i>', label: "Don't remind me again", callback: () => game.settings.set(MODULE_ID, DONT_REMIND_AGAIN_KEY, true) }
					}
				}).render(true);
			}
		});
	}
});