# 1. FVTT libWrapper
Library for [Foundry VTT](https://foundryvtt.com/) which provides package developers with a simple way to modify core Foundry VTT code, while reducing the likelihood of conflict with other packages.

[![License](https://img.shields.io/github/license/ruipin/fvtt-lib-wrapper)](LICENSE)
[![Build Release](https://github.com/ruipin/fvtt-lib-wrapper/workflows/Build%20Release/badge.svg)](https://github.com/ruipin/fvtt-lib-wrapper/releases/latest)
[![Version (latest)](https://img.shields.io/github/v/release/ruipin/fvtt-lib-wrapper)](https://github.com/ruipin/fvtt-lib-wrapper/releases/latest)
[![Foundry Version](https://img.shields.io/badge/dynamic/json.svg?url=https://github.com/ruipin/fvtt-lib-wrapper/releases/latest/download/module.json&label=Foundry%20Version&query=$.compatibleCoreVersion&colorB=blueviolet)](https://github.com/ruipin/fvtt-lib-wrapper/releases/latest)
[![GitHub downloads (latest)](https://img.shields.io/badge/dynamic/json?label=Downloads@latest&query=assets[?(@.name.includes('zip'))].download_count&url=https://api.github.com/repos/ruipin/fvtt-lib-wrapper/releases/latest&color=green)](https://github.com/ruipin/fvtt-lib-wrapper/releases/latest)
[![Forge Install Base](https://img.shields.io/badge/dynamic/json?label=Forge%20Install%20Base&query=package.installs&suffix=%&url=https://forge-vtt.com/api/bazaar/package/lib-wrapper&colorB=brightgreen)](https://forge-vtt.com/)
[![GitHub issues](https://img.shields.io/github/issues-raw/ruipin/fvtt-lib-wrapper)](https://github.com/ruipin/fvtt-lib-wrapper/issues)
[![Ko-fi](https://img.shields.io/badge/-buy%20me%20a%20coffee-%23FF5E5B?logo=Ko-fi&logoColor=white)](https://ko-fi.com/ruipin)

- [1. FVTT libWrapper](#1-fvtt-libwrapper)
  - [1.1. Why?](#11-why)
  - [1.2. Installation](#12-installation)
    - [1.2.1. As a Module](#121-as-a-module)
    - [1.2.2. As a Library](#122-as-a-library)
    - [1.2.3. As a Contributor](#123-as-a-contributor)
  - [1.3. Usage](#13-usage)
    - [1.3.1. Summary](#131-summary)
    - [1.3.2. Common Pitfalls](#132-common-pitfalls)
      - [1.3.2.1. Not allowed to register wrappers before the `init` hook.](#1321-not-allowed-to-register-wrappers-before-the-init-hook)
      - [1.3.2.2. OVERRIDE wrappers have a different call signature](#1322-override-wrappers-have-a-different-call-signature)
      - [1.3.2.3. Arrow Functions do not support `this`](#1323-arrow-functions-do-not-support-this)
    - [1.3.3. LibWrapper API](#133-libwrapper-api)
      - [1.3.3.1. Registering a wrapper](#1331-registering-a-wrapper)
      - [1.3.3.2. Unregistering a wrapper](#1332-unregistering-a-wrapper)
      - [1.3.3.3. Clear all wrappers for a given package](#1333-clear-all-wrappers-for-a-given-package)
      - [1.3.3.4. Ignore conflicts matching specific filters](#1334-ignore-conflicts-matching-specific-filters)
      - [1.3.3.5. Library Versioning](#1335-library-versioning)
        - [1.3.3.5.1. Testing for a specific libWrapper version](#13351-testing-for-a-specific-libwrapper-version)
      - [1.3.3.6. Fallback / Polyfill detection](#1336-fallback--polyfill-detection)
      - [1.3.3.7. Exceptions](#1337-exceptions)
      - [1.3.3.8. Hooks](#1338-hooks)
      - [1.3.3.9. Examples](#1339-examples)
    - [1.3.4. Compatibility Shim](#134-compatibility-shim)

## 1.1. Why?

One of the biggest causes of incompatibility between packages is them patching the same method, breaking each other. This module attempts to improve this situation, and also provide package developers with a flexible and easy-to-use API to wrap/monkey-patch core Foundry VTT code.

As a bonus, it provides the GM with package conflict detection, as well as the possibility of prioritizing and/or deprioritizing certain packages, which can help resolve conflicts if they do arise.

<img src="https://raw.githubusercontent.com/ruipin/fvtt-lib-wrapper/7cb19d4def1d5ebf84f4df5753f8e48ecfc1523c/example_priorities.png" width="200">
<img src="https://raw.githubusercontent.com/ruipin/fvtt-lib-wrapper/7cb19d4def1d5ebf84f4df5753f8e48ecfc1523c/example_conflicts.png" width="200">
<img src="https://raw.githubusercontent.com/ruipin/fvtt-lib-wrapper/7cb19d4def1d5ebf84f4df5753f8e48ecfc1523c/example_active_wrappers.png" width="200">

<sup>Note: Images may be out-of-date.</sup>


## 1.2. Installation

### 1.2.1. As a Module
1.  Copy this link and use it in Foundry's Module Manager to install the Module

    > https://github.com/ruipin/fvtt-lib-wrapper/releases/latest/download/module.json

2.  Enable the Module in your World's Module Settings


### 1.2.2. As a Library
You have multiple options here.

1.  Include the provided [shim](#134-compatibility-shim) in your project.

    or

2.  Write your own shim. **Please do not make your custom shim available in the global scope.**

    or

3.  Trigger a different code path depending on whether libWrapper is installed and active or not. For example:

    ```javascript
    if(typeof libWrapper === 'function') {
        /* libWrapper is available in global scope and can be used */
    }
    else {
        /* libWrapper is not available in global scope and can't be used */
    }
    ```

    or

4.  Require your users to install this library. One simple example that achieves this is provided below. Reference the more complex example in the provided [shim](#134-compatibility-shim) if you prefer a dialog (including an option to dismiss it permanently) instead of a simple notification.

    ```javascript
    Hooks.once('ready', () => {
        if(!game.modules.get('lib-wrapper')?.active && game.user.isGM)
            ui.notifications.error("Module XYZ requires the 'libWrapper' module. Please install and activate it.");
    });
    ```

    Note that if you choose this option and require the user to install this library, you should make sure to list libWrapper as a dependency. This can be done by adding the following to your package's manifest:

    ```javascript
    "dependencies": [
        {
            "name": "lib-wrapper"
        }
    ]
    ```

If you pick options #2 or #3 and actively recommend to the user to install libWrapper using e.g. a notification, it is a good idea to give the user a way to permanently dismiss said notification. The provided [shim](#134-compatibility-shim) does this by having a "Don't remind me again" option in the alert dialog.

Once your package is released, you should consider adding it to the wiki list of [Modules using libWrapper](https://github.com/ruipin/fvtt-lib-wrapper/wiki/Modules-using-libWrapper). This list can also be used as an additional (unofficial) source of libWrapper usage examples.


### 1.2.3. As a Contributor

See [CONTRIBUTING.md](CONTRIBUTING.md).



## 1.3. Usage

### 1.3.1. Summary

In order to wrap a method, you should call the `libWrapper.register` method during or after the `init` hook, and provide it with your package ID, the scope of the method you want to override, and a wrapper function.
You can also specify the type of wrapper you want in the fourth (optional) parameter:

- `WRAPPER`:

    - Use if your wrapper will *always* call the next function in the chain.
    - This type has priority over every other type. It should be used whenever possible as it massively reduces the likelihood of conflicts.
    - ⚠ The library will auto-detect if you use this type but do not call the original function, and automatically unregister your wrapper.

- `MIXED` (default):

    - Your wrapper will be allowed to decide whether it should call the next function in the chain or not.
    - These will always come after `WRAPPER`-type wrappers. Order is not guaranteed, but conflicts will be auto-detected.

- `OVERRIDE`:

    - Use if your wrapper will *never* call the next function in the chain. This type has the lowest priority, and will always be called last.
    - If another package already has an `OVERRIDE` wrapper registered to the same method:
        - If the GM has explicitly given your package priority over the existing one, libWrapper will trigger a `libWrapper.OverrideLost` hook, and your wrapper will take over.
        - Otherwise, libWrapper will throw a `libWrapper.AlreadyOverriddenError` exception. This exception can be caught by your package in order to fail gracefully and activate fallback code.

If using `WRAPPER` or `MIXED`, the first parameter passed to your wrapper will be the next wrapper in the wrapper chain, which you can use to continue the call.

```javascript
libWrapper.register('my-fvtt-package', 'Foo.prototype.bar', function (wrapped, ...args) {
    console.log('Foo.prototype.bar was called');
    // ... do things ...
    let result = wrapped(...args);
    // ... do things ...
    return result;
}, 'MIXED' /* optional, since this is the default type */ );
```


### 1.3.2. Common Pitfalls

#### 1.3.2.1. Not allowed to register wrappers before the `init` hook.

Due to Foundry limitations, information related to installed packages is not available until the `init` hook. As such, libWrapper will wait until then to initialize itself.

Any attempts to register wrappers before then will throw an exception. If using the [shim](#134-compatibility-shim), its `libWrapper` symbol will be undefined until then.

#### 1.3.2.2. OVERRIDE wrappers have a different call signature

When using `OVERRIDE`, wrappers do not receive the next function in the wrapper chain as the first parameter. Make sure to account for this.

```javascript
libWrapper.register('my-fvtt-package', 'Foo.prototype.bar', function (...args) { // There is no 'wrapped' parameter in the wrapper signature
    console.log('Foo.prototype.bar was overridden');
    return;
}, 'OVERRIDE');
```

#### 1.3.2.3. Arrow Functions do not support `this`

Per the Javascript specification, arrow function syntax (`(args) => { body() }`) does not bind a `this` object, and instead keeps whatever `this` was defined in the declaration scope.

As such, if you use arrow functions to define your wrapper, you will be unable to use the wrapper's `this`:

```javascript
libWrapper.register('my-fvtt-package', 'Foo.prototype.bar', (wrapped, ...args) => {
    console.log(this); // -> 'Window'
}, 'MIXED' /* optional, since this is the default type */ );
```

If you want access to the `this` object of the wrapped method, you must use the `function(args) { body() }` syntax:

```javascript
libWrapper.register('my-fvtt-package', 'Foo.prototype.bar', function (wrapped, ...args) {
    console.log(this); // -> 'Foo'
}, 'MIXED' /* optional, since this is the default type */ );
```


### 1.3.3. LibWrapper API

⚠ Anything not documented in this section is not officially supported, and could change or break at any moment without notice.

#### 1.3.3.1. Registering a wrapper
To register a wrapper function, you should call the method `libWrapper.register(package_id, target, fn, type)`:

```javascript
/**
 * Register a new wrapper.
 * Important: If called before the 'init' hook, this method will fail.
 *
 * In addition to wrapping class methods, there is also support for wrapping methods on specific object instances, as well as class methods inherited from parent classes.
 * However, it is recommended to wrap methods directly in the class that defines them whenever possible, as inheritance/instance wrapping is less thoroughly tested and will incur a performance penalty.
 *
 * Triggers FVTT hook 'libWrapper.Register' when successful.
 *
 * @param {string} package_id  The package identifier, i.e. the 'id' field in your module/system/world's manifest.
 * @param {string} target      A string containing the path to the function you wish to add the wrapper to, starting at global scope, for example 'SightLayer.prototype.updateToken'.
 *                             This works for both normal methods, as well as properties with getters. To wrap a property's setter, append '#set' to the name, for example 'SightLayer.prototype.blurDistance#set'.
 * @param {function} fn        Wrapper function. The first argument will be the next function in the chain, except for 'OVERRIDE' wrappers.
 *                             The remaining arguments will correspond to the parameters passed to the wrapped method.
 * @param {string} type        [Optional] The type of the wrapper. Default is 'MIXED'.
 *
 *   The possible types are:
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
 *     If another package already has an 'OVERRIDE' wrapper registered to the same method, using this type will throw a <libWrapper.LibWrapperAlreadyOverriddenError> exception.
 *     Catching this exception should allow you to fail gracefully, and for example warn the user of the conflict.
 *     Note that if the GM has explicitly given your package priority over the existing one, no exception will be thrown and your wrapper will take over.
 *
 * @param {Object} options [Optional] Additional options to libWrapper.
 *
 * @param {boolean} options.chain [Optional] If 'true', the first parameter to 'fn' will be a function object that can be called to continue the chain.
 *   Default is 'false' if type=='OVERRIDE', otherwise 'true'.
 *   First introduced in v1.3.6.0.
 *
 * @param {string} options.perf_mode [OPTIONAL] Selects the preferred performance mode for this wrapper. Default is 'AUTO'.
 *   It will be used if all other wrappers registered on the same target also prefer the same mode, otherwise the default will be used instead.
 *   This option should only be specified with good reason. In most cases, using 'AUTO' in order to allow the GM to choose is the best option.
 *   First introduced in v1.5.0.0.
 *
 *   The possible modes are:
 *
 *   'NORMAL':
 *     Enables all conflict detection capabilities provided by libWrapper. Slower than 'FAST'.
 *     Useful if wrapping a method commonly modified by other packages, to ensure most issues are detected.
 *     In most other cases, this mode is not recommended and 'AUTO' should be used instead.
 *
 *   'FAST':
 *     Disables some conflict detection capabilities provided by libWrapper, in exchange for performance. Faster than 'NORMAL'.
 *     Will guarantee wrapper call order and per-package prioritization, but fewer conflicts will be detectable.
 *     This performance mode will result in comparable performance to traditional non-libWrapper wrapping methods.
 *     Useful if wrapping a method called repeatedly in a tight loop, for example 'WallsLayer.testWall'.
 *     In most other cases, this mode is not recommended and 'AUTO' should be used instead.
 *
 *   'AUTO':
 *     Default performance mode. If unsure, choose this mode.
 *     Will allow the GM to choose which performance mode to use.
 *     Equivalent to 'FAST' when the libWrapper 'High-Performance Mode' setting is enabled by the GM, otherwise 'NORMAL'.
 */
static register(package_id, target, fn, type='MIXED', options={}) { /* ... */ }
```

See the usage example above.


#### 1.3.3.2. Unregistering a wrapper
To unregister a wrapper function, you should call the method `libWrapper.unregister(package_id, target)`.

```javascript
/**
 * Unregister an existing wrapper.
 *
 * Triggers FVTT hook 'libWrapper.Unregister' when successful.
 *
 * @param {string} package_id  The package identifier, i.e. the 'id' field in your module/system/world's manifest.
 * @param {string} target      A string containing the path to the function you wish to remove the wrapper from, starting at global scope. For example: 'SightLayer.prototype.updateToken'
 * @param {function} fail      [Optional] If true, this method will throw an exception if it fails to find the method to unwrap. Default is 'true'.
 */
static unregister(package_id, target, fail=true) { /* ... */ }
```


#### 1.3.3.3. Clear all wrappers for a given package
To clear all wrapper functions belonging to a given package, you should call the method `libWrapper.unregister_all(package_id)`.

```javascript
/**
 * Unregister all wrappers created by a given package.
 *
 * Triggers FVTT hook 'libWrapper.UnregisterAll' when successful.
 *
 * @param {string} package_id  The package identifier, i.e. the 'id' field in your module/system/world's manifest.
 */
static unregister_all(package_id) { /* ... */ }
```


#### 1.3.3.4. Ignore conflicts matching specific filters
To ask libWrapper to ignore specific conflicts when detected, instead of warning the user, you should call the method `libWrapper.ignore_conflicts(package_id, ignore_ids, targets)`.

```javascript
/**
 * Ignore conflicts matching specific filters when detected, instead of warning the user.
 *
 * This can be used when there are conflict warnings that are known not to cause any issues, but are unable to be resolved.
 * Conflicts will be ignored if they involve both 'package_id' and one of 'ignore_ids', and relate to one of 'targets'.
 *
 * Note that the user can still see the list of detected conflicts that were ignored, by toggling "Show ignored conflicts" in the "Conflicts" tab in the libWrapper settings.
 *
 * First introduced in v1.7.0.0.
 *
 * @param {string}            package_id  The package identifier, i.e. the 'id' field in your module/system/world's manifest. This will be the module that owns this ignore entry.
 * @param {(string|string[])} ignore_ids  Other package ID(s) with which conflicts should be ignored.
 * @param {(string|string[])} targets     Target(s) for which conflicts should be ignored, corresponding to the 'target' parameter to libWrapper.register.
 *
 * @param {Object} options [Optional] Additional options to libWrapper.
 *
 * @param {boolean} options.ignore_errors  [Optional] If 'true', will also ignore confirmed conflicts (i.e. errors), rather than only potential conflicts (i.e. warnings).
 *     Be careful when setting this to 'true', as confirmed conflicts are almost certainly something the user should be made aware of.
 *     Defaults to 'false'.
 */
static ignore_conflicts(package_id, ignore_ids, targets, options={}) { /* ... */ }
```



#### 1.3.3.5. Library Versioning

This library follows [Semantic Versioning](https://semver.org/), with two custom fields `SUFFIX` and `META`. These are used to track manifest-only changes (e.g. when `compatibleCoreVersion` increases) and track release meta-data (e.g. release candidates and unstable versions) respectively. See below for examples.

The version string will always have format `<MAJOR>.<MINOR>.<PATCH>.<SUFFIX><META>`.

The `MAJOR`, `MINOR`, `PATCH` and `SUFFIX` fields will always be integers.

The `META` field is always a string, although it will often be empty. The `-` character between `SUFFIX` and `META` is optional if `META` is empty or does not start with a digit.
This last field `META` is unnecessary when comparing versions, as a change to this field will always cause one of the other fields to be incremented.

A few (non-exhaustive) examples of valid version strings and the corresponding `[MAJOR, MINOR, PATCH, SUFFIX, META]`:

| `libWrapper.version` | `libWrapper.versions`     |
| -------------------- | ------------------------- |
| `1.2.3.4`            | `[1, 2, 3, 4, '']`        |
| `1.3.4.0rc`          | `[1, 3, 4, 0, 'rc']`      |
| `2.1.0.2a`           | `[2, 1, 0, 2, 'a']`       |
| `3.4.5.6dev`         | `[3, 4, 5, 6, 'dev']`     |

The `libWrapper` object provides a few properties and methods to query or react to the library version:

```javascript
// Properties
/**
 * Get libWrapper version
 * @returns {string}  libWrapper version in string form, i.e. "<MAJOR>.<MINOR>.<PATCH>.<SUFFIX><META>"
 */
static get version() { /* ... */ }

/**
 * Get libWrapper version
 * @returns {[number,number,number,number,string]}  libWrapper version in array form, i.e. [<MAJOR>, <MINOR>, <PATCH>, <SUFFIX>, <META>]
 */
static get versions() { /* ... */ }

/**
 * Get the Git version identifier.
 * @returns {string}  Git version identifier, usually 'HEAD' or the commit hash.
 */
static get git_version() { return GIT_VERSION };


// Methods
/**
 * Test for a minimum libWrapper version.
 * First introduced in v1.4.0.0.
 *
 * @param {number} major   Minimum major version
 * @param {number} minor   [Optional] Minimum minor version. Default is 0.
 * @param {number} patch   [Optional] Minimum patch version. Default is 0.
 * @param {number} suffix  [Optional] Minimum suffix version. Default is 0. First introduced in v1.5.2.0.
 * @returns {boolean}      Returns true if the libWrapper version is at least the queried version, otherwise false.
 */
static version_at_least(major, minor=0, patch=0, suffix=0) { /* ... */ }
```

##### 1.3.3.5.1. Testing for a specific libWrapper version

Sometimes you might wish to alert the user when an old version is detected, for example when you use functionality introduced in more recent versions.

To test for libWrapper v1.4.0.0 or higher, the simplest way is to use `version_at_least`:

```javascript
if(libWrapper.version_at_least?.(major, minor, patch, suffix)) {
    // libWrapper is at least major.minor.patch.suffix
}
else {
    // libWrapper is older than major.minor.patch.suffix
}
```

The arguments `minor`, `patch` and `suffix` are optional. Note the usage of `?.` to ensure this works (and is falsy) before v1.4.0.0.

If you wish to detect versions below v1.4.0.0, you should use `versions` instead:

```javascript
const [lwmajor, lwminor, lwpatch, lwsuffix] = libWrapper.versions;
if(
    lwmajor > major || (lwmajor == major && (
        lwminor > minor || (lwminor == minor && (
            lwpatch > patch || (lwpatch == patch && lwsuffix >= suffix)
        ))
    ))
) {
    // libWrapper is at least major.minor.patch.suffix
}
else {
    // libWrapper is older than major.minor.patch.suffix
}
```


#### 1.3.3.6. Fallback / Polyfill detection

To detect whether the `libWrapper` object contains the full library or a fallback/polyfill implementation (e.g. the [shim](#134-compatibility-shim)), you can check `libWrapper.is_fallback`.

The library module will set this property to `false`, while fallback/polyfill implementations will set it to `true`.

```javascript
/**
 * @returns {boolean}  The real libWrapper module will always return false. Fallback implementations (e.g. poly-fill / shim) should return true.
 */
static get is_fallback() { /* ... */ }
```



#### 1.3.3.7. Exceptions

Since v1.2.0.0, various custom exception classes are used by libWrapper, and available in the global `libWrapper` object.

* `LibWrapperError`:
    - Base class for libWrapper exceptions.

* `LibWrapperInternalError extends LibWrapperError`:
    - Internal LibWrapper error, usually indicating something is broken with the libWrapper library.
    - Public fields:
        - `package_id`: Package ID which triggered the error, if any.

* `LibWrapperPackageError extends LibWrapperError`:
    - Error caused by a package external to libWrapper. These usually indicate conflicts, usage errors, or out-dated packages.
    - Public fields:
        - `package_id`: Package ID which triggered the error.

* `LibWrapperAlreadyOverriddenError extends LibWrapperError`:
    - Thrown when a `libWrapper.register` call with `type='OVERRIDE'` fails because another `OVERRIDE` wrapper is already registered.
    - Public fields:
        - `package_id`: Package ID which failed to register the `OVERRIDE` wrapper.
        - `conflicting_id`: Package ID which already has a registered `OVERRIDE` wrapper.
        - `target`: Wrapper target (the `target` parameter to `libWrapper.register`).

* `LibWrapperInvalidWrapperChainError extends LibWrapperError`:
    - Thrown when a wrapper tries to call the next method in the wrapper chain, but this call is invalid. This can occur, for example, if this call happens after the wrapper has already returned and all associated promises have resolved.
    - Public fields:
        - `package_id`: Package ID which triggered the error, if any.

These are available both with and without the `LibWrapper` prefix, for example `libWrapper.Error` and `libWrapper.LibWrapperError` are equivalent and return the same exception class.

#### 1.3.3.8. Hooks

Since v1.4.0.0, the libWrapper library triggers Hooks for various events, listed below:

* `libWrapper.Ready`:
    - Triggered when libWrapper is ready to register wrappers. This will happen shortly before the FVTT `init` hook.
    - No Parameters.

* `libWrapper.Register`:
    - Triggered when `libWrapper.Register` completes successfully.
    - Parameters:
        - `1`: Package ID whose wrapper is being registered (the `package_id` parameter to `libWrapper.register`).
        - `2`: Wrapper target (the `target` parameter to `libWrapper.register`).
        - `3`: Wrapper type (the `type` parameter to `libWrapper.register`).
        - `4`: Options object (the `options` parameter to `libWrapper.register`).

* `libWrapper.Unregister`:
    - Triggered when `libWrapper.Unregister` completes successfully.
    - Parameters:
        - `1`: Package ID whose wrapper is being unregistered (the `package_id` parameter to `libWrapper.unregister`).
        - `2`: Wrapper target (the `target` parameter to `libWrapper.unregister`).

* `libWrapper.UnregisterAll`:
    - Triggered when `libWrapper.unregister_all` completes successfully.
    - Parameters:
        - `1`: Package ID whose wrappers are being unregistered (the `package_id` parameter to `libWrapper.unregister_all`).

* `libWrapper.ConflictDetected`:
    - Triggered when a conflict is detected.
    - Parameters:
        - `1`: Package ID which triggered the conflict, or `«unknown»` if unknown.
        - `2`: Conflicting package ID.
        - `3`: Wrapper name (first `target` parameter provided by any module when registering a wrapper to the same method).
        - `4`: List of all unique `target` strings provided by modules when registering a wrapper to the same method.
    - If this hook returns `false`, the user will not be notified of this conflict.

* `libWrapper.OverrideLost`:
    - Triggered when an `OVERRIDE` wrapper is replaced by a higher-priority wrapper.
    - Parameters:
        - `1`: Existing package ID whose wrapper is being unregistered.
        - `2`: New package ID whose wrapper is being registered.
        - `3`: Wrapper name (first `target` parameter provided by any module when registering a wrapper to the same method).
        - `4`: List of all unique `target` strings provided by modules when registering a wrapper to the same method.
    - If this hook returns `false`, this event will not be treated as a conflict.


#### 1.3.3.9. Examples

A list of packages using libWrapper, which can be used as further examples, can be found in the wiki page [Modules using libWrapper](https://github.com/ruipin/fvtt-lib-wrapper/wiki/Modules-using-libWrapper).


### 1.3.4. Compatibility Shim

The [shim.js](shim/shim.js) file in this repository can be used to avoid a hard dependency on libWrapper.

See the respective documentation in [shim/SHIM.md](shim/SHIM.md).