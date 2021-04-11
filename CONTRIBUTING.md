# 1. Contributing to libWrapper

- [1. Contributing to libWrapper](#1-contributing-to-libwrapper)
  - [1.1. Installation](#11-installation)
  - [1.2. Test Suite](#12-test-suite)
  - [1.3. Generating a Release Artifact](#13-generating-a-release-artifact)
  - [1.4. Pull Requests](#14-pull-requests)

## 1.1. Installation
You should clone this repository and symlink it inside Foundry VTT's `Data/modules` folder, then restart the server.

-   After cloning this repository, you will need to install NPM and then run the following console commands to set up the development environment:

    ```bash
    npm install
    npm run build
    ```

    These will install the NPM dependencies required for module development, and compile [less/lib-wrapper.less](less/lib-wrapper.less) into `dist/lib-wrapper.css`.


## 1.2. Test Suite
The script contains a basic test suite in [tests](tests) which can be used to validate various usage cases and library behaviour. This can be run by doing `npm test`.

-   ⚠ While this test suite does test a significant amount of the library functionality, it does not achieve full coverage. It is always recommended to test the library with some real-world modules and confirm that they are working as expected.

-   The wiki list of [Modules using libWrapper](https://github.com/ruipin/fvtt-lib-wrapper/wiki/Modules-using-libWrapper) can be used as a source of modules for testing.


## 1.3. Generating a Release Artifact
To generate a release artifact, you should use the command `npm run build`.

-   The JS code in [src](src) will be rolled up into a single file and minified automatically, with the corresponding sourcemap also generated. The results of this process are stored in `dist/lib-wrapper.js` and `dist/lib-wrapper.js.map`.

    -   For ease of development, by default the module manifest points to the unprocessed [src/index.js](src/index.js) such that source code changes are immediately visible.

    -   To use the output of the `npm run build` command, you will need to locally update your local [module.json](module.json) to point to `dist/lib-wrapper.js` instead of [src/index.js](src/index.js).

-   The LESS stylesheet [less/lib-wrapper.less](less/lib-wrapper.less) will be compiled into `dist/lib-wrapper.css`.

-   Note that the actual [release artifacts](https://github.com/ruipin/fvtt-lib-wrapper/releases) on Github are generated using a custom Github Action, which is responsible for updating the module manifest and packaging the build output into a ZIP file.
    This is implemented in [.github/workflows/release.yml](.github/workflows/release.yml).


## 1.4. Pull Requests
I am happy to receive pull requests and other contributions, although I might not have the time to look at them immediately.
Before submitting a pull request, please ensure the test suite passes. It is also a good idea to open an issue in the issue tracker before doing any work, and discuss your plans.

The issue tracker will contain various feature requests, and contributions for those is particularly welcome.