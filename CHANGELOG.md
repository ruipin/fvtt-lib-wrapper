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