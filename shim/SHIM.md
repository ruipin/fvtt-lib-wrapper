# 1. Shim

The [shim.js](shim.js) file can be used to avoid a hard dependency on libWrapper.

- [1. Shim](#1-shim)
  - [1.1. License](#11-license)
  - [1.2. Usage](#12-usage)
      - [1.2.1. Default Shim Configuration](#121-default-shim-configuration)

## 1.1. License

Unlike the rest of the libWrapper repository, this compatibility shim is licensed under [MIT](LICENSE).

## 1.2. Usage

The shim exports a `libWrapper` symbol which will at the `init` hook become a reference to the real libWrapper library if present, or to a fallback/polyfill implementation otherwise. This symbol will be `undefined` until the `init` hook fires.

A fallback implementation is included for the `register` function only (see documentation above). This fallback implementation does not have any of the "fancy" features of the libWrapper library - most importantly, it does not check for module conflicts or enforce call order between the different wrapper types, and it does not do dynamic dispatch. *Due to these differences in behaviour, it is extremely important to test your code both with the shim and with the full library.*

To programmatically detect whether the fallback implementation is active, you can check `libWrapper.is_fallback == true`.

To be able to use this shim, your module needs to use `esmodules` in its manifest file. Then, you can import the shim by adding e.g. `import {libWrapper} from './relative/path/to/shim.js';` to your JS code. While the shim is mostly plug-and-play, please feel free to modify it to your liking - in particular, some places you might wish to customize are explicitly marked with `//************** USER CUSTOMIZABLE:`.

#### 1.2.1. Default Shim Configuration

By default, the shim displays a warning dialog similar to the image below when libWrapper is not installed and therefore the fallback code path is being used.

This is meant to be a "sane default", but you should feel free to customize this dialog by modifying the shim code or even just strip it out completely if you do not wish to have a warning dialog at all.

<img src="https://raw.githubusercontent.com/ruipin/fvtt-lib-wrapper/d54d5d8c5adbd34bc65396c31f042f3f9d8d6a24/example_warning_dialog.png" width="200">
<sup>Note: Images may be out-of-date.</sup>