import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
await build({
  entryPoints: ['src/main.js'],
  outfile: 'dist/content.js',
  bundle: true,
  format: 'iife',
  target: 'chrome110',
});
cpSync('src/styles.css', 'dist/styles.css');
cpSync('manifest.json', 'dist/manifest.json');
if (existsSync('icons')) cpSync('icons', 'dist/icons', { recursive: true });
console.log('Built dist/ - load it in chrome://extensions (developer mode, "Load unpacked").');
