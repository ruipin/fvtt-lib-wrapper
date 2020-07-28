// SPDX-License-Identifier: GPLv3-or-later
// Copyright © 2020 fvtt-resilient-wrapper Rui Pinheiro

'use strict';


ResilientWrapper = (function() {
	const MAJOR_VERSION = 0;
	const MINOR_VERSION = 1;
	const PATCH_VERSION = 0;
	const VERSION = `${MAJOR_VERSION}.${MINOR_VERSION}.${PATCH_VERSION}`;

	// Get global scope
	const glbl = window || global;
	
	if(!glbl)
		throw `ResilientWrapper Library version ${VERSION} failed to initialize, unable to obtain global scope handle.`;

	// Detect if already loaded
	const existing = glbl.ResilientWrapper;
	if(existing) {
		const existing_version = existing.version;
		const existing_major   = existing.major_version;
		const existing_minor   = existing.minor_version;
		const existing_patch   = existing.patch_version;

		if(MAJOR_VERSION < existing.major_version || MINOR_VERSION < existing.minor_version || PATCH_VERSION < existing.patch_version) {
			console.log(`ResilientWrapper Library version ${existing_version} already loaded, which is newer than ${VERSION}.`);
			return existing;
		}
		else if(VERSION != existing_version) {
			console.log(`ResilientWrapper Library version ${existing_version} already loaded, upgrading to ${VERSION}.`);
		}
	}


	// Internal class
	let warnedPreReady = false;
	
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

			if(!descriptor) {
				this.wrapped = undefined;
			}
			else if(descriptor.configurable === false) {
				let wrapper = descriptor.get?.wrapper;

				if(wrapper && wrapper.constructor == this.constructor) {
					if(methods)
						wrapper.push_back(...methods);

					return wrapper;
				}

				throw `Method '${methodName}' cannot be wrapped, the corresponding descriptor has 'configurable=false'.`;
			}
			else {
				this.wrapped = descriptor;
			}

			this._wrap(obj);
		}

		_wrap(obj) {
			// Setup setter / getter
			let _getter = null;
			let _setter = null;

			{
				let _this = this;
				_getter = function() {
					return _this.get_wrapper(this, 0);
				}

				_setter = function(value) {
					return _this.set_wrapper(this, value);
				}
			}

			// We store 'this' inside the getter as a hack, so that multiple places can wrap the same method
			_getter.wrapper = this;

			// Define a property with configurable=false to avoid someone redefining it later
			Object.defineProperty(obj, this.methodName, {
				get: _getter,
				set: _setter,
				configurable: false
			});
		}


		// Getter/setters
		_get_parent_wrapper(obj) {
			if(!obj)
				return null;

			let descriptor = Object.getOwnPropertyDescriptor(obj.constructor.prototype, this.methodName);
			let wrapper = descriptor?.get?.wrapper;

			if(wrapper && wrapper != this)
				return wrapper;

			return null;
		}

		get_wrapper(obj, index, return_descriptor=undefined) {
			if(index < this.wrappers.length) {
				let _method = this.wrappers[index];
				let _next = this.call_wrapper.bind(this, obj, index+1, return_descriptor);

				return function() {
					return _method.call(obj, _next, ...arguments);
				};
			}

			// Get the parent descriptor
			let parent_wrapper = this._get_parent_wrapper(obj);

			// Check for parent wrappers
			if(parent_wrapper && parent_wrapper != this)
				return parent_wrapper.get_wrapper(obj, 0, this.wrapped);

			// Return wrapped value
			if(return_descriptor === undefined)
				return_descriptor = this.wrapped;

			if(return_descriptor.get)
				return return_descriptor.get();

			if(return_descriptor.value === undefined && parent_descriptor)
				return parent_descriptor.value;

			return return_descriptor.value;
		}

		call_wrapper(obj, index, return_descriptor=undefined, ...args) {
			return this.get_wrapper(obj, index, return_descriptor).apply(obj, args);
		}

		set_wrapper(obj, value) {
			// If assigning to an instance directly, create a wrapper for the instance
			if(obj != this.object) {
				let objWrapper = new this.constructor(obj, this.methodName);
				objWrapper.set_wrapper(obj, value);
				return;
			}

			// Otherwise store in the descriptor
			if(this.wrapped.set)
				this.wrapped.set(value);
			else
				this.wrapped.value = value;
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
	};


	// Prevent someone breaking the class by accident
	Object.freeze(ResilientWrapper);


	// Make library available in the global scope
	glbl.ResilientWrapper = ResilientWrapper;


	// Done
	return ResilientWrapper;
})();