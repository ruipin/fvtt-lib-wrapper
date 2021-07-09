# 1. Shim

The [shim.js](shim.js) file can be used to avoid a hard dependency on libWrapper.

- [1. Shim](#1-shim)
  - [1.1. License](#11-license)
  - [1.2. Differences compared to the full library](#12-differences-compared-to-the-full-library)
  - [1.3. Usage](#13-usage)
    - [1.3.1. Shim Version](#131-shim-version)
    - [1.3.2. Default Shim Configuration](#132-default-shim-configuration)



## 1.1. License

Unlike the rest of the libWrapper repository, this compatibility shim is licensed under [MIT](LICENSE).



## 1.2. Differences compared to the full library

This section contains a list of the most significant differences between the shim and the full library.

⚠ *Due to these differences in behaviour, it is extremely important to test your code both with the shim and with the full library.*

1. This shim does not support any user-facing functionality. Think prioritization of modules, conflict detection, list of wrappers, etc. Basically, anything you can access through the libWrapper settings menu.

2. This shim does not support `libWrapper.unregister` / `libWrapper.unregister_all` calls.

3. This shim does not support dynamic dispatch. The next method in the wrapper chain is calculated at the time of each `register` call, and never changed/reordered later. This has many implications:

    1. The wrapper type metadata (`WRAPPER`, `MIXED`, `OVERRIDE`) is completely ignored. Unlike the full library, nothing guarantees `MIXED` wrappers come after all `WRAPPER` wrappers, nor that `OVERRIDE` wrappers come after all `MIXED` wrappers. The wrapper call order will match the order in which they are registered. For instance, if a module registers an `OVERRIDE`, previously registered wrappers (`OVERRIDE` or not) will never be called.

    2. Inheritance chains are static and calculated at `register` time. For instance, if there is `class B extends A` and a module overrides `B.prototype.foo` before another overrides `A.prototype.foo`, calling `B.prototype.foo` will skip the `A.prototype.foo` wrapper.

    3. There is no distinction between a libWrapper (Shim) wrapper and a non-libWrapper wrapper. While normally non-libWrapper wrappers will always come after all libWrapper wrappers, when using the shim this is not the case.

4. None of the libWrapper safeties are guaranteed when using the shim:

    1. Nothing checks that modules alway call `wrapped(...args)` when using `WRAPPER`.

    2. Nothing checks that there can only be one `OVERRIDE` wrapper on a given method.

5. The various libWrapper Hooks are not triggered when using the shim.

Using the shim does not give you any advantage (or disadvantage) in terms of compatibility with other modules when compared to not using libWrapper at all. The intent of the shim is to remove the main disadvantage from using libWrapper, i.e. of tying yourself to a dependency. With this shim, you can take advantage of the benefits of libWrapper when it is installed, while still behaving correctly when it isn't.



## 1.3. Usage

The shim exports a `libWrapper` symbol which will at the `init` hook become a reference to the real libWrapper library if present, or to a fallback/polyfill implementation otherwise.

⚠ Note that this symbol will be `undefined` until the `init` hook fires.

A fallback implementation is included for the `register` function only (see full library documentation). This fallback implementation does not have any of the "fancy" features of the libWrapper library. See [above](#12-differences-compared-to-the-full-library) for more detail.

To programmatically detect whether the fallback implementation is active, you can check `libWrapper.is_fallback == true`.

To be able to use this shim, your module needs to use `esmodules` in its manifest file. Then, you can import the shim by adding e.g. `import {libWrapper} from './relative/path/to/shim.js';` to your JS code. While the shim is mostly plug-and-play, please feel free to modify it to your liking - in particular, some places you might wish to customize are explicitly marked with `//************** USER CUSTOMIZABLE:`.


### 1.3.1. Shim Version

Since `v1.7.1`, the [shim.js](shim.js) file exports the `VERSIONS` symbol with format `[MAJOR, MINOR, PATCH]` following [Semantic Versioning](https://semver.org/).

This symbol will be modified any time the shim is modified, and can be used to decide whether you need to update the shim or not.

While the `PATCH` version has no direct relation to the main libWrapper library's version and is unique to the Shim, the `MAJOR` and `MINOR` versions will always match between the two. Them being equal signifies that the shim implements the same API.


### 1.3.2. Default Shim Configuration

By default, the shim displays a warning dialog similar to the image below when libWrapper is not installed and therefore the fallback code path is being used.

This is meant to be a "sane default", but you should feel free to customize this dialog by modifying the shim code or even just strip it out completely if you do not wish to have a warning dialog at all.

<img src="https://raw.githubusercontent.com/ruipin/fvtt-lib-wrapper/d54d5d8c5adbd34bc65396c31f042f3f9d8d6a24/example_warning_dialog.png" width="200">
<sup>Note: Images may be out-of-date.</sup>