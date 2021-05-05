# 1.5.6.0 (2021-05-05)

- Improve unhandled error detection mechanism.
- Also detect errors that occur inside `Application.prototype.render`.

# 1.5.5.0 (2021-05-05)

- Fix sorting of unprioritized modules in the settings dialog.

# 1.5.4.0 (2021-05-05)

- Improve support for systems and world scripts. ([Issue #19](https://github.com/ruipin/fvtt-lib-wrapper/issues/19))
  - World scripts are now supported.
  - Shim ID/title auto-detection now supports both world scripts and systems.
- Do not use positive look-behind in regexes. ([Issue #34](https://github.com/ruipin/fvtt-lib-wrapper/issues/34))
  - This fixes support for Safari Technical Preview. (Note: Safari is still officially unsupported by both Foundry and libWrapper)
  - Corresponding update to the shim, which will be required if modules wish to support Safari.

# 1.5.3.0 (2021-05-04)

- Improve call stack for hooks ([Issue #32](https://github.com/ruipin/fvtt-lib-wrapper/issues/32))
  - Changed the `Hooks._call` wrapper to a patched override.
- Delay evaluation of notifications configuration until `ready` hook.
- Announce compatibility with Foundry 0.8.2.

# 1.5.2.0 (2021-04-16)

- Versioning updates
  - Split `SUFFIX` field into `SUFFIX` and `META`.
  - `SUFFIX` is now always an integer, with `META` containing the string portion.
  - `META` is now unnecessary when comparing library versions, as any change to this field will cause one of the other fields to be incremented.
  - Updated `version_at_least` to be able to request a minimum `SUFFIX` field.

# 1.5.1.0 (2021-04-13)

- Fix issue detecting module names when using minified releases of libWrapper.

# 1.5.0.0 (2021-04-12)

- Major performance improvements
  - Improved performance of the standard performance mode in a tight loop by 60% compared to previous versions.
  - Compared to v1.4.3.0:
    - 1000 calls to one wrapper: 1.67ms → 0.67ms (~60% improvement)
    - One call to 1000 wrappers: 0.87ms → 0.60ms (~25% improvement)
  - Added unit test to ensure there are no significant performance regressions in the future.

- The GM can now toggle a 'High-Performance Mode' in the libWrapper module settings. ([Issue #25](https://github.com/ruipin/fvtt-lib-wrapper/issues/25))
  - Modules can also request this be used by default (see documentation for usage details).
  - This mode forgoes libWrapper's dynamic conflict detection capabilities in exchange for higher performance.
  - Compared to the standard mode on v1.5.0.0:
    - 1000 calls to one wrapper: 0.67ms → 0.06ms (~90% improvement)
    - One call to 1000 wrappers: 0.60ms → 0.08ms (~85% improvement)
  - This is within margin of error of non-libWrapper wrapping methods, and useful when wrapping methods in a tight loop such as `WallsLayer.testWalls`.

- Updated rollup/babel/terser configuration and versions.

# 1.4.3.0 (2021-04-11)

- Ignore conflicts when `libWrapper.ConflictDetected` returns `false`.
- Do not treat an `OVERRIDE` wrapper being replaced as a conflict when `libWrapper.OverrideLost` returns `false`.

# 1.4.2.0 (2021-04-11)

- System support:
  - Systems can now register wrappers using their ID (Partially implements [Issue #19](https://github.com/ruipin/fvtt-lib-wrapper/issues/19))
  - Detected conflicts involving a system no longer show up as `unknown`.
- Improve call stacks further ([Issue #17](https://github.com/ruipin/fvtt-lib-wrapper/issues/17)):
  - Decorate all `libWrapper`, `Wrapper` and `LibWrapperNotifications` functions with the `🎁` symbol.
  - Bind `call_wrapped` on the last wrapper call, instead of `call_wrapper`. This avoids one extra call.
  - Decorate `Hooks._call` wrapper properly.

# 1.4.1.0 (2021-04-11)

- Fix broken `Hooks.once` behaviour. Modules such as Norc's Custom Hotbar now work as expected. Closes [Issue #30](https://github.com/ruipin/fvtt-lib-wrapper/issues/30).
- Detect `Promise` rejections caused by `LibWrapperError` exceptions properly.

# 1.4.0.0 (2021-04-11)

- **[BREAKING]** Remove private code from `libWrapper` scope.
  - The `libWrapper` object no longer exposes various private functions. This includes:
    - Any function with a `_` prefix
    - `load_priorities`
  - If your code was relying on any of these undocumented functions, it will need to be updated.
  - As always, you should assume any method that is not publicly documented may change or be removed at any moment and without notice.
  - Closes [Issue #16](https://github.com/ruipin/fvtt-lib-wrapper/issues/16).
- **[DEPRECATION WARNING]** The hook `libWrapperReady` is now deprecated and will be removed in a future version.
  - You should use `libWrapper.Ready` instead.
- Bug-fixes:
  - Register modules to the prioritization UI even if they fail to register an `OVERRIDE` wrapper due to another wrapper already existing. Fixes [Issue #21](https://github.com/ruipin/fvtt-lib-wrapper/issues/21).
  - Enable statistics collection for non-GM users with 'Modify configuration settings' permission. This means they can now edit the libWrapper priorities. Fixes [Issue #26](https://github.com/ruipin/fvtt-lib-wrapper/issues/26).
- New features / improvements:
  - Trigger the `libWrapper.OverrideLost` hook when an `OVERRIDE` wrapper gets replaced. Closes [Issue #23](https://github.com/ruipin/fvtt-lib-wrapper/issues/23).
  - Trigger various hooks when certain events occur. See documentation for details.
  - Added public API function `version_at_least(major, minor=0, patch=0)` for modules to easily check for a minimum libWrapper version.
  - Redirect `toString()` method to the wrapped method. Closes [Issue #18](https://github.com/ruipin/fvtt-lib-wrapper/issues/18)
- Major documentation improvements:
  - Documented `version`, `versions`, `is_fallback`.
  - Documented all custom exception classes used by libWrapper.
  - Documented the Hooks triggered by libWrapper.
  - Documented the `{chain: true}` option for `OVERRIDE` wrappers added in v1.3.6.0.
  - Documentation now states explicitly that usage of anything undocumented is unsupported, might change, and can easily break.
  - Split the contributing section to [CONTRIBUTING.md](CONTRIBUTING.md).
  - Added a Table of Contents, as well as section numbers.
- Improve callstack:
  - Renamed `src/lib/lib-wrapper.js` to `src/libWrapper-api.js`.
  - Renamed `src/lib/wrapper.js` to `src/libWrapper-wrapper.js`.
  - Renamed handler function names, so that they are shorter.
  - Use Function.displayName in addition to the previous implementation, when giving functions custom names.
  - Improve performance by caching handler functions, instead of re-generating them every time.
  - Closes [Issue #17](https://github.com/ruipin/fvtt-lib-wrapper/issues/17).
- Improve error handling mechanism:
  - Detect unhandled libWrapper errors inside hooks, and warn the user appropriately.
  - libWrapper will no longer break if it fails to parse `game.data.user` or `game.data.settings`. This should improve compatibility with future Foundry VTT versions.
  - Delay warning and error notifications until the `ready` hook if they occur beforehand, to ensure they are displayed.
- Manifest changes:
  - Add `library: true` to manifest.
  - Announce compatibility with Foundry 0.8.1.
- Minor code cleanup.

# 1.3.6.0 (2021-04-09)

- Allow OVERRIDE wrappers to continue chain if they pass `{chain: true}` as a fourth parameter to `libWrapper.register`.

# 1.3.5.0 (2021-01-11)

- Bugfix: Refactor usage of the handler objects (used to bootstrap a libWrapper call) so that dispatch is dynamic. Prevents references to wrapped methods from skipping the wrappers.

# 1.3.4.0 (2021-01-08)

- Give custom names to methods in the wrapper call chain for easier debug when something goes wrong (browser support varies).

# 1.3.3.0 (2021-01-08)

- Hotfix crashes introduced by v1.3.2.0 when detecting possible conflicts. Now added to test suite to avoid something similar happening again.

# 1.3.2.0 (2021-01-07)

- Add try-catch inside `onUnhandledError` in order to avoid swallowing the original exception with a second exception if anything goes wrong.
- Handle missing `ui.notifications` gracefully.

# 1.3.1.0 (2021-01-07)

- Remove need for invalidation of outstanding asynchronous wrappers, when wrappers are modified. (Fixes [Issue #7](https://github.com/ruipin/fvtt-lib-wrapper/issues/7))
- Optimize instance assignment.
- Misc. bug fixes.

# 1.3.0.0 (2021-01-06)

- **[BREAKING]** Fix inconsistent wrapping order (see [Issue #13](https://github.com/ruipin/fvtt-lib-wrapper/issues/13)).
- Major test suite improvement. Expand the number of tests, and refactor them for readability (see [Issue #12](https://github.com/ruipin/fvtt-lib-wrapper/issues/12))
- Fix property inheritance. It did not work at all before this update.
- Throw correct exception type when trying to wrap a setter that doesn't exist.
- A few other miscellaneous bug-fixes for corner cases detected by the new tests.

# 1.2.1.0 (2021-01-03)

- Freeze all libWrapper classes after defining them.
- Remove use of '<' and '>' to avoid them being treated as HTML.
- Make error notifications permanent.

# 1.2.0.0 (2021-01-03)

- Refactor source code directory structure.
- **[BREAKING]** Clean-up API parameter validation.
  - The `module` and `target` API parameter types are now validated, and these must be strings.
  - The `module` API parameter will now undergo more extensive validation - attempts to wrap using a different module name than the caller may fail.
  - Library now attempts to forbid wrapping libWrapper code and APIs.
- Refactor error handling.
  - All libWrapper errors now extend the `LibWrapperError` class.
  - **[BREAKING]** For consistency, the previous libWrapper exception classes have been renamed.
    - `AlreadyOverriddenError` and `InvalidWrapperChainError` have been renamed to `LibWrapperAlreadyOverriddenError` and `LibWrapperInvalidWrapperChainError` respectively.
    - To aid compatibility, these can still be found in `libWrapper.AlreadyOverriddenError` and `libWrapper.InvalidWrapperChainError` as before, in addition to their new names.
  - Add option to visually notify non-GM players of issues, in addition to the GM.
  - No longer notifies user if libWrapper exceptions are handled by a given module.

# 1.1.5.0 (2021-01-03)

- Reintroduce changes from v1.1.3.0.
- Fix 'super' usage inside wrapped methods, which was causing multiple modules to malfunction when using libWrapper.

# 1.1.4.0 (2021-01-03)

- Hotfix release. Reverts changes in 1.1.3.0, which broke some things.

# 1.1.3.0 (2021-01-03)

- Fix instance/inherited wrapping when there are more than 2 layers, e.g. C inherits from B which inherits from A. Some corner cases were broken.

# 1.1.2.0 (2021-01-03)

- Prevent wrapping of libWrapper internals
- Update shim. Now supports very basic inherited method wrapping using static dispatch.

# 1.1.1.0 (2021-01-03)

- Fix parameters when instance-specific wrappers chain to class-specific wrappers.
- Notify of conflicts when a module wraps instances directly without using libWrapper, but the class has a libWrapper wrapper.

# 1.1.0.0 (2021-01-02)

- Fix 'WRAPPER'-type wrappers that chain asynchronously. These will no longer be incorrectly unregistered for not chaining. (See [issue #7](https://github.com/ruipin/fvtt-lib-wrapper/issues/7))
- Fix wrappers being called twice when a module wraps an instance member without libWrapper, if libWrapper is used to wrap the class prototype. (See [issue #7](https://github.com/ruipin/fvtt-lib-wrapper/issues/8))
- Notify GM when potential issues/conflicts are detected. This can be disabled in the module settings menu.
- Removed option to disable runtime data collection used for the settings menu. After benchmarking, this being enabled does not seem to impact performance at all.

# 1.0.8.0 (2021-01-01)

- Allow modules to chain wrappers asynchronously ([issue #7](https://github.com/ruipin/fvtt-lib-wrapper/issues/7)).

# 1.0.7.0 (2020-12-30)

- Implement support for multiple chaining. Now, modules can call the next wrapper in the chain more than once.

# 1.0.6.0 (2020-12-30)

- Improved some exception messages to make it clearer which module/wrapper is responsible for them.
- Improved the README, to make more explicit some of the common pitfalls when using this library.
  Now explicitly mentions that 'OVERRIDE' wrappers have a different call signature, and that wrappers should not chain more than once.
- Explicitly announce compatibility with Foundry 0.7.9.

# 1.0.5.3 (2020-12-08)

- No code changes.
- Explicitly announce compatibility with Foundry 0.7.8.

# 1.0.5.2 (2020-11-15)

- No code changes (Note: from now on, versions with no code changes will not increment the "minor version", instead using a suffix).
- Explicitly announce compatibility with Foundry 0.7.7.

# 1.0.5 (2020-10-22)

- No code changes.
- Explicitly announce compatibility with Foundry 0.7.5.

# 1.0.4 (2020-09-22)

- Adds official support for instance-specific, as well as inherited-method wrapping. Note that these are not supported by the shim.
- Fixes silent failures and broken behaviour when attempting to override a method on a class which it inherited from a parent class.
- Fixes silent failures and broken behaviour when attempting to override a method on an object instance, rather than a class.
- Throw an explicit failure message when the shim fails to find the method to wrap.
- Fix 'this' parameter when using the shim and calling the original method without using 'call' or 'apply'.
- Update documentation to better explain the shim's limitations.
- Closes [issue #2](https://github.com/ruipin/fvtt-lib-wrapper/issues/2). Thanks to Nordii for the report.

# 1.0.3 (2020-09-17)

- Fix shim when type='OVERRIDE' is used ([issue #1](https://github.com/ruipin/fvtt-lib-wrapper/issues/1)). Thanks to itamarcu for the report.

# 1.0.2 (2020-08-29)

- Fix libWrapper.versions property, which was not showing the correct libWrapper version information.

# 1.0.1 (2020-08-08)

- Fix packaging mistake that would prevent the settings dialog from opening.

# 1.0.0 (2020-08-08)

- Initial release.