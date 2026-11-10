// Bundles src/ into dist/: dist/content.js (one IIFE, no globals) and dist/styles.css (the generated Mber Flow
// tokens followed by the rules). manifest.json and spark.json point at these two files; the repository folder itself
// is the unpacked extension.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
await build({
  entryPoints: ['src/main.js'],
  outfile: 'dist/content.js',
  bundle: true,
  format: 'iife',
  target: 'chrome110',
});
writeFileSync(
  'dist/styles.css',
  `${readFileSync('src/tokens.css', 'utf8')}\n${readFileSync('src/styles.css', 'utf8')}`,
);
console.log('Built dist/ - load this folder in chrome://extensions (developer mode, "Load unpacked").');
