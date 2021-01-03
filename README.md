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
1.  Copy this link and use it in Foundry's Module Manager to install the Module

    > https://github.com/ruipin/fvtt-lib-wrapper/releases/latest/download/module.json

2.  Enable the Module in your World's Module Settings


### As a Library
You have multiple options here.

1.  Include the provided [shim](#shim) in your project.

    or

2.  Write your own shim. **Please do not make your custom shim available in the global scope.**

    or

3.  Trigger a different code path depending on whether libWrapper is installed and active or not. For example:

    ```javascript
    if(game.modules.get('lib-wrapper')?.active) {
        /* libWrapper is active and can be used */
    }
    else {
        /* libWrapper is not active and can't be used */
    }
    ```

4.  Require your users to install this library. One simple example that achieves this is provided below. Reference the more complex example in the provided [shim](#shim) if you prefer a dialog (including an option to dismiss it permanently) instead of a simple notification.

    ```javascript
    Hooks.once('ready', () => {
        if(!game.modules.get('lib-wrapper')?.active && game.user.isGM)
            ui.notifications.error("Module XYZ requires the 'libWrapper' module. Please install and activate it.");
    });
    ```

    Note that if you choose this option and require the user to install this library, you should make sure to list libWrapper as a dependency. This can be done by adding the following to your module's manifest:

    ```javascript
    "dependencies": [
        {
            "name": "lib-wrapper"
        }
    ]
    ```

Once your module is released, you should consider adding it to the wiki list of [Modules using libWrapper](https://github.com/ruipin/fvtt-lib-wrapper/wiki/Modules-using-libWrapper). This list can also be used as an additional (unofficial) source of libWrapper usage examples.


### As a Contributor

You should clone this repository and symlink it inside Foundry VTT's `Data/modules` folder, then restart the server.

-   After cloning this repository, you will need to install NPM and then run the following console commands to set up the development environment:

    ```bash
    npm install
    npm run build
    ```

    These will install the NPM dependencies required for module development, and compile [less/lib-wrapper.less](less/lib-wrapper.less) into `dist/lib-wrapper.css`.

-   The script contains a basic test suite in [tests](tests) which can be used to validate various usage cases and library behaviour. This can be run by doing `npm test`.

    -   ⚠ While this test suite does test a significant amount of the library functionality, it does not achieve full coverage. It is always recommended to test the library with some real-world modules and confirm that they are working as expected.

    -   The wiki list of [Modules using libWrapper](https://github.com/ruipin/fvtt-lib-wrapper/wiki/Modules-using-libWrapper) can be used as a source of modules for testing.

-   To generate a release artifact, you should use the command `npm run build`.

    -   The JS code in [src](src) will be rolled up into a single file and minified automatically, with the corresponding sourcemap also generated. The results of this process are stored in `dist/lib-wrapper.js` and `dist/lib-wrapper.js.map`.

        -   For ease of development, by default the module manifest points to the unprocessed [src/index.js](src/index.js) such that source code changes are immediately visible.

        -   To use the output of the `npm run build` command, you will need to locally update your local [module.json](module.json) to point to `dist/lib-wrapper.js` instead of [src/index.js](src/index.js).

    -   The LESS stylesheet [less/lib-wrapper.less](less/lib-wrapper.less) will be compiled into `dist/lib-wrapper.css`.

    -   Note that the actual [release artifacts](https://github.com/ruipin/fvtt-lib-wrapper/releases) on Github are generated using a custom Github Action, which is responsible for updating the module manifest and packaging the build output into a ZIP file.
        This is implemented in [.github/workflows/release.yml](.github/workflows/release.yml).



## Usage

### Summary

Using this library is very simple. All you need to do is to call the `libWrapper.register` method and provide your module ID, the scope of the method you want to override, and a wrapper function.
You can also specify the type of wrapper you want in the fourth (optional) parameter:

- `WRAPPER`:

    - Use if your wrapper will *always* call the next function in the chain.
    - This type has priority over every other type. It should be used whenever possible as it massively reduces the likelihood of conflicts.
    - Note that the library will auto-detect if you use this type but do not call the original function, and automatically unregister your wrapper.

- `MIXED` (default):

    - Your wrapper will be allowed to decide whether it should call the next function in the chain or not.
    - These will always come after 'WRAPPER'-type wrappers. Order is not guaranteed, but conflicts will be auto-detected.

- `OVERRIDE`:

    - Use if your wrapper will *never* call the next function in the chain. This type has the lowest priority, and will always be called last.
    - If another module already has an 'OVERRIDE' wrapper registered to the same method, using this type will throw a <libWrapper.LibWrapperAlreadyOverriddenError> exception.
      This exception can be caught by your module in order to fail gracefully and activate fallback code.
    - Note that if the GM has explicitly given your module priority over the existing one, no exception will be thrown and your wrapper will take over.

If using `WRAPPER` or `MIXED`, the first parameter passed to your wrapper will be the next wrapper in the wrapper chain, which you can use to continue the call.

```javascript
libWrapper.register('my-fvtt-module', 'Foo.prototype.bar', function (wrapped, ...args) {
    console.log('Foo.prototype.bar was called');
    // ... do things ...
    let result = wrapped(...args);
    // ... do things ...
    return result;
}, 'MIXED' /* optional, since this is the default type */ );
```


### Common Pitfalls

#### OVERRIDE wrappers have a different call signature

When using `OVERRIDE`, wrappers do not receive the next function in the wrapper chain as the first parameter. Make sure to account for this.

```javascript
libWrapper.register('my-fvtt-module', 'Foo.prototype.bar', function (...args) { // There is no 'wrapped' parameter in the wrapper signature
    console.log('Foo.prototype.bar was overridden');
    return;
}, 'OVERRIDE');
```

#### Registering or unregistering a wrapper invalidates any pending wrapper chains for a given method

Due to libWrapper limitations (see [issue #7](https://github.com/ruipin/fvtt-lib-wrapper/issues/7)), currently executing wrapper chains may be invalidated any time a wrapper is registered or unregistered for a given method.

```javascript
libWrapper.register('my-fvtt-module', 'Foo.prototype.bar', function (wrapped, ...args) {
    libWrapper.unregister('my-fvtt-module', 'Foo.prototype.bar');
    return wrapped(...args); // throws libWrapper.LibWrapperInvalidWrapperChainError
});
```

The majority of modules will not have to worry about this, as wrappers will typically be fully synchronous, or will be alone wrapping a given method. However, if modules chain wrappers asynchronously (e.g. inside a `Promise`), they should expect the possibility that the chaining will throw. The likelihood of such invalidation increases the more modules are wrapping the same method and doing things asynchronously.

For example, the following code will execute `wrapped` asynchronously, and therefore could, in rare situations, throw:

```javascript
libWrapper.register('my-fvtt-module', 'Foo.prototype.bar', async function (wrapped, ...args) {
    const a = await some_async_function(); // <- Returns a Promise to the caller
    const b = wrapped(...args); // This runs asynchronously, only after the Promise above completes, and could throw
    // ... do things ...
});
```

As a result, it is recommended to avoid chaining wrappers asynchronously. If at all possible, the `await` should be delayed until after the call to `wrapped`, in order to avoid this issue.

Note that if the first and only asynchronous call is the wrapped method itself, then there is nothing to worry about. For example, the following will not chain asynchronously, and therefore is completely fine:

```javascript
libWrapper.register('my-fvtt-module', 'Foo.prototype.bar', async function (wrapped, ...args) {
    const a = await wrapped(...args); // The call to 'wrapped' happens synchronously, returning a Promise. Only the code below this line runs asynchronously
    // ... do things ...
});
```


### LibWrapper API

#### Registering a wrapper
To register a wrapper function, you should call the method `libWrapper.register(module, target, fn, type)`:

```javascript
/**
 * Register a new wrapper.
 * Important: If called before the 'init' hook, this method will fail.
 *
 * In addition to wrapping class methods, there is also support for wrapping methods on specific object instances, as well as class methods inherited from parent classes.
 * However, it is recommended to wrap methods directly in the class that defines them whenever possible, as inheritance/instance wrapping is less thoroughly tested and will incur a performance penalty.
 *
 * @param {string} module  The module identifier, i.e. the 'name' field in your module's manifest.
 * @param {string} target  A string containing the path to the function you wish to add the wrapper to, starting at global scope, for example 'SightLayer.prototype.updateToken'.
 *                         This works for both normal methods, as well as properties with getters. To wrap a property's setter, append '#set' to the name, for example 'SightLayer.prototype.blurDistance#set'.
 * @param {function} fn    Wrapper function. The first argument will be the next function in the chain, except for 'OVERRIDE' wrappers.
 *                         The remaining arguments will correspond to the parameters passed to the wrapped method.
 * @param {string} type    [Optional] The type of the wrapper. Default is 'MIXED'. The possible types are:
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
 *     If another module already has an 'OVERRIDE' wrapper registered to the same method, using this type will throw a <libWrapper.LibWrapperAlreadyOverriddenError> exception.
 *     Catching this exception should allow you to fail gracefully, and for example warn the user of the conflict.
 *     Note that if the GM has explicitly given your module priority over the existing one, no exception will be thrown and your wrapper will take over.
 *
 *
 */
```

See the usage example above.


#### Unregistering a wrapper
To unregister a wrapper function, you should call the method `libWrapper.unregister(module, target)`.

*Please only use this method to unregister wrapper functions belonging to your module.*

```javascript
/**
 * Unregister an existing wrapper.
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
 *
 * @param {string} module    The module identifier, i.e. the 'name' field in your module's manifest.
 */
```



### Shim

The [shim.js](shim/shim.js) file in this repository can be used to avoid a hard dependency on libWrapper.

The shim exports a 'libWrapper' symbol which will at the 'init' hook become a reference to the real libWrapper library if present, or to a fallback implementation otherwise. This symbol will be `undefined` until the 'init' hook fires. A fallback implementation is included for the `register` function only (see documentation above). This fallback implementation does not have any of the "fancy" features of the libWrapper library - most importantly, it does not check for module conflicts or enforce call order between the different wrapper types, and it does not do dynamic dispatch. *Due to these differences in behaviour, it is extremely important to test your code both with the shim and with the full library.*

To programmatically detect whether the fallback implementation is active, you can check `libWrapper.is_fallback == true`.

To be able to use this shim, your module needs to use `esmodules` in its manifest file. Then, you can import the shim by adding e.g. `import {libWrapper} from './relative/path/to/shim.js';` to your JS code. While the shim is mostly plug-and-play, please feel free to modify it to your liking - in particular, some places you might wish to customize are explicitly marked with `//************** USER CUSTOMIZABLE:`.

#### Default Shim Configuration

By default, the shim displays a warning dialog similar to the image below when libWrapper is not installed and therefore the fallback code path is being used.

This is meant to be a "sane default", but you should feel free to customize this dialog by modifying the shim code or even just strip it out completely if you do not wish to have a warning dialog at all.

<img src="https://raw.githubusercontent.com/ruipin/fvtt-lib-wrapper/d54d5d8c5adbd34bc65396c31f042f3f9d8d6a24/example_warning_dialog.png" width="200">
<sup>Note: Images may be out-of-date.</sup>

### Further examples

A list of modules using libWrapper, which can be used as further examples, can be found in the wiki page [Modules using libWrapper](https://github.com/ruipin/fvtt-lib-wrapper/wiki/Modules-using-libWrapper).