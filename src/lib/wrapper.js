// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {MODULE_ID, PROPERTIES_CONFIGURABLE, TYPES, DEBUG} from '../consts.js';
import {get_current_module_name} from '../utils/misc.js';
import {LibWrapperInternalError, LibWrapperModuleError, LibWrapperInvalidWrapperChainError} from '../utils/errors.js';
import {LibWrapperNotifications} from '../ui/notifications.js';
import {LibWrapperStats} from '../ui/stats.js';


// Handler class - owns the function that is returned by the wrapper class
class Handler {
	constructor(fn) {
		this.set(fn);

		let _this = this;
		this.fn = function() {
			return _this._fn(this, ...arguments);
		};
	}

	set(fn) {
		this._fn = fn;
	}
}
Object.freeze(Handler);


// Wrapper class - this class is responsible for the actual wrapping
export class Wrapper {
	// Properties
	get name() {
		return this.names[0];
	}

	// Constructor
	constructor (obj, fn_name, name=undefined, module=undefined) {
		// Basic instance variables
		this.fn_name = fn_name;
		this.object  = obj;

		// Calidate whether we can wrap this object
		let descriptor = Object.getOwnPropertyDescriptor(obj, fn_name);

		if(descriptor) {
			if(descriptor.get?._lib_wrapper) {
				let wrapper = descriptor.get?._lib_wrapper;

				if(name && !wrapper.names.indexOf(name))
					wrapper.names.push(name);

				if(wrapper && wrapper instanceof this.constructor)
					return wrapper;
			}

			if(descriptor.configurable === false) {
				throw new LibWrapperModuleError(`libWrapper: '${name}' cannot be wrapped, the corresponding descriptor has 'configurable=false'.`, module);
			}
			else {
				if(descriptor.get) {
					this.is_property = true;
					this._wrapped_getter = descriptor.get;
					this._wrapped_setter = descriptor.set;
				}
				else {
					this.is_property = false;
					this._wrapped = descriptor.value;
				}
			}
		}
		else {
			descriptor = this._get_inherited_descriptor();

			if(!descriptor)
				throw new LibWrapperModuleError(`libWrapper: Can't wrap '${name}', target does not exist or could not be found.`, module);

			const wrapper = descriptor.get?._lib_wrapper;

			if(wrapper) {
				this.is_property = wrapper.is_property;
			}
			else {
				if(descriptor.get ?? descriptor.set)
					this.is_property = true;
				else
					this.is_property = false;
			}
		}

		// Setup instance variables
		this.names   = [];

		this.getter_data = [];
		if(this.is_property)
			this.setter_data = [];

		this.active  = false;

		this._modification_counter = 1;
		this._warned_detected_classic_wrapper = false;

		// Add name
		if(!name)
			name = fn_name;

		if(this.names.indexOf(name) == -1)
			this.names.push(name);

		// Do actual wrapping
		this._wrap();
	}

	_create_handler() {
		this.handler = new Handler(this.call_wrapper.bind(this, null));
	}

	_wrap() {
		if(this.active)
			return;

		// Setup setter/getter
		let getter = null;
		let setter = null;

		if(!this.is_property) {
			// Create a handler
			if(!this.handler)
				this._create_handler();

			// Setup setter / getter
			let _this = this;

			getter = function() {
				return _this.handler.fn;
			};

			setter = function(value) {
				return _this.set_nonproperty(value, this);
			};
		}
		else {
			// Setup setter / getter
			let _this = this;

			getter = function(...args) {
				return _this.call_wrapper(null, this, ...args);
			}

			setter = function(...args) {
				return _this.call_wrapper({setter: true}, this, ...args);
			};
		}

		// Store a reference to this in the getter so that we can support 'singleton'-like functionality
		getter._lib_wrapper = this;

		// Define a property with a getter/setter
		Object.defineProperty(this.object, this.fn_name, {
			get: getter,
			set: setter,
			configurable: PROPERTIES_CONFIGURABLE
		});

		this.active = true;

		console.debug(`libWrapper: Wrapped '${this.name}'.`);
	}

	unwrap() {
		if(!this.active)
			return;

		if(!PROPERTIES_CONFIGURABLE)
			throw new LibWrapperInternalError('libWrapper: Cannot unwrap when PROPERTIES_CONFIGURABLE==false');


		// Kill the handler
		if(this.handler) {
			let _fn_name = this.fn_name;

			this.handler.set(function(obj, ...args) {
				return obj[_fn_name].apply(obj, args);
			});
		}
		this.handler = null

		// Remove the property
		delete this.object[this.fn_name];

		if(this.is_property) {
			Object.defineProperty(this.object, this.fn_name, {
				get: this._wrapped_getter,
				set: this._wrapped_setter,
				configurable: true
			});
		}
		else {
			this.object[this.fn_name] = this._wrapped;
		}

		// Done
		this.active = false;

		console.debug(`libWrapper: Unwrapped '${this.name}'.`);
	}


	// Getter/setters
	_get_inherited_descriptor() {
		let iObj = Object.getPrototypeOf(this.object);
		let descriptor = null;

		while(iObj) {
			descriptor = Object.getOwnPropertyDescriptor(iObj, this.fn_name);
			if(descriptor)
				return descriptor;

			iObj = Object.getPrototypeOf(iObj);
		}

		return null;
	}

	get_wrapped(obj, setter=false) {
		let result;

		// Properties return the getter or setter, depending on what is requested
		if(this.is_property)
			result = setter ? this._wrapped_setter : this._wrapped_getter;
		else
			result = this._wrapped;

		// If this wrapper is 'empty', we need to search up the inheritance hierarchy for the return value
		if(result === undefined) {
			const descriptor = this._get_inherited_descriptor();

			if(descriptor) {
				if(this.is_property) {
					if(!(descriptor.get ?? descriptor.set))
						throw new LibWrapperInternalError(`This wrapper is set up to wrap a property, but the inherited descriptor is a method.`);

					if(setter)
						result = descriptor.set;
					else
						result = descriptor.get;
				}
				else {
					result = descriptor.value ?? descriptor.get.apply(obj);
				}
			}
		}

		// Done
		if(result === undefined)
			console.warn(`libWrapper: There is no wrapped method for '${this.name}', returning 'undefined'.`);

		return result;
	}

	call_wrapper(state, obj, ...args) {
		// Set up basic information about this wrapper
		const index = state?.index ?? 0;
		const is_setter = state?.setter ?? false;
		const fn_data = is_setter ? this.setter_data : this.getter_data

		// Keep track of call state
		if(state) {
			let module = null;
			let err_msg = null;

			if('valid' in state && !state.valid) {
				err_msg = `This wrapper function for '${this.name}' is no longer valid, and must not be called.`;
				module = state.prev_data?.module;
			}

			if('modification_counter' in state && state.modification_counter != this._modification_counter)
				err_msg = `The wrapper '${this.name}' was modified while a call chain was in progress. The chain is not allowed proceed.`;

			if(err_msg)
				throw new LibWrapperInvalidWrapperChainError(this, module, err_msg);

			state.called = true;
		}

		// Grab the next function data from the function data array
		const data = fn_data[index];

		// If no more methods exist, then finish the chain
		if(!data) {
			// We've finished all wrappers. Return the wrapped value from the top wrapper.
			const wrapped = this.get_wrapped(this.object, is_setter);
			return wrapped?.apply(obj, args);
		}

		// Grab wrapper function from function data object
		const fn = data.fn;

		// OVERRIDE type does not continue the chain
		if(data.type >= TYPES.OVERRIDE) {
			// Call next method in the chain
			return fn.apply(obj, args);
		}

		// Prepare the continuation of the chain
		const next_state = {
			setter   : is_setter,
			called   : false,
			valid    : true,
			index    : index + 1,
			prev_data: data,
			modification_counter: this._modification_counter
		};

		const next_fn = this.call_wrapper.bind(this, next_state, obj);

		let result = undefined;

		// Try-catch block to handle normal exception flow
		try {
			// Call next method in the chain
			result = fn.call(obj, next_fn, ...args);
		}
		catch(e) {
			// An exception causes invalidation of next_fn
			next_state.valid = false;
			// Re-throw
			throw e;
		}

		// If the result is a Promise, then we must wait until it fulfills before cleaning up.
		// Per the JS spec, the only way to detect a Promise (since Promises can be polyfilled, extended, wrapped, etc) is to look for the 'then' method.
		// Anything with a 'then' function is technically a Promise. This leaves a path for false-positives, but I don't see a way to avoid this.
		if(typeof result?.then === 'function') {
			result = result.then(
				// onResolved
				v => {
					return this.cleanup_call_wrapper(v, next_state, data, fn_data, next_fn, obj, ...args);
				},
				// onRejected
				e => {
					// The promise being rejected causes invalidation of next_fn
					next_state.valid = false;
					// Re-throw
					throw e;
				}
			);
		}
		// Otherwise, we can immediately cleanup.
		else {
			result = this.cleanup_call_wrapper(result, next_state, data, fn_data, next_fn, obj, ...args);
		}

		// Done
		return result;
	}

	cleanup_call_wrapper(result, next_state, data, fn_data, next_fn, obj, ...args) {
		// Invalidate next_fn to avoid unsynchronous calls
		next_state.valid = false;

		// This method may be called asynchronously! There is no guarantee data/fn_data are still valid.
		// As such, we check 'modification_counter' before running any complex logic.
		if(next_state.modification_counter == this._modification_counter) {

			// Check that next_fn was called
			if(!next_state.called && next_state.modification_counter == this._modification_counter) {
				// We need to collect affected modules information if we're collecting statistics, or we haven't warned the user of this conflict yet.
				let collect_affected = (!data.warned_conflict || LibWrapperStats.collect_stats);
				let affectedModules = null;
				let is_last_wrapper = false;

				if(collect_affected) {
					affectedModules = fn_data.slice(next_state.index).filter((x) => {
						return x.module != data.module;
					}).map((x) => {
						return x.module;
					});

					is_last_wrapper = (affectedModules.length == 0);

					LibWrapperStats.register_conflict(data.module, affectedModules, this.name);
				}

				// WRAPPER-type functions that do this are breaking an API requirement, as such we need to be loud about this.
				// As a "punishment" of sorts, we forcefully unregister them and ignore whatever they did.
				if(data.type == TYPES.WRAPPER) {
					LibWrapperNotifications.console_ui(
						`Error detected in module '${data.module}'.`,
						`The wrapper for '${data.target}' registered by module '${data.module}' with type WRAPPER did not chain the call to the next wrapper, which breaks a libWrapper API requirement. This wrapper will be unregistered.`,
						'error'
					);

					globalThis.libWrapper.unregister(data.module, data.target);

					// Manually chain to the next wrapper if there are more in the chain
					if(!is_last_wrapper) {
						next_state.index -= 1;
						next_state.valid = true;
						next_state.modification_counter = this._modification_counter;
						result = next_fn.apply(obj, args);
					}
				}

				// Other TYPES get a generic 'conflict' message
				else if(!data.warned_conflict && !is_last_wrapper) {
					LibWrapperNotifications.conflict(data.module, affectedModules, true, `Module '${data.module}' did not chain the wrapper for '${data.target}'.`);
					data.warned_conflict = true;
				}
			}

		}

		// Done
		return result;
	}

	set_nonproperty(value, obj=null, reuse_handler=false) {
		if(this.is_property)
			throw new LibWrapperInternalError('Must not call \'set_nonproperty\' when wrapping a property');

		const inherited = (obj != this.object);

		// Redirect current handler to directly call the wrapped method
		if(!reuse_handler)
		{
			if(!inherited) {
				const wrapped = this._wrapped;

				this.handler.set(function(obj, ...args) {
					return wrapped.apply(obj, args);
				});
			}

			this._create_handler();
		}

		// If assigning to an instance directly, create a wrapper for the instance
		if(inherited) {
			// TODO: Do we need to use libWrapper?
			const objWrapper = new this.constructor(obj, this.fn_name, `instanceof ${this.name}`);
			objWrapper.set_nonproperty(value, obj, true);
			return;
		}

		// Wrap the new value and create a new handler
		this._wrapped = value;

		// Warn user and/or log conflict
		this.warn_classic_wrapper();
	}

	get_affected_modules() {
		const affectedModules = this.getter_data.map((x) => {
			return x.module;
		});

		return affectedModules;
	}

	warn_classic_wrapper() {
		let module_name = get_current_module_name();
		module_name = module_name ? `\u00AB${module_name}\u00BB` : '\u00ABunknown\u00BB';

		const affectedModules = this.get_affected_modules();
		LibWrapperStats.register_conflict(module_name, affectedModules, this.name);

		if(affectedModules.length > 0) {
			LibWrapperNotifications.conflict(module_name, affectedModules, true, `Detected non-libWrapper wrapping of '${this.name}' by ${module_name}. This will potentially lead to conflicts.`);

			if(DEBUG && console.trace)
				console.trace();
		}

		if(!this.detected_classic_wrapper)
			this.detected_classic_wrapper = []
		this.detected_classic_wrapper.push(module_name);
	}


	// Wraper array methods
	// NOTE: These should only ever be called from libWrapper, they do not clean up after themselves
	get_fn_data(setter) {
		if(setter && !this.is_property)
			throw new LibWrapperInternalError(`libWrapper: '${this.name}' does not wrap a property, thus setter=true is illegal.`);

		return setter ? this.setter_data : this.getter_data;
	}

	sort() {
		for(let setter of [false, true]) {
			if(setter && !this.is_property)
				continue;

			let fn_data = this.get_fn_data(setter);
			fn_data.sort((a,b) => { return a.type - b.type || b.priority - a.priority });
		}
	}

	add(data) {
		const fn_data = this.get_fn_data(data.setter);

		fn_data.splice(0, 0, data);
		this.sort(data.setter);

		this._modification_counter++;
	}

	remove(data) {
		const fn_data = this.get_fn_data(data.setter);

		const index = fn_data.indexOf(data);
		fn_data.splice(index, 1);

		this._modification_counter++;
	}

	clear() {
		this.getter_data = [];

		if(this.is_property)
			this.setter_data = [];

		this._modification_counter++;
	}

	is_empty() {
		return !this.getter_data.length && !this.setter_data?.length;
	}
};
Object.freeze(Wrapper);