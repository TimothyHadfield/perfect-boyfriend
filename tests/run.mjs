// Tiny test runner: `node tests/run.mjs`. Runs every tests/*.test.mjs file.
// Test files call test(name, fn) from ./harness.mjs.
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { results } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort();

for (const f of files) {
  try {
    await import(pathToFileURL(join(here, f)).href);
  } catch (err) {
    results.list.push({ file: f, name: '(load)', ok: false, error: err.message });
  }
}
await results.done();

let pass = 0, fail = 0;
for (const r of results.list) {
  if (r.ok) pass++;
  else {
    fail++;
    console.log(`FAIL  ${r.file} :: ${r.name}\n      ${r.error}`);
  }
}
console.log(`\n${pass} passed, ${fail} failed (${files.length} files)`);
process.exitCode = fail ? 1 : 0;
