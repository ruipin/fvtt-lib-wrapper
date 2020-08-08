import cleanup from 'rollup-plugin-cleanup';

//import { getBabelOutputPlugin } from '@rollup/plugin-babel';
//import { terser } from "rollup-plugin-terser";

export default {
	input: 'src/index.js',
	output: {
		file: 'dist/lib-wrapper.js',
		format: 'es',
		globals: {
			jquery: '$'
		},
		banner: "// SPDX-License-Identifier: LGPL-3.0-or-later\n// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro\n",
		compact: true,
		interop: false
	},
	plugins: [
		cleanup({
			comments: 'jsdoc'
		}),
		/*getBabelOutputPlugin({
			plugins: [
				"@babel/plugin-proposal-optional-chaining",
				"@babel/plugin-proposal-class-properties"
			]
		}),*/
		/*terser({
			ecma: 2018,
			toplevel: true,
			module: true
		})*/
	]
};