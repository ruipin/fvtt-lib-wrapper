import path from 'path';

import cleanup from 'rollup-plugin-cleanup';
//import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import { terser } from "rollup-plugin-terser";
import json from 'rollup-plugin-json';
import jscc from 'rollup-plugin-jscc';

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
			values: { _ROLLUP: 1 }
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
			/*mangle: {
				properties: {
					regex: /^_/
				}
			}*/
		})
	]
};