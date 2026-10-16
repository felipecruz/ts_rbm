import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, '_site');

// Publish only the files used by the essay, including its generated math assets.
const files = [
  'index.html',
  'run.js',
  'assets/style.css',
  'assets/app.js',
  'assets/math.js',
  'assets/tutorial.js',
  'assets/vendor/katex',
];

await rm(destination, { recursive: true, force: true });
for (const file of files) {
  const target = resolve(destination, file);
  await mkdir(dirname(target), { recursive: true });
  await cp(resolve(root, file), target, { recursive: true });
}

console.log('Prepared the GitHub Pages site in _site/.');
