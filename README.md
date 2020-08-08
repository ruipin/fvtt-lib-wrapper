# FVTT libWrapper
Library for [Foundry VTT](https://foundryvtt.com/) which provides module developers with a simple way to modify core Foundry VTT code, while reducing the likelihood of conflict with other modules.

![Build Release](https://github.com/ruipin/fvtt-lib-wrapper/workflows/Build%20Release/badge.svg)

## Why?

One of the biggest causes of incompatibility between modules is them patching the same method, breaking each other. This module attempts to improve this situation, and also provide module developers with a flexible and easy-to-use API to wrap/monkey-patch core Foundry VTT code.

As a bonus, it provides the GM with module conflict detection, as well as the possibility of prioritizing and/or deprioritizing certain modules, which can help resolve conflicts if they do arise.

### Examples

<img src="https://raw.githubusercontent.com/ruipin/fvtt-lib-wrapper/7cb19d4def1d5ebf84f4df5753f8e48ecfc1523c/example_priorities.png" width="200">
<img src="https://raw.githubusercontent.com/ruipin/fvtt-lib-wrapper/7cb19d4def1d5ebf84f4df5753f8e48ecfc1523c/example_conflicts.png" width="200">
<img src="https://raw.githubusercontent.com/ruipin/fvtt-lib-wrapper/7cb19d4def1d5ebf84f4df5753f8e48ecfc1523c/example_active_wrappers.png" width="200">

<sup>Note: Images may be out-of-date.</sup>


## Installation

### As a Module
1. Copy this link and use it in Foundry's Module Manager to install the Module

    > https://github.com/ruipin/fvtt-lib-wrapper/releases/latest/download/module.json

2. Enable the Module in your World's Module Settings

### As a Library
You have multiple options here.

1. Include the provided [shim](#shim) in your project.

    or

2. Write your own shim. Note that if you pick this route, **please do not make your custom shim available in the global scope**.

    or

3. Require your users to install this library. One simple example that achieves this is provided below. Reference the more complex example in the provided [shim](#shim) if you prefer a dialog (including an option to dismiss it permanently) instead of a simple notification.

```javascript
Hooks.once('ready', () => {
	if(!game.modules.get('lib-wrapper')?.active && game.user.isGM)
		ui.notifications.error("Module XYZ requires the 'libWrapper' module. Please install and activate it.");
});
```

### As a Contributor

1. Copy this link and use it in Foundry's Module Manager to install the latest master:

    > https://raw.githubusercontent.com/ruipin/fvtt-lib-wrapper/master/module.json

3. By default, master's `module.json` manifest loads [src/index.js](src/index.js) and `dist/lib-wrapper.css`. You can build the latter (as well as `dist/lib-wrapper.js`) by running the following commands:

```bash
npm install
npm run build
```



## Usage

### Library

Using this library is very simple. All you need to do is to call the `libWrapper.register` method and provide your module ID, the scope of the method you want to override, and a wrapper function.

```javascript
libWrapper.register('my-fvtt-module', 'SightLayer.prototype.updateToken', function (wrapped, ...args) {
    console.log('updateToken was called');
    return wrapped.apply(this, args);
});
```

#### Registering a wrapper
To register a wrapper function, you should call the method `libWrapper.register(module, target, fn, type)`:

```javascript
/**
 * Register a new wrapper.
 * Important: If called before the 'init' hook, this method will fail.
 *
 * @param {string} module  The module identifier, i.e. the 'name' field in your module's manifest.
 * @param {string} target  A string containing the path to the function you wish to add the wrapper to, starting at global scope, for example 'SightLayer.prototype.updateToken'.
 *                         This works for both normal methods, as well as properties with getters. To wrap a property's setter, append '#set' to the name, for example 'SightLayer.prototype.blurDistance#set'.
 * @param {function} fn    Wrapper function. When called, the first argument will be the next function in the chain. The remaining arguments will correspond to the parameters passed to the wrapped method.
 * @param {string} type    The type of the wrapper. Default is 'MIXED'. The possible types are:
 *
 *   'WRAPPER':
 *     Use if your wrapper will *always* call the next function in the chain.
 *     This type has priority over every other type. It should be used whenever possible as it massively reduces the likelihood of conflicts.
 *     Note that the library will auto-detect if you use this type but do not call the original function, and automatically unregister your wrapper.
 *
 *   'MIXED':
 *     Default type. Your wrapper will be allowed to decide whether it should call the next function in the chain or not.
 *     These will always come after 'WRAPPER'-type wrappers. Order is not guaranteed, but conflicts will be auto-detected.
 *
 *   'OVERRIDE':
 *     Use if your wrapper will *never* call the next function in the chain. This type has the lowest priority, and will always be called last.
 *     If another module already has an 'OVERRIDE' wrapper registered to the same method, using this type will throw a <AlreadyOverriddenError> exception.
 *     Catching this exception should allow you to fail gracefully, and for example warn the user of the conflict.
 *     Note that if the GM has explicitly given your module priority over the existing one, no exception will be thrown and your wrapper will take over.
 */
```

See the usage example above.


#### Unregistering a wrapper
To unregister a wrapper function, you should call the method `libWrapper.unregister(module, target)`.

*Please only use this method to unregister wrapper functions belonging to your module.*

```javascript
/**
 * Unregister an existing wrapper.
 * Please do not use this to remove other module's wrappers.
 *
 * @param {string} module    The module identifier, i.e. the 'name' field in your module's manifest.
 * @param {string} target    A string containing the path to the function you wish to remove the wrapper from, starting at global scope. For example: 'SightLayer.prototype.updateToken'
 * @param {function} fail    [Optional] If true, this method will throw an exception if it fails to find the method to unwrap. Default is 'true'.
 */
```


#### Unregister a module
To unregister all wrapper functions belonging to a given module, you should call the method `libWrapper.clear_module(module)`.

*Please only use this method to unregister wrapper functions belonging to your module.*

```javascript
/**
 * Clear all wrappers created by a given module.
 * Please do not use this to remove other module's wrappers.
 *
 * @param {string} module    The module identifier, i.e. the 'name' field in your module's manifest.
 */
```



### Shim

The [shim.js](shim/shim.js) file in this repository can be used to avoid a hard dependency on libWrapper. If you are planning to use this library, it is recommended to use this shim.

The shim exports a 'libWrapper' symbol which will at the 'init' hook become a reference to the real libWrapper library if present, or to a fallback implementation otherwise. This symbol will be `undefined` until the 'init' hook fires. A fallback implementation is included for the `register` function only (see documentation above). This fallback implementation does not have any of the "fancy" features of the libWrapper library - most importantly, it does not check for module conflicts or enforce call order between the different wrapper types. To programmatically detect whether the fallback implementation is active, you can check `libWrapper.is_fallback == true`.

To be able to use this shim, your module needs to use `esmodules` in its manifest file. Then, you can import the shim by adding e.g. `import {libWrapper} from './relative/path/to/shim.js';` to your JS code. While the shim is mostly plug-and-play, please feel free to modify it to your liking - in particular, some places you might wish to customize are explicitly marked with `//************** USER CUSTOMIZABLE:`.

#### Default Shim Configuration

By default, the shim displays a warning dialog similar to the image below when libWrapper is not installed and therefore the fallback code path is being used.

This is meant to be a "sane default", but you should feel free to customize this dialog by modifying the shim code or even just strip it out completely if you do not wish to have a warning dialog at all.

<img src="https://raw.githubusercontent.com/ruipin/fvtt-lib-wrapper/d54d5d8c5adbd34bc65396c31f042f3f9d8d6a24/example_warning_dialog.png" width="200">
<sup>Note: Images may be out-of-date.</sup>