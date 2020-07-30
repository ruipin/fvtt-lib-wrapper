// SPDX-License-Identifier: GPLv3-or-later
// Copyright © 2020 fvtt-resilient-wrapper Rui Pinheiro

'use strict';


(function() {
	const MAJOR_VERSION = 0;
	const MINOR_VERSION = 2;
	const PATCH_VERSION = 3;
	const VERSION = `${MAJOR_VERSION}.${MINOR_VERSION}.${PATCH_VERSION}`;

	// Get global scope
	const isNode = (typeof module !== 'undefined' && module.exports);
	const glbl = (typeof window !== "undefined") ? window : (typeof global !== "undefined") ? global : null;

	if(!glbl)
		throw `ResilientWrapper Library version ${VERSION} failed to initialize, unable to obtain global scope handle.`;

	// Detect if already loaded
	const existing = glbl.ResilientWrapper;
	if(existing) {
		const existing_version = existing.version;
		const existing_major   = existing.major_version;
		const existing_minor   = existing.minor_version;
		const existing_patch   = existing.patch_version;

		if(MAJOR_VERSION < existing_major || (MAJOR_VERSION == existing_major && MINOR_VERSION < existing_minor) || (MAJOR_VERSION == existing_major && MINOR_VERSION == existing_minor && PATCH_VERSION < existing_patch)) {
			console.log(`ResilientWrapper Library ${existing_version} already loaded, which is newer than ${VERSION}.`);
			return existing;
		}
		else if(VERSION != existing_version) {
			console.log(`ResilientWrapper Library ${existing_version} already loaded, upgrading to ${VERSION}.`);
		}
	}
	else {
		console.log(`ResilientWrapper Library ${VERSION} loaded.`);
	}


	// Internal class
	let warnedPreReady = false;

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

	class ResilientWrapper {
		// Versions
		static get major_version() {
			return MAJOR_VERSION;
		}

		static get minor_version() {
			return MINOR_VERSION;
		}

		static get patch_version() {
			return PATCH_VERSION;
		}

		static get version() {
			return VERSION;
		}

		static get debug() {
			return false;
		}


		// Constructor
		constructor (obj, methodName, ...methods) {
			// Warn user if they're doing something that could easily break
			if(!game.ready && !warnedPreReady) {
				console.warn("ResilientWrapper ${VERSION}: Wrapping before the 'ready' hook should be avoided when possible, as it can cause compatibility issues.");
				warnedPreReady = true;
			}

			// Setup instance variables
			this.object = obj;
			this.methodName = methodName;
			this.wrappers = methods;

			// Get wrapped value
			let descriptor = Object.getOwnPropertyDescriptor(obj, methodName) || { value: undefined };

			if(descriptor) {
				if(descriptor.get?.wrapper) {
					let wrapper = descriptor.get?.wrapper;

					if(wrapper && wrapper instanceof this.constructor) {
						if(methods)
							wrapper.push_back(...methods);

						return wrapper;
					}
				}


				if(descriptor.configurable === false) {
					throw `Method '${methodName}' cannot be wrapped, the corresponding descriptor has 'configurable=false'.`;
				}
				else {
					if(descriptor.get)
						throw `Wrapping a property ('${methodName}') with a getter/setter is currently not supported.`;
					else
						this.wrapped = descriptor.value;
				}
			}
			else {
				this.wrapped = undefined;
			}

			if(this.debug)
				console.debug(`ResilientWrapper ${VERSION} hooking `);

			this._create_handler();
			this._wrap();
		}

		_wrap() {
			// Setup setter / getter
			let getter = null;
			let setter = null;

			{
				let _this = this;

				getter = function() {
					return _this.handler.fn;
				};

				setter = function(value) {
					return _this.set(value, this);
				};
			}

			// Store a reference to this in the getter so that we can support 'singleton'-like functionality
			getter.wrapper = this;

			// Define a property with a getter/setter
			Object.defineProperty(this.object, this.methodName, {
				get: getter,
				set: setter,
				configurable: true
			});
		}

		_create_handler() {
			this.handler = new Handler(this.call_getter.bind(this, 0));
		}


		// Getter/setters
		_get_parent_wrapper() {
			let descriptor = Object.getOwnPropertyDescriptor(this.object.constructor.prototype, this.methodName);
			let wrapper = descriptor?.get?.wrapper;

			if(wrapper && wrapper != this)
				return wrapper;

			return null;
		}

		get_wrapped(obj) {
			// If 'obj' is not this.object, then we need to see if it has a local wrapper
			if(obj && obj != this.object) {
				let descriptor = Object.getOwnPropertyDescriptor(obj, this.methodName);

				let wrapper = descriptor?.get?.wrapper;
				if(wrapper)
					return wrapper.get_wrapped(obj);
			}

			// Otherwise we just return our wrapped value
			return this.wrapped;
		}

		get_getter(index, obj=null) {
			if(index >= 0 && index < this.wrappers.length) {
				let _method = this.wrappers[index];
				let _next = this.call_getter.bind(this, index+1, obj);

				return function() {
					return _method.call(obj, _next, ...arguments);
				};
			}

			// Call parent wrappers if they exist
			let parent_wrapper = this._get_parent_wrapper();
			if(parent_wrapper && parent_wrapper != this)
				return parent_wrapper.get_getter(0, obj);

			// Return wrapped value
			return this.get_wrapped(obj);
		}

		call_getter(index, obj, ...args) {
			return this.get_getter(index, obj).apply(obj, args);
		}

		set(value, obj=null) {
			// If assigning to an instance directly, create a wrapper for the instance
			if(obj != this.object) {
				let objWrapper = new this.constructor(obj, this.methodName);
				objWrapper.set(value, obj);
				return;
			}

			// Redirect current handler to directly call the wrapped method
			{
				let wrapped = this.wrapped;

				this.handler.set(function(obj, ...args) {
					return wrapped.apply(obj, args);
				});
			}

			// Wrap the new value and create a new handler
			this.wrapped = value;
			this._create_handler();
		}


		// Wraper array methods
		push_front(...methods) {
			this.wrappers.splice(0, 0, ...methods);
		}

		push_back(...methods) {
			this.wrappers.push(...methods);
		}

		pop_front(count=1) {
			return this.wrappers.splice(0, count);
		}

		pop_back(count=1) {
			return this.wrappers.splice(-count, count);
		}

		splice(index, deleteNum=0, ...methods) {
			return this.wrappers.splice(index, deleteNum, ...methods);
		}

		insert(method, index) {
			this.slice(index, 0, method);
		}

		indexOf(method) {
			return this.wrappers.indexOf(method);
		}

		remove(index) {
			this.wrappers.splice(index, 1);
		}

		removeMethod(method) {
			this.wrappers.remove(this.indexOf(method));
		}

		clear() {
			this.wrappers = [];
		}
	};


	// Prevent someone breaking the class by accident
	Object.freeze(ResilientWrapper);


	// Make library available in the global scope or export it for Node
	if(isNode) {
		module.exports = {
			ResilientWrapper: ResilientWrapper
		};
	}
	else {
		// define as property so that it can't be as easily deleted
		delete glbl.ResilientWrapper;
		Object.defineProperty(glbl, 'ResilientWrapper', {
			get: () => { return ResilientWrapper; },
			set: (value) => {},
			configurable: true
		});
	}


	// Done
	return ResilientWrapper;
})();