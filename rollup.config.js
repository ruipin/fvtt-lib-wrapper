import path from 'path';
import fs from 'fs';

import cleanup from 'rollup-plugin-cleanup';
//import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import { terser } from "rollup-plugin-terser";
import json from '@rollup/plugin-json';
import jscc from 'rollup-plugin-jscc';


// Parse the version information from the current module.json
import { _parse_manifest_version } from './src/shared/version.js';
import moduleJson from './module.json';
const pkgVersion = _parse_manifest_version(moduleJson.version, moduleJson.flags.git_version);
if(!pkgVersion.known)
	throw "Failed to parse package version";

// Get a list of the available languages, to pass to JSCC
const i18nLangs = fs.readdirSync('./lang').map((f) => path.parse(f).name);


// Rollup config
export default {
	input: 'src/index.js',
	output: {
		file: 'dist/lib-wrapper.js',
		format: 'es',
		globals: {
			jquery: '$'
		},
		banner: "// SPDX-License-Identifier: LGPL-3.0-or-later\n// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro\n",
		compact: true,
		interop: false,
		sourcemap: 'dist/lib-wrapper.js.map',
		sourcemapPathTransform: (nm) => {
			const basename = path.basename(nm);
			if(basename == 'listeners.js')
				return nm;
			else
				return path.join(path.dirname(nm), 'libWrapper-' + path.basename(nm));
		}
	},
	plugins: [
		jscc({
			values: {
				_ROLLUP: 1,
				_PACKAGE_VERSION: pkgVersion,
				_I18N_LANGS: i18nLangs
			}
		}),
		json({
			compact: true
		}),
		cleanup({
			comments: 'jsdoc'
		}),
		/*getBabelOutputPlugin({
			plugins: [
			]
		}),*/
		terser({
			ecma: 2021,
			toplevel: true,
			module: true,
			keep_classnames: true,
			/*mangle: {
				properties: {
					regex: /^_/
				}
			}*/
		})
	]
};