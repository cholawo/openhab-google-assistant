import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';
import { config as loadEnv } from 'dotenv';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = existsSync(resolve(root, '.env')) ? resolve(root, '.env') : resolve(root, '.env.example');

loadEnv({ path: envPath });

const port = process.env.LOCAL_PORT ?? '3002';
const define = {
  'process.env.LOCAL_PORT': JSON.stringify(port)
};
const entryPoints = [resolve(root, 'local-app/index.ts')];

await esbuild.build({
  entryPoints,
  outfile: resolve(root, 'dist/local/web/bundle.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  define
});

writeFileSync(
  resolve(root, 'dist/local/web/index.html'),
  `<!doctype html>
<html>
<head>
  <script src="https://www.gstatic.com/eureka/smarthome/smarthome_sdk.js"></script>
  <script src="bundle.js"></script>
</head>
<body></body>
</html>
`
);

await esbuild.build({
  entryPoints,
  outfile: resolve(root, 'dist/local/node/bundle.js'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: ['es2020'],
  define
});

console.log(`Local Home bundles written using LOCAL_PORT from ${envPath}`);
console.log(`LOCAL_PORT=${port}`);
