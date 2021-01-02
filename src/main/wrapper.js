// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {MODULE_ID, PROPERTIES_CONFIGURABLE, TYPES, DEBUG} from '../consts.js';
import {InvalidWrapperChainError, get_current_module_name, notify_gm} from './utilities.js';
import {LibWrapperStats} from '../stats.js';


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

	get is_property() {
		return (this._wrapped_getter !== undefined);
	}

	// Constructor
	constructor (obj, fn_name, name=undefined) {
		// Check if this object is already wrapped
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
				throw `libWrapper: '${name}' cannot be wrapped, the corresponding descriptor has 'configurable=false'.`;
			}
			else {
				if(descriptor.get) {
					this._wrapped_getter = descriptor.get;
					this._wrapped_setter = descriptor.set;
				}
				else
					this._wrapped = descriptor.value;
			}
		}
		else {
			if(!this._get_inherited(obj, fn_name))
				throw `libWrapper: Can't wrap '${name}', target does not exist or could not be found.`;

			this._wrapped = undefined;
		}

		// Setup instance variables
		this.object  = obj;
		this.names   = [];
		this.fn_name = fn_name;

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

			getter = function() {
				return _this.call_wrapper(null, this);
			}

			setter = function(value) {
				return _this.call_wrapper({setter: true}, this, value);
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
			throw `libWrapper: Cannot unwrap when PROPERTIES_CONFIGURABLE==false`;


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
	_get_parent_wrapper() {
		let descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this.object), this.fn_name);
		let wrapper = descriptor?.get?._lib_wrapper;

		if(wrapper && wrapper != this)
			return wrapper;

		return null;
	}

	_get_inherited(obj, fn_name) {
		let proto = Object.getPrototypeOf(obj);
		if(proto === this.object) proto = Object.getPrototypeOf(proto); // In case this is an inherited wrapper

		if(proto && proto != this.object)
			return proto[fn_name];

		return undefined;
	}

	get_wrapped(obj, setter=false) {
		// If 'obj' is not this.object, then we need to see if it has a local wrapper
		if(obj && obj != this.object) {
			let descriptor = Object.getOwnPropertyDescriptor(obj, this.fn_name);

			let wrapper = descriptor?.get?._lib_wrapper;
			if(wrapper)
				return wrapper.get_wrapped(obj);
		}

		// Properties return the getter or setter, depending on what is requested
		if(this.is_property)
			return setter ? this._wrapped_setter : this._wrapped_getter;

		// If the wrapper is 'empty', this is probably an instance wrapper and we should check our instance's prototype first
		if(this._wrapped === undefined) {
			let result = this._get_inherited(obj, this.fn_name);

			if(result === undefined)
				console.warn(`libWrapper: There is no wrapped method for '${this.name}', returning 'undefined'.`);

			return result;
		}

		// Otherwise we just return our wrapped value
		return this._wrapped;
	}

	call_wrapper(state, obj, ...args) {
		// Set up basic information about this wrapper
		const index = state?.index ?? 0;
		const is_setter = state?.setter ?? false;
		const fn_data = is_setter ? this.setter_data : this.getter_data;

		// Keep track of call state
		if(state) {
			if('valid' in state && !state.valid) {
				let err_msg = `This wrapper function for '${this.name}' is no longer valid, and must not be called.`;

				if(state.prev_data?.module)
					err_msg += ` This error is most likely caused by an issue in module '${state.prev_data.module}'.`;

				throw new InvalidWrapperChainError(this, err_msg);
			}

			if('modification_counter' in state && state.modification_counter != this._modification_counter)
				throw new InvalidWrapperChainError(this, `The wrapper '${this.name}' was modified while a call chain was in progress. The chain is not allowed proceed.`);

			state.called = true;
		}

		// Grab the next function from the function data array
		const data = fn_data[index];
		let fn = data?.fn;

		// If no more methods exist, then finish the chain
		if(!data) {
			// We need to call parent wrappers if they exist
			// Otherwise, we can immediately return the wrapped value
			let parent_wrapper = this._get_parent_wrapper();

			if(parent_wrapper && parent_wrapper != this)
				return parent_wrapper.call_wrapper(null, obj, ...arguments);
			else
				return this.get_wrapped(obj, is_setter)?.apply(obj, args);
		}

		// OVERRIDE type does not continue the chain
		if(data.type >= TYPES.OVERRIDE) {
			// Call next method in the chain
			return fn.apply(obj, args);
		}

		// Prepare the continuation of the chain
		const next_state = {
			setter: is_setter,
			called: false,
			valid : true,
			index : index + 1,
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
				let collect_information = LibWrapperStats.collect_stats;
				let affectedModules = null;
				let is_last_wrapper = false;

				if(collect_information) {
					affectedModules = fn_data.slice(next_state.index).filter((x) => {
						return x.module != data.module;
					}).map((x) => {
						return x.module;
					});
					is_last_wrapper = (affectedModules.length == 0);

					affectedModules.forEach((affected) => {
						LibWrapperStats.register_conflict(data.module, affected, this.name);
					});
				}

				// WRAPPER-type functions that do this are breaking an API requirement, as such we need to be loud about this.
				// As a "punishment" of sorts, we forcefully unregister them and ignore whatever they did.
				if(data.type == TYPES.WRAPPER) {
					console.error(`libWrapper: The wrapper for '${data.target}' registered by module '${data.module}' with type WRAPPER did not chain the call to the next wrapper, which breaks a libWrapper API requirement. This wrapper will be unregistered.`);
					globalThis.libWrapper.unregister(data.module, data.target);

					// Manually chain to the next wrapper if there are more in the chain
					if(!is_last_wrapper) {
						next_state.index -= 1;
						next_state.valid = true;
						next_state.modification_counter = this._modification_counter;
						result = next_fn.apply(obj, args);
					}
				}

				// Other TYPES only get a single log line
				else if(collect_information && (DEBUG || !data.warned_conflict) && !is_last_wrapper) {
					const err_msg = `Possible conflict detected between '${data.module}' and [${affectedModules.join(', ')}].`;
					notify_gm(err_msg);
					console.warn(`libWrapper: ${err_msg} The former did not chain the wrapper for '${data.target}'.`);
					data.warned_conflict = true;
				}
			}

		}

		// Done
		return result;
	}

	set_nonproperty(value, obj=null, reuse_handler=false) {
		// Redirect current handler to directly call the wrapped method
		if(!reuse_handler)
		{
			let wrapped = this._wrapped;

			this.handler.set(function(obj, ...args) {
				return wrapped.apply(obj, args);
			});

			this._create_handler();
		}

		// If assigning to an instance directly, create a wrapper for the instance
		if(obj != this.object) {
			let objWrapper = new this.constructor(obj, this.fn_name, `instanceof ${this.name}`);
			objWrapper.set_nonproperty(value, obj, true);
			return;
		}

		// Wrap the new value and create a new handler
		this._wrapped = value;

		// Warn user and/or log conflict
		if(this.getter_data.length) {
			const warn_in_console = (DEBUG || !this.detected_classic_wrapper);
			const collect_stats = LibWrapperStats.collect_stats;
			const prepare_module_name = (warn_in_console || collect_stats);
			const module_name = prepare_module_name ? get_current_module_name() : null;
			const user_friendly_module_name = module_name ? `<likely '${module_name}'>` : '<unknown>';

			let affectedModules = null;
			if(collect_stats || warn_in_console) {
				affectedModules = this.getter_data.map((x) => {
					return x.module;
				});

				if(collect_stats) {
					affectedModules.forEach((affected) => {
						LibWrapperStats.register_conflict(affected, user_friendly_module_name, this.name);
					});
				}
			}

			if(warn_in_console) {
				const affectedModules_str = (affectedModules.length > 1) ? `[${affectedModules.join(', ')}]` : `'${affectedModules[0]}'`;
				const err_module = module_name ? `module '${module_name}'` : 'an unknown module';

				notify_gm(`Detected potential conflict between ${err_module} and ${affectedModules_str}.`, 'warn');
				console.warn(`libWrapper: Detected non-libWrapper wrapping of '${this.name}' by ${err_module}. This will potentially lead to conflicts with ${affectedModules_str}.`);

				if(DEBUG && console.trace)
					console.trace();
			}

			if(!this.detected_classic_wrapper)
				this.detected_classic_wrapper = []

			this.detected_classic_wrapper.push(user_friendly_module_name);
		}
	}


	// Wraper array methods
	// NOTE: These should only ever be called from libWrapper, they do not clean up after themselves
	get_fn_data(setter) {
		if(setter && !this.is_property)
			throw `libWrapper: '${this.name}' does not wrap a property, thus setter=true is illegal.`;

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