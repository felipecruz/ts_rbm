import { copyFile, cp, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import katex from 'katex';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function decodeAttribute(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name) => {
    if (name[0] !== '#') return entities[name.toLowerCase()];
    const hexadecimal = name[1].toLowerCase() === 'x';
    return String.fromCodePoint(parseInt(name.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10));
  });
}

// The essay keeps its authored LaTeX in quoted attributes. Respect quoted '>'
// characters and HTML entities so the validator sees what the browser sees.
export function validateMath(html) {
  const tags = html.matchAll(/<[a-z][^"'<>]*(?:(?:"[^"]*"|'[^']*')[^"'<>]*)*>/gi);
  let count = 0;
  for (const tag of tags) {
    const attributes = Object.fromEntries(Array.from(
      tag[0].matchAll(/\b(data-tex|data-display)\s*=\s*(["'])(.*?)\2/gs),
      match => [match[1], decodeAttribute(match[3])],
    ));
    if (!Object.hasOwn(attributes, 'data-tex')) continue;
    count++;
    try {
      katex.renderToString(attributes['data-tex'], {
        displayMode: attributes['data-display'] === 'true',
        output: 'htmlAndMathml',
        throwOnError: true,
        strict: 'error',
        trust: false,
      });
    } catch (error) {
      const line = html.slice(0, tag.index).split('\n').length;
      throw new Error(`Invalid LaTeX in index.html:${line}: ${error.message}`, { cause: error });
    }
  }
  return count;
}

async function buildMath() {
  const count = validateMath(await readFile(resolve(root, 'index.html'), 'utf8'));
  const packageRoot = dirname(require.resolve('katex/package.json'));
  const distribution = resolve(packageRoot, 'dist');
  const destination = resolve(root, 'assets/vendor/katex');
  await mkdir(destination, { recursive: true });
  await Promise.all([
    ...['katex.min.js', 'katex.min.css'].map(filename =>
      copyFile(resolve(distribution, filename), resolve(destination, filename))),
    copyFile(resolve(packageRoot, 'LICENSE'), resolve(destination, 'LICENSE')),
    cp(resolve(distribution, 'fonts'), resolve(destination, 'fonts'), { recursive: true }),
  ]);
  console.log(`Prepared local KaTeX assets; validated ${count} formulas.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildMath();
}
