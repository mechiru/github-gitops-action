// @ts-check

import typescript from '@rollup/plugin-typescript';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

import {glob} from 'glob';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export default [
  {
    input: 'src/main.ts',
    output: {
      file: 'dist/main.mjs',
      format: 'es',
    },
    plugins: [
      typescript(),
      nodeResolve(),
      commonjs(),
    ],
  },
  {
    input: Object.fromEntries(
      glob.sync('src/**/*.test.ts').map(file => [
        // This remove `src/` as well as the file extension from each
        // file, so e.g. src/nested/foo.js becomes nested/foo
        path.relative(
          'src',
          file.slice(0, file.length - path.extname(file).length)
        ),
        // This expands the relative paths to absolute paths, so e.g.
        // src/nested/foo becomes /project/src/nested/foo.js
        fileURLToPath(new URL(file, import.meta.url)),
      ])
    ),
    output: {
      dir: 'test',
      format: 'es',
      entryFileNames: '[name].mjs',
    },
    plugins: [
      typescript(),
      nodeResolve(),
      commonjs(),
    ],
  },
];
