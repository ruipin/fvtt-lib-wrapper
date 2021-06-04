import path from 'path';

import cleanup from 'rollup-plugin-cleanup';
//import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import { terser } from "rollup-plugin-terser";

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
		sourcemapPathTransform: (nm) => path.join(path.dirname(nm), 'libWrapper-' + path.basename(nm))
	},
	plugins: [
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
			/*mangle: {
				properties: {
					regex: /^_/
				}
			}*/
		})
	]
};