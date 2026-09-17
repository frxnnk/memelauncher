import { build } from 'esbuild';
await build({ entryPoints: ['client/vault-face.mjs'], outfile: 'public/vendor/vault-face.js', bundle: true,
  platform: 'browser', format: 'esm', target: ['es2022'], minify: true, sourcemap: false,
  banner:{js:'/* Bloub engine (c) 2026 Jérémy Perret, MIT. See /vendor/bloub-LICENSE.txt. */'}, logLevel:'info' });
await build({ entryPoints: ['client/privy.mjs'], outfile: 'public/vendor/privy.js', bundle: true,
  platform: 'browser', format: 'esm', target: ['es2022'], minify: true, sourcemap: false,
  legalComments: 'linked', logLevel: 'info' });
