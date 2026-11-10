import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const read = (file) => JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'));

it('describes the same tool for Spark as the Chrome manifest', () => {
  const spark = read('spark.json');
  const manifest = read('manifest.json');
  const [script] = manifest.content_scripts;
  expect(spark.version).toBe(manifest.version);
  expect(spark.matches).toEqual(script.matches);
  expect(spark.js).toEqual(script.js);
  expect(spark.css).toEqual(script.css);
  expect(spark.network).toEqual([]);
});

it('exposes only the fonts, only to the Maps hosts, with the origin patterns Chrome accepts there', () => {
  const manifest = read('manifest.json');
  const [script] = manifest.content_scripts;
  const [fonts, ...others] = manifest.web_accessible_resources;
  expect(others).toEqual([]);
  expect(fonts.resources).toEqual(['fonts/*.woff2']);
  // Chrome refuses the whole manifest when a pattern here has a path other than /*.
  for (const pattern of fonts.matches) expect(pattern).toMatch(/^https:\/\/[^/*]+\/\*$/);
  const origins = script.matches.map((pattern) => `${new URL(pattern.replace('*', 'x')).origin}/*`);
  expect(fonts.matches).toEqual([...new Set(origins)]);
});
