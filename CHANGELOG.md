# 1.2.1.0 (2021-01-03)

* Freeze all libWrapper classes after defining them.
* Remove use of '<' and '>' to avoid them being treated as HTML.
* Make error notifications permanent.

# 1.2.0.0 (2021-01-03)

* Refactor source code directory structure.
* **[BREAKING]** Clean-up API parameter validation.
  * The `module` and `target` API parameter types are now validated, and these must be strings.
  * The `module` API parameter will now undergo more extensive validation - attempts to wrap using a different module name than the caller may fail.
  * Library now attempts to forbid wrapping libWrapper code and APIs.
* Refactor error handling.
  * All libWrapper errors now extend the `LibWrapperError` class.
  * **[BREAKING]** For consistency, the previous libWrapper exception classes have been renamed.
    * `AlreadyOverriddenError` and `InvalidWrapperChainError` have been renamed to `LibWrapperAlreadyOverriddenError` and `LibWrapperInvalidWrapperChainError` respectively.
    * To aid compatibility, these can still be found in `libWrapper.AlreadyOverriddenError` and `libWrapper.InvalidWrapperChainError` as before, in addition to their new names.
  * Add option to visually notify non-GM players of issues, in addition to the GM.
  * No longer notifies user if libWrapper exceptions are handled by a given module.

# 1.1.5.0 (2021-01-03)

* Reintroduce changes from v1.1.3.0.
* Fix 'super' usage inside wrapped methods, which was causing multiple modules to malfunction when using libWrapper.

# 1.1.4.0 (2021-01-03)

* Hotfix release. Reverts changes in 1.1.3.0, which broke some things.

# 1.1.3.0 (2021-01-03)

* Fix instance/inherited wrapping when there are more than 2 layers, e.g. C inherits from B which inherits from A. Some corner cases were broken.

# 1.1.2.0 (2021-01-03)

* Prevent wrapping of libWrapper internals
* Update shim. Now supports very basic inherited method wrapping using static dispatch.

# 1.1.1.0 (2021-01-03)

* Fix parameters when instance-specific wrappers chain to class-specific wrappers.
* Notify of conflicts when a module wraps instances directly without using libWrapper, but the class has a libWrapper wrapper.

# 1.1.0.0 (2021-01-02)

* Fix 'WRAPPER'-type wrappers that chain asynchronously. These will no longer be incorrectly unregistered for not chaining. (See [issue #7](https://github.com/ruipin/fvtt-lib-wrapper/issues/7))
* Fix wrappers being called twice when a module wraps an instance member without libWrapper, if libWrapper is used to wrap the class prototype. (See [issue #7](https://github.com/ruipin/fvtt-lib-wrapper/issues/8))
* Notify GM when potential issues/conflicts are detected. This can be disabled in the module settings menu.
* Removed option to disable runtime data collection used for the settings menu. After benchmarking, this being enabled does not seem to impact performance at all.

# 1.0.8.0 (2021-01-01)

* Allow modules to chain wrappers asynchronously ([issue #7](https://github.com/ruipin/fvtt-lib-wrapper/issues/7)).

# 1.0.7.0 (2020-12-30)

* Implement support for multiple chaining. Now, modules can call the next wrapper in the chain more than once.

# 1.0.6.0 (2020-12-30)

* Improved some exception messages to make it clearer which module/wrapper is responsible for them.
* Improved the README, to make more explicit some of the common pitfalls when using this library.
  Now explicitly mentions that 'OVERRIDE' wrappers have a different call signature, and that wrappers should not chain more than once.
* Explicitly announce compatibility with Foundry 0.7.9.

# 1.0.5.3 (2020-12-08)

* No code changes.
* Explicitly announce compatibility with Foundry 0.7.8.

# 1.0.5.2 (2020-11-15)

* No code changes (Note: from now on, versions with no code changes will not increment the "minor version", instead using a suffix).
* Explicitly announce compatibility with Foundry 0.7.7.

# 1.0.5 (2020-10-22)

* No code changes.
* Explicitly announce compatibility with Foundry 0.7.5.

# 1.0.4 (2020-09-22)

* Adds official support for instance-specific, as well as inherited-method wrapping. Note that these are not supported by the shim.
* Fixes silent failures and broken behaviour when attempting to override a method on a class which it inherited from a parent class.
* Fixes silent failures and broken behaviour when attempting to override a method on an object instance, rather than a class.
* Throw an explicit failure message when the shim fails to find the method to wrap.
* Fix 'this' parameter when using the shim and calling the original method without using 'call' or 'apply'.
* Update documentation to better explain the shim's limitations.
* Closes [issue #2](https://github.com/ruipin/fvtt-lib-wrapper/issues/2). Thanks to Nordii for the report.

# 1.0.3 (2020-09-17)

* Fix shim when type='OVERRIDE' is used ([issue #1](https://github.com/ruipin/fvtt-lib-wrapper/issues/1)). Thanks to itamarcu for the report.

# 1.0.2 (2020-08-29)

* Fix libWrapper.versions property, which was not showing the correct libWrapper version information.

# 1.0.1 (2020-08-08)

* Fix packaging mistake that would prevent the settings dialog from opening.

# 1.0.0 (2020-08-08)

* Initial release.