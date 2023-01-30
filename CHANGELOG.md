# 1.12.12.0 (2023-01-30)

- Implement workaround for Chromium handling of error stack traces resulting in missing information when printed to console ([Issue #76](https://github.com/ruipin/fvtt-lib-wrapper/issues/76))

# 1.12.11.0 (2022-11-15)

- Fix incorrect formatting of error messages when modules have both an 'info' and 'bugs' URL in their package manifest. ([Issue #73](https://github.com/ruipin/fvtt-lib-wrapper/issues/73))

# 1.12.10.0 (2022-09-19)

- Code refactoring/clean-up (no user-facing changes)
- Get rid of another FVTT v10 deprecation warning that occurred only when running the development version of the module.

# 1.12.9.0 (2022-09-11)

- Fix incorrect error messages when calling the libWrapper API before the `libWrapper.Ready` hook. ([Issue  #72](https://github.com/ruipin/fvtt-lib-wrapper/issues/72))
  - Add unit test to catch this issue in the future.
- Fix accidental 3 consecutive blank lines in error messages when a module has neither an `url` nor a `bugs` entry in its manifest.
- Update NPM dependencies to latest version.

# 1.12.8.0 (2022-09-04)

- Get rid of FVTT v10 deprecation warnings caused by legacy style package 'data' accesses.
  - Shim updated to v1.12.2 to also get rid of these warnings when libWrapper is not installed.
  - Closes [Issue #71](https://github.com/ruipin/fvtt-lib-wrapper/issues/71). Thanks to wickermoon for the issue report and fix proposal!

# 1.12.7.2 (2022-09-02)

- Add `authors` key to the module manifest to avoid compatibility warnings in FVTT v10.

# 1.12.7.1 (2022-08-08)

- Add `compatibility` and `id` keys to the module manifest to avoid compatibility warnings in FVTT v10.

# 1.12.7.0 (2022-06-21)

- Enforce `options.chain == true` when registering non-OVERRIDE wrappers.

# 1.12.6.0 (2022-06-15)

- Add support for reading core compatibility versions for packages using the new Foundry VTT v10 manifest format.
- Update README with information about the new Foundry VTT v10 manifest format.

# 1.12.5.0 (2022-05-31)

- Fix `options.bind` parameter to `libWrapper.register` for `OVERRIDE` wrappers.
- Declare compatibility with Foundry v10. It is unlikely a future v10 update will break compatibility.

# 1.12.4.0 (2022-02-14)

- Improve package detection. Will no longer fail if an error's stack trace is empty, which could happen sometimes when browser native code causes a JS exception.
- Improve error package info injection to be less noisy when it fails.
- Tweak rollup configuration so that relative sourcemap file paths are now correct.

# 1.12.3.0 (2022-02-01)

- All API functions now accept disambiguation prefixes as part of their `package_id` parameter, i.e. `module:foobar`, `system:foobar`, or `world:foobar`.

# 1.12.2.0 (2022-01-30)

- Allow integer enum values to be passed to `get` as a string, so that the caller does not need to cast explicitly.
  - No known issues were caused by this, and this code isn't exposed in the libWrapper API, but the previous behaviour was unintended.

# 1.12.1.0 (2022-01-30)

- Hotfix: Correctly handle malformed log verbosity setting.
- Disable minification of class names, for more readable error messages.

# 1.12.0.0 (2022-01-29)

- Fix `libWrapper.AlreadyOverriddenError` usage.
  - Override conflicts were accidentally throwing `libWrapper.PackageError` exceptions instead, which breaks the API.
- Fix module updated check when `compatibleCoreVersion` contains only the compatible FVTT major version.
- Allow arguments to be bound when calling `libWrapper.register` ([Issue #58](https://github.com/ruipin/fvtt-lib-wrapper/issues/58))
  - This allows avoiding an extra function call, for example
    `libWrapper.register(PACKAGE_ID, "foo", function(wrapped, ...args) { return someFunction.call(this, wrapped, "foo", "bar", ...args) });`
    becomes
    `libWrapper.register(PACKAGE_ID, "foo", someFunction, "WRAPPER", {bind: ["foo", "bar"]});`.
- Implement a logging verbosity setting ([Issue #62](https://github.com/ruipin/fvtt-lib-wrapper/issues/62))
  - By default, libWrapper will only show warnings or errors in the console.


# 1.11.4.0 (2022-01-14)

- Hotfix: Previous update caused significant breakage due to an uninitialised variable not caught by unit tests. Sorry for the inconvenience!

# 1.11.3.0 (2022-01-14)

- Allow JavaScript engine to garbage collect objects that have been wrapped by libWrapper.

# 1.11.2.0 (2022-01-05)

- Improve static dispatch chain caching, speeding up wrappers when calling them on different objects with "High Performance Mode" enabled.

# 1.11.1.0 (2022-01-04)

- Add Japanese localisation, contributed by BrotherSharper. Thank you!

# 1.11.0.1 (2021-12-13)

- Declare compatibility with all Foundry v9 versions, instead of individual ones. It is unlikely a future update will break compatibility.

# 1.11.0.0 (2021-11-25)

- API Improvements to `libWrapper.register` and `libWrapper.unregister` (non-breaking):
  - `libWrapper.register` now returns a unique numeric target identifier.
  - This unique identifier can be used in further calls to `libWrapper.register` and `libWrapper.unregister`, rather than specifying the target path again.
    As a result, even if the object is no longer reachable from global scope or has otherwise been replaced by another module, it is still possible to register/unregister wrappers to it.
  - The `libWrapper.Register` and `libWrapper.Unregister` hooks have been updated, and now also supply the unique target identifier as an extra parameter.
  - Note: The Shim does not support nor provide these unique identifiers.
- Improvements to 'Active Wrappers' pane in the settings window:
  - Add the target identifier to the displayed information.
  - Do not merge wrappers with the same path but with different target objects (i.e. different target IDs).
  - When a target is known by multiple names, display the additional names when expanded.
- Fixed a few cases where having multiple wrappers sharing the same target path but with different target objects (i.e. different target IDs) could cause issues.
- Fix setter inheritance chain handling for properties when there are no setter-specific wrappers.
- Update test cases to exercise the new target identifier code paths properly.
- Miscellaneous cleanup/refactoring and optimisations.
- Update `compatibleCoreVersion`, now set to v9d2 (`9.231`). Note: This was previously set to a non-existent version (`9.244`) by accident.

# 1.10.8.0 (2021-10-10)

- Fix [Issue #56](https://github.com/ruipin/fvtt-lib-wrapper/issues/56).
  - Fix handling of unknown packages.
  - Correctly use package ID passed to `libWrapper.register` in specific error messages, when auto-detection does not succeed.
  - Ensure all exceptions thrown are an object, in order to fix compatibility issue with Foundry 0.8.x when thrown inside `Application._render`.
- Code cleanup: Refactor error classes usage to avoid a cyclic dependency.

# 1.10.7.0 (2021-10-07)

- Fix incorrect error message when a package that conflicts does not correctly define a `minimumCoreVersion` or `compatibleCoreVersion`.
- Optimise the indexing regex, to remove potential exponential backtracking.
- Tweak README to make it clearer that `libWrapper.Ready` is not implemented by the compatibility shim.

# 1.10.6.0 (2021-09-18)

- Add official support for v9p2 (9.244). Previous versions are still supported.

# 1.10.5.0 (2021-09-06)

- Relax `Hooks._call` patch regex to work even when `foundry.js` has been modified.

# 1.10.4.0 (2021-09-05)

- Fix issue where sometimes the relative file paths to a localisation JSON file would be incorrect.
- Use JSCC pre-processor to improve initialisation
  - Strip all unnecessary unit-test code from artifact.
  - Bundle version information into artifact, to avoid having to look at the module.json during runtime
  - Bundle list of available translations into artifact, to skip requesting a localisation JSON file if it does not exist.

# 1.10.3.0 (2021-09-02)

- Add Spanish localisation, contributed by GoR (GoR#9388). Thank you!
- Tweak how support channels are specified in the localisation JSON files, to avoid having to specify them twice.

# 1.10.2.0 (2021-08-27)

- Tweak localisation polyfill. Messages should now be localised correctly before `game.i18n` initialises.
- Fix Settings UI: `Show ignored conflicts` checkbox clicks sometimes would not register.
- Add pt-BR localisation, contributed by Matheus Clemente (mclemente#5524). Thank you!
- Add pt-PT localisation.

# 1.10.1.1 (2021-08-27)

- Fix build workflow to properly include translation JSON files in the artifact.
- No code changes.

# 1.10.1.0 (2021-08-27)

- Hotfix: Foundry did not load with libWrapper enabled if set to a language for which no libWrapper translation was available.

# 1.10.0.0 (2021-08-26)

- **[BREAKING]** Remove LibWrapperError methods deprecated since v1.6.0.0:
  - `LibWrapperInternalError.module`, replaced by `LibWrapperInternalError.package_id`
  - `LibWrapperPackageError.module`, replaced by `LibWrapperPackageError.package_id`
- Improve error messages (Implements [#42](https://github.com/ruipin/fvtt-lib-wrapper/issues/42))
- Add support for localization (Implements [#44](https://github.com/ruipin/fvtt-lib-wrapper/issues/44))
  - As of now, only includes the english language, but community contributions are welcome.

# 1.9.2.0 (2021-08-25)

- Resolve `ignore_conflicts` API not ignoring all types of conflicts. (Fixes [Issue #49](https://github.com/ruipin/fvtt-lib-wrapper/issues/49))

# 1.9.1.0 (2021-08-25)

- When an unhandled exception is seen by libWrapper, it will detect involved packages (if any) and append this list to the exception message.

# 1.9.0.0 (2021-08-23)

- Support wrapping global methods when they are available in `globalThis` and the associated descriptor has `configurable: true`.
- Include shared library [fvtt-shared-library](https://github.com/ruipin/fvtt-shared-library) statically for `PackageInfo`, polyfills, and Enums.
  - Now correctly able to detect package IDs (e.g. in case of compatibility issues) before the `init` hook.
  - Can now use enum objects for the `type` and `options.perf_mode` parameters to `libWrapper.register`, e.g. `libWrapper.WRAPPER` or `libWrapper.PERF_FAST`.
- Fix `libWrapper.register` API: The value `NORMAL` for `options.perf_mode` was incorrectly not permitted.
- Miscellaneous code cleanup.

# 1.8.1.0 (2021-08-22)

- Attempt to prevent other modules from breaking the libWrapper initialisation process.
  - **[BREAKING]** Prevent use of `Game.toString()` before libWrapper initialises.
  - Detect when the libWrapper initialisation process did not run because of another module.
- Prepend `/* WARNING: libWrapper wrappers present! */` to `toString()` calls on methods wrapped by libWrapper.
- Explicitly announce compatibility with Foundry 0.8.9.

# 1.8.0.0 (2021-07-29)

- Allow `libWrapper.register` targets to contain string Array indexes. (Fixes [Issue #46](https://github.com/ruipin/fvtt-lib-wrapper/issues/46))
  For example, `CONFIG.Actor.sheetClasses.character["dnd5e.ActorSheet5eCharacter"].cls.prototype._onLongRest` is now a valid wrapper target.

# 1.7.5.0 (2021-07-05)

- Don't fail registering wrappers if `game` is malformed.

# 1.7.4.0 (2021-07-05)

- Handle malformed `game.modules` gracefully. This can happen when Foundry does not initialise properly which by itself can cause issues, but libWrapper was making the situation even worse by aborting the initialisation process.
- Explicitly announce compatibility with Foundry 0.8.8.

# 1.7.3.0 (2021-06-22)

- Update 'About' pane in the settings with more information about reporting issues.
- Update documentation
  - Explain differences between the full library and the shim.
  - Add information about how to obtain support.

# 1.7.2.0 (2021-06-19)

- Rename `error-listeners.js` to `listeners.js` (see [Issue #42](https://github.com/ruipin/fvtt-lib-wrapper/issues/42)).
- Do not prefix `libWrapper-` to `listeners.js` file in the sourcemap.
- Explicitly announce compatibility with Foundry 0.8.7.
- Add `bugs` attribute to manifest, and enable [Bug Reporter](https://github.com/League-of-Foundry-Developers/bug-reporter) support.
- Miscellaneous code cleanup.
- Update documentation:
  - Add section about Systems.
  - Add section about Mixins.
  - Add section about `super`.
- Update release script to properly handle commas in the manifest file, as well as be easier to maintain.

# 1.7.1.0 (2021-06-14)

- Include Git commit hash in manifest.
  - Update release scripts.
  - Update version parsing code.

# 1.7.0.0 (2021-06-09)

- **[BREAKING]** Removed `libWrapper.clear_modules` API, `libWrapper.ClearModule` hook, and `LibWrapperModuleError` exception class (all deprecated since v1.6.0.0).
- Implement backend system for ignoring known potential conflicts (part of [Issue #33](https://github.com/ruipin/fvtt-lib-wrapper/issues/33))
  - Added `libWrapper.ignore_conflicts` API method to allow package developers to have libWrapper not warn the user about certain conflicts.
  - Add a toggle to the 'Conflicts' tab in the settings dialog to display detected conflicts that were ignored. These are hidden by default.
  - Hooks `libWrapper.ConflictDetected` and `libWrapper.OverrideLost` now also get passed a list of all unique `target` parameters that have been used to register wrappers for a given method, instead of just the first one ever used. This is important for methods that are reachable through more than one target path.

# 1.6.2.0 (2021-06-04)

- Fix errors seen when wrapping inherited properties.
  - These were caused by a terser bug ([terser/terser #1003](https://github.com/terser/terser/issues/1003)).
- Clean up `Wrapper` singleton detection code.
- Explicitly announce compatibility with Foundry 0.8.6.


# 1.6.1.0 (2021-05-26)

- Fix infinite loop leading to a `RangeError: Maximum call stack size exceeded` error when both libWrapper wrappers and manual wrappers are present on a method inherited from a parent class.
  - Fixes the incompatibility between "TouchVTT" and "Drag Ruler" when libWrapper was active.
- Fix module ID not displaying correctly in settings dialog for `MANUAL` wrappers.

# 1.6.0.1 (2021-05-24)

- No code changes.
- Explicitly announce compatibility with Foundry 0.8.5.

# 1.6.0.0 (2021-05-10)

- **[BREAKING]** Remove `libWrapperReady` hook (deprecated since v1.5.0.0, `libWrapper.Ready` should be used instead).
- Rename all instances of `module` to `package`, given the library now officially supports systems and worlds.
  - Deprecate `libWrapper.clear_module` method (now `libWrapper.unregister_all`) and the `libWrapper.ClearModule` hook (now `libWrapper.UnregisterAll`).
  - Deprecate `libWrapper.ModuleError` (now `libWrapper.PackageError`).
  - Deprecate all `libWrapper.Error.module` getters (now `libWrapper.Error.package_id`).
- Rewrite module auto-detection functionality to be able to handle systems and worlds correctly.
  - Allows modules/systems/worlds to co-exist even when they share the same package ID.
- Make it explicit when a package ID corresponds to a world or system.
  - Error and warning messages now display `world` and `system` instead of `module`, when applicable.
  - Display `[World]` and `[System]` next to the package IDs in the settings dialog when packages are not modules.
- Miscellaneous code clean-up in preparation for future work.
- Announce compatibility with Foundry 0.8.3.

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