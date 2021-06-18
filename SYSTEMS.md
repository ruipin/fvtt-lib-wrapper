# 1. Systems

The libWrapper library has official support for all types of packages, including systems.

However, it is recommended that you read through the warnings and recommendations in this section before you use it inside a system.

- [1. Systems](#1-systems)
  - [1.1. Do not use libWrapper inside a system if avoidable](#11-do-not-use-libwrapper-inside-a-system-if-avoidable)
  - [1.2. Make libWrapper a soft dependency whenever possible](#12-make-libwrapper-a-soft-dependency-whenever-possible)
  - [1.3. What to do if a hard dependency cannot be avoided](#13-what-to-do-if-a-hard-dependency-cannot-be-avoided)


## 1.1. Do not use libWrapper inside a system if avoidable

Most of the benefits provided by libWrapper are specific to modules. This is because systems should always load before any module, with the exception of modules with `"library": true` in their manifest (although those should not introduce compatibility issues).

⚠ *The above is only strictly true since Foundry 0.8.3. See [this FoundryVTT issue](https://gitlab.com/foundrynet/foundryvtt/-/issues/4922) for more information.*

Given that systems go first, they are guaranteed to have first go at patching core methods as long as they do everything as soon as possible (i.e. immediately on system execution, on the init hook, etc). From the point-of-view of modules, whatever modifications the system did to the core Foundry code should be transparent, and not even libWrapper would know they have been modified.

In short, as long as you follow the following rules, libWrapper should be completely unnecessary:

1. Wrap and/or patch everything as soon as possible, before any modules.
2. Be careful with the use of `async` before wrapping or patching core code, as they might allow modules to run before the rest of your code.
3. Keep your changes to the core code as transparent as possible.


## 1.2. Make libWrapper a soft dependency whenever possible

There are some situations where libWrapper does introduce benefits, and its use should be considered:

1. Dynamically patching methods, i.e. registering/unregistering wrappers during gameplay.
2. Running system-specific code even when modules create `OVERRIDE` wrappers.

If your use-case falls under these (or you have another situation where libWrapper becomes necessary), it is not recommended to *require* libWrapper to be installed unless absolutely necessary. Instead, you should use the provided [shim](shim/SHIM.md) (or a custom compatibility layer), and recommend the use of libWrapper.

There are multiple reasons for this:

1. Foundry's dependency system is not perfect. It is possible to enable packages or systems without their listed dependencies being present.

2. While libWrapper is well-tested, as with any piece of software it might contain bugs. While we endeavour to fix bugs ASAP, this is a hobby project done in our spare time, and we make absolutely zero guarantees about the time scales for a fix.

   1. A compatibility layer will allow you to triage issues with libWrapper both enabled and disabled.

   2. If you do find a bug, you and you and your users do not need to wait for a fix.

   3. If libWrapper breaks at any point (e.g. after a Foundry update), you and your users do not need to wait for a fix.

3. Many modules use libWrapper, and a common method of triaging module failures it to toggle libWrapper off. This is not possible if the system requires libWrapper to work.


## 1.3. What to do if a hard dependency cannot be avoided

There are some rare situations where the full functionality of the libWrapper library is necessary, and the [shim](shim/SHIM.md) (or a custom compatibility layer) is not an adequate replacement.

In such a case, making libWrapper a hard dependency might be your best choice. However, you should keep to the following rules:

1. Ensure your manifest lists `lib-wrapper` as a dependency. Refer to the [installation section of the README](README.md#122-as-a-library) for further details.

2. It is possible that libWrapper might not be active (on purpose or by mistake) when your system loads. As such, you must ensure that:

    1. The game still loads even without libWrapper enabled.

    2. Loading without libWrapper enabled does not corrupt any world data.

    3. The user is given a clear error message that they should enable libWrapper if it is disabled.

    4. Important basic functionality should still work. A user should be able to *at a minimum* export their data (such as character sheets), if necessary.

3. Although libWrapper's API should be backwards-compatible, we make no guarantees this will always be the case.

   1. You should very clearly document which versions of libWrapper you have tested with, so the user can downgrade libWrapper if necessary.

   2. You should warn the user if the libWrapper version is older than the one you tested against, so they can upgrade if necessary.

4. If at all possible, use `try/catch` statements when calling `libWrapper.register` and handle failures gracefully, for instance by disabling specific functionality only.