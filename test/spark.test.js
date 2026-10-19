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
