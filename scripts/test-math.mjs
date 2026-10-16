import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import katex from 'katex';
import { validateMath } from './build-math.mjs';

const source = await readFile(new URL('../assets/math.js', import.meta.url), 'utf8');

function formula(tex, fallback, display = false) {
  let content = fallback;
  return {
    dataset: { tex, display: String(display) },
    get innerHTML() { return content; },
    set innerHTML(value) { content = value; },
    get textContent() { return content; },
    set textContent(value) { content = value; },
    matches: selector => selector === '[data-tex]',
  };
}

function run(formulas, library) {
  const warnings = [];
  const listeners = new Map();
  runInNewContext(source, {
    window: { katex: library },
    document: {
      querySelectorAll: () => formulas,
      addEventListener: (type, handler) => listeners.set(type, handler),
    },
    console: { warn: (...args) => warnings.push(args) },
  });
  return { warnings, update: element => listeners.get('math:update')({ target: element }) };
}

test('the tutorial formulas parse as strict LaTeX, including encoded attribute characters', async () => {
  validateMath(await readFile(new URL('../index.html', import.meta.url), 'utf8'));
  assert.equal(validateMath('<span data-tex="p &gt; 0">positive probability</span>'), 1);
  assert.equal(validateMath('<span data-tex="\\begin{aligned} a &amp;= b \\\\ c &amp;= d \\end{aligned}" data-display="true"></span>'), 1);
  assert.throws(() => validateMath('<span data-tex="\\frac{1}{">fraction</span>'), /Invalid LaTeX in index.html:1/);
});

test('math includes accessible MathML and can update an interactive equation', () => {
  const inline = formula('p = 0.5', 'Probability is one half');
  const display = formula('p = 0.8', 'Probability is eight tenths', true);
  const runtime = run([inline, display], katex);
  assert.match(inline.innerHTML, /<math /);
  assert.match(inline.innerHTML, /aria-hidden="true"/);
  assert.match(display.innerHTML, /class="katex-display"/);
  inline.dataset.tex = 'p = 0.9';
  runtime.update(inline);
  assert.match(inline.innerHTML, /encoding="application\/x-tex">p = 0.9/);
  assert.equal(runtime.warnings.length, 0);
});

test('readable explanations survive unavailable math assets and invalid dynamic formulas', () => {
  const missing = formula('p = 0.5', 'Probability is one half');
  assert.equal(run([missing], undefined).warnings.length, 1);
  assert.equal(missing.textContent, 'Probability is one half');

  const broken = formula('\\frac{', 'A readable explanation');
  const valid = formula('p = 0.8', 'Probability is eight tenths');
  const runtime = run([broken, valid], katex);
  assert.equal(broken.textContent, 'A readable explanation');
  assert.match(valid.innerHTML, /<math /, 'One invalid formula must not prevent later formulas from rendering');
  valid.dataset.tex = '\\frac{';
  runtime.update(valid);
  assert.equal(valid.textContent, 'Probability is eight tenths');
  assert.equal(runtime.warnings.length, 2);
});
