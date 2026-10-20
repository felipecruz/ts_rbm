import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import katex from 'katex';

const catalogSource = await readFile(new URL('../assets/locales/pt-BR.js', import.meta.url), 'utf8');
const runtimeSource = await readFile(new URL('../assets/i18n.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
function runtime(search = '') {
  const context = { URL, URLSearchParams, location: { search } };
  runInNewContext(catalogSource, context);
  runInNewContext(runtimeSource, context);
  return { ...context.I18n, messages: context.PORTUGUESE_MESSAGES };
}

test('language URLs support pt-BR and pt, default to English, and retain section and other parameters', () => {
  for (const query of ['', '?lang=en', '?lang=fr', '?lang=<script>']) assert.equal(runtime(query).language, 'en');
  for (const query of ['?lang=pt-BR', '?lang=pt-br', '?lang=PT-BR', '?lang=pt']) assert.equal(runtime(query).language, 'pt-BR');
  const href = runtime().languageURL('https://felipecruz.github.io/ts_rbm/?source=guide&lang=en#patternLab', 'pt-BR');
  const url = new URL(href);
  assert.equal(url.pathname, '/ts_rbm/');
  assert.equal(url.searchParams.get('source'), 'guide');
  assert.equal(url.searchParams.get('lang'), 'pt-BR');
  assert.equal(url.hash, '#patternLab');
  assert.equal(runtime().languageURL(href, 'en'), 'https://felipecruz.github.io/ts_rbm/?source=guide&lang=en#patternLab');
});

test('translations preserve whitespace and interpolate literal values without interpreting markup or placeholders', () => {
  const pt = runtime('?lang=pt-BR'), en = runtime('?lang=en');
  assert.equal(pt.t('  Train the model\n'), '  Treinar o modelo\n');
  assert.equal(pt.t`Step ${4} · now`, 'Passo 4 · agora');
  assert.equal(en.t`Step ${4} · now`, 'Step 4 · now');
  assert.equal(pt.t`Select ${'<img>{1}'} pattern`, 'Selecionar o padrão <img>{1}');
  assert.equal(pt.t('unknown text'), 'unknown text');
  assert.equal(pt.number(0.881, 3), '0,881');
  assert.equal(pt.number(1200), '1.200');
  assert.equal(en.number(1200), '1,200');
});

test('every authored prose fragment and accessibility label has Brazilian Portuguese copy', () => {
  const { messages } = runtime();
  const unchanged = new Set(['FIG. 01', 'Geoffrey Hinton, 2010 ↗', 'English', 'Português (BR)']);
  const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const text = html.replace(/<!--[^]*?-->/g, '').replace(/<(?:"[^"]*"|'[^']*'|[^'">])*?>/g, '\n');
  const fragments = text.split('\n').map(value => decode(value.trim())).filter(value => /[a-zA-Z]{2}/.test(value));
  for (const match of html.matchAll(/(?:aria-label|title|placeholder)="([^"]+)"/g)) fragments.push(decode(match[1]));
  for (const fragment of fragments) assert.ok(Object.hasOwn(messages, fragment) || unchanged.has(fragment), `Missing translation: ${fragment}`);
});

test('translated dynamic messages have matching interpolation slots', async () => {
  const { messages } = runtime();
  const slots = value => [...value.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
  for (const [key, value] of Object.entries(messages)) assert.deepEqual(slots(value), slots(key), key);
  for (const file of ['app.js', 'tutorial.js']) {
    const source = await readFile(new URL(`../assets/${file}`, import.meta.url), 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function visit(node) {
      if (ts.isTaggedTemplateExpression(node) && node.tag.getText(ast) === 't') {
        const template = node.template;
        let key = template.head.text;
        template.templateSpans.forEach((span, index) => { key += `{${index}}${span.literal.text}`; });
        assert.ok(Object.hasOwn(messages, key), `Missing dynamic translation: ${key}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});

test('all 48 equations render strictly in both languages, with Portuguese labels and decimal commas', () => {
  const pt = runtime('?lang=pt-BR');
  const equations = [...html.matchAll(/data-tex="([^"]+)"/g)].map(match => match[1].replace(/&amp;/g, '&'));
  assert.equal(equations.length, 48);
  for (const equation of equations) {
    for (const source of [equation, pt.tex(equation)]) {
      assert.doesNotThrow(() => katex.renderToString(source, { strict: 'error', throwOnError: true, trust: false }));
    }
  }
  assert.equal(pt.tex('\\sigma(2.0)\\approx0.881'), '\\sigma(2{,}0)\\approx0{,}881');
  assert.match(pt.tex('\\mathrm{rebuilt}'), /reconstrução/);
});

test('translated experiment controls keep their original DOM identifiers', async () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const source = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('app.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === '$') {
      const arg = node.arguments[0];
      assert.ok(ts.isStringLiteral(arg) || ts.isTemplateExpression(arg), 'DOM identifiers must never be translated');
      if (ts.isStringLiteral(arg)) assert.ok(ids.has(arg.text), `Missing DOM element: ${arg.text}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
});

test('interactive probability uses locale decimals for readers and numeric decimals for CSS and ARIA', async () => {
  const source = await readFile(new URL('../assets/tutorial.js', import.meta.url), 'utf8');
  for (const language of ['en', 'pt-BR']) {
    const elements = new Map();
    for (const id of ['evidenceSlider', 'evidenceEquation', 'evidenceValue', 'probabilityValue', 'probabilityMeter', 'probabilityFill']) {
      elements.set(id, { value: '2', style: {}, dataset: {}, attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, fn) { this[name] = fn; }, dispatchEvent() {},
      });
    }
    runInNewContext(source, { I18n: runtime(`?lang=${language}`), document: { getElementById: id => elements.get(id) }, Event: class {} });
    assert.equal(elements.get('probabilityFill').style.width, '88.1%');
    assert.equal(elements.get('probabilityMeter').attributes['aria-valuenow'], '88.1');
    assert.equal(elements.get('probabilityValue').textContent, language === 'pt-BR' ? '88,1%' : '88.1%');
    elements.get('evidenceSlider').value = '-2';
    elements.get('evidenceSlider').input();
    assert.equal(elements.get('probabilityFill').style.width, '11.9%');
    assert.equal(elements.get('probabilityValue').textContent, language === 'pt-BR' ? '11,9%' : '11.9%');
  }
});
