import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(join(tmpdir(), 'ts-rbm-tests-'));
const compiler = join(root, 'node_modules/typescript/bin/tsc');
const sources = ['src/LinearAlgebra.ts', 'src/MachineLearning.ts'];

function compile(name, files, options = []) {
  const output = join(temporary, name);
  const result = spawnSync(process.execPath, [compiler, '--outFile', output,
    '--target', 'ES2015', '--lib', 'ES2015,DOM', '--skipLibCheck', ...options, ...files],
  { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return readFileSync(output, 'utf8');
}

let engineSource;
let legacySource;
try {
  engineSource = compile('engine.js', sources, ['--strict']);
  // tsUnit discovers enumerable prototype methods, as emitted by ES5 classes.
  legacySource = compile('legacy.js', [...sources,
    'tests/tsUnit.ts', 'tests/TestLinearAlgebra.ts', 'tests/test.ts'],
  ['--target', 'ES5', '--downlevelIteration']);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

const { LinearAlgebra, MachineLearning } = runInNewContext(
  `${engineSource}\n;({ LinearAlgebra, MachineLearning });`);
const { DenseMatrix } = LinearAlgebra;
const { RBM } = MachineLearning;
const patterns = () => new DenseMatrix(4, 6, [
  1, 1, 1, 0, 0, 0,
  0, 0, 0, 1, 1, 1,
  1, 1, 1, 0, 0, 0,
  0, 0, 0, 1, 1, 1,
]);
const values = matrix => Array.from(matrix.array());

test('the original linear algebra suite passes and discovers its tests', () => {
  const outcome = runInNewContext(`${legacySource}\n;testOutcome;`, {
    console: { log() {} },
  });
  assert.ok(outcome.passes.length >= 30, 'Expected the original vector and matrix tests');
  assert.equal(outcome.errors.length, 0);
});

test('RBM expectations have the right shape and contain finite probabilities', () => {
  const model = new RBM(6, 4, 42);
  const hidden = model.hiddenExpectation(patterns());
  const visible = model.visibleExpectation(hidden);
  assert.deepEqual(Array.from(hidden.shape()), [4, 4]);
  assert.deepEqual(Array.from(visible.shape()), [4, 6]);
  for (const value of [...values(hidden), ...values(visible)]) {
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  }
  const epoch = model.runEpoch(patterns());
  assert.ok(Number.isFinite(epoch.error) && epoch.error >= 0 && epoch.error <= 1);
  assert.equal(epoch.hiddenLayer.size, 4);
  for (const value of epoch.hiddenLayer.values) assert.ok(value >= 0 && value <= 1);
});

test('training learns complementary patterns and lowers reconstruction error', () => {
  const model = new RBM(6, 4, 42);
  const data = patterns();
  const errors = model.learn(data, 600);
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const initial = mean(errors.slice(0, 30));
  const final = mean(errors.slice(-30));
  assert.ok(final < initial * 0.6, `Expected a substantial improvement: ${initial} → ${final}`);
  for (const value of values(model.weights)) assert.ok(Number.isFinite(value));
});

test('opposite reconstruction residuals do not cancel, and hidden outputs are activations', () => {
  const model = new RBM(6, 4, 42);
  model.weights.apply(() => 0);
  const result = model.runEpoch(patterns());
  // Every visible probability is 0.5, so each binary target has squared error 0.25.
  assert.equal(result.error, 0.25);
  assert.deepEqual(Array.from(result.hiddenLayer.values), [0.5, 0.5, 0.5, 0.5]);
  assert.notDeepEqual(Array.from(result.hiddenLayer.values), Array.from(model.hiddenBias.values));
});

test('seeded training and sampling are reproducible', () => {
  const first = new RBM(6, 4, 23);
  const second = new RBM(6, 4, 23);
  assert.deepEqual(values(first.weights), values(second.weights));
  assert.deepEqual(Array.from(first.learn(patterns(), 100)), Array.from(second.learn(patterns(), 100)));
  assert.deepEqual(values(first.weights), values(second.weights));
  assert.deepEqual(values(first.sample(40)), values(second.sample(40)));
  assert.notDeepEqual(values(first.weights), values(new RBM(6, 4, 24).weights));
});

test('generation produces binary pixels and respects the requested batch shape', () => {
  const model = new RBM(6, 4, 42);
  model.learn(patterns(), 100);
  const generated = model.sample(40, 0.9);
  assert.deepEqual(Array.from(generated.shape()), [1, 6]);
  const batch = model.sample(20, 1.2, patterns());
  assert.deepEqual(Array.from(batch.shape()), [4, 6]);
  for (const pixel of [...values(generated), ...values(batch)]) assert.ok(pixel === 0 || pixel === 1);
});

test('completion preserves every observed pixel without mutating the input', () => {
  const model = new RBM(6, 4, 42);
  model.learn(patterns(), 100);
  const input = patterns();
  const original = values(input);
  const mask = [true, false, true, false, true, false];
  const completed = model.complete(input, mask, 40);
  assert.deepEqual(Array.from(completed.shape()), [4, 6]);
  assert.deepEqual(values(input), original);
  for (let row = 0; row < input.rows; row++) {
    for (let col = 0; col < input.cols; col++) {
      const pixel = completed.get(row, col);
      assert.ok(pixel === 0 || pixel === 1);
      if (mask[col]) assert.equal(pixel, input.get(row, col));
    }
  }
});

test('sampling frames expose every actual Gibbs update, starting with noise', () => {
  const model = new RBM(6, 4, 53);
  const reference = new RBM(6, 4, 53);
  model.learn(patterns(), 100);
  reference.learn(patterns(), 100);
  const frames = Array.from(model.sampleSteps(12, 0.85));
  assert.equal(frames.length, 13);
  let previous = reference.sampleFrom(DenseMatrix.zeros(1, 6).apply(() => 0.5));
  assert.deepEqual(values(frames[0].visible), values(previous));
  assert.equal(frames[0].hidden, null);
  assert.equal(frames[0].probabilities, null);
  for (const [step, frame] of frames.entries()) {
    assert.equal(frame.step, step);
    assert.deepEqual(Array.from(frame.visible.shape()), [1, 6]);
    for (const value of values(frame.visible)) assert.ok(value === 0 || value === 1);
    if (step === 0) continue;
    const hidden = reference.sampleFromHidden(reference.hiddenExpectation(previous, 0.85));
    const probabilities = reference.visibleExpectation(hidden, 0.85);
    previous = reference.sampleFrom(probabilities);
    assert.deepEqual(Array.from(frame.hidden.shape()), [1, 4]);
    assert.deepEqual(Array.from(frame.probabilities.shape()), [1, 6]);
    assert.deepEqual(values(frame.hidden), values(hidden));
    assert.deepEqual(values(frame.probabilities), values(probabilities));
    assert.deepEqual(values(frame.visible), values(previous));
    for (const value of values(frame.hidden)) assert.ok(value === 0 || value === 1);
    for (const value of values(frame.probabilities)) assert.ok(value >= 0 && value <= 1);
  }
  // Observing the frames must not consume any extra random numbers.
  assert.deepEqual(values(model.sample(1)), values(reference.sample(1)));
});

test('animated and one-shot sampling have identical endpoints and random state', () => {
  const initial = new DenseMatrix(2, 6, [0.2, 1, 0, 0.8, 0.5, 0.3, 1, 0.7, 0.1, 0, 0.5, 0.9]);
  const original = values(initial);
  for (const input of [undefined, initial]) {
    const animated = new RBM(6, 4, 23);
    const instant = new RBM(6, 4, 23);
    animated.learn(patterns(), 100);
    instant.learn(patterns(), 100);
    const frames = Array.from(animated.sampleSteps(30, 1.2, input));
    assert.deepEqual(Array.from(frames[0].visible.shape()), [input?.rows ?? 1, 6]);
    assert.deepEqual(values(frames.at(-1).visible), values(instant.sample(30, 1.2, input)));
    assert.deepEqual(values(animated.sample(5)), values(instant.sample(5)));
  }
  assert.deepEqual(values(initial), original);
});

test('sampling snapshots remain independent of later frames and model parameters', () => {
  const model = new RBM(6, 4, 39);
  const reference = new RBM(6, 4, 39);
  const weights = values(model.weights);
  const hiddenBias = Array.from(model.hiddenBias.values);
  const visibleBias = Array.from(model.visibleBias.values);
  const activations = Array.from(model.getHiddenUnitsGrid().values);
  const iterator = model.sampleSteps(8);
  const expected = Array.from(reference.sampleSteps(8));
  const first = iterator.next().value;
  first.visible.apply(() => 0.25);
  const second = iterator.next().value;
  assert.deepEqual(values(second.visible), values(expected[1].visible), 'Editing a snapshot must not edit the chain');
  const snapshot = [values(second.visible), values(second.hidden), values(second.probabilities)];
  const remaining = Array.from(iterator);
  assert.deepEqual([values(second.visible), values(second.hidden), values(second.probabilities)], snapshot);
  assert.deepEqual(values(remaining.at(-1).visible), values(expected.at(-1).visible));
  remaining.at(-1).visible.apply(() => 0);
  remaining.at(-1).hidden.apply(() => 0);
  remaining.at(-1).probabilities.apply(() => 0);
  assert.deepEqual([values(second.visible), values(second.hidden), values(second.probabilities)], snapshot);
  assert.deepEqual(values(model.weights), weights);
  assert.deepEqual(Array.from(model.hiddenBias.values), hiddenBias);
  assert.deepEqual(Array.from(model.visibleBias.values), visibleBias);
  assert.deepEqual(Array.from(model.getHiddenUnitsGrid().values), activations);
});

test('completion clamps observed pixels in every frame and matches one-shot completion', () => {
  for (const mask of [
    [true, false, true, false, true, false],
    Array(6).fill(true),
    Array(6).fill(false),
  ]) {
    const animated = new RBM(6, 4, 67);
    const instant = new RBM(6, 4, 67);
    animated.learn(patterns(), 100);
    instant.learn(patterns(), 100);
    const input = patterns();
    const original = values(input);
    const weights = values(animated.weights);
    const frames = Array.from(animated.completeSteps(input, mask, 15));
    assert.equal(frames.length, 16);
    assert.equal(frames[0].hidden, null);
    assert.equal(frames[0].probabilities, null);
    for (const [step, frame] of frames.entries()) {
      assert.equal(frame.step, step);
      assert.deepEqual(Array.from(frame.visible.shape()), [4, 6]);
      if (step > 0) {
        assert.deepEqual(Array.from(frame.hidden.shape()), [4, 4]);
        assert.deepEqual(Array.from(frame.probabilities.shape()), [4, 6]);
      }
      for (let row = 0; row < input.rows; row++) {
        for (let col = 0; col < input.cols; col++) {
          const pixel = frame.visible.get(row, col);
          assert.ok(pixel === 0 || pixel === 1);
          if (mask[col]) assert.equal(pixel, input.get(row, col));
        }
      }
    }
    assert.deepEqual(values(frames.at(-1).visible), values(instant.complete(input, mask, 15)));
    assert.deepEqual(values(animated.sample(5)), values(instant.sample(5)));
    assert.deepEqual(values(input), original);
    assert.deepEqual(values(animated.weights), weights);
    const first = values(frames[0].visible);
    frames.at(-1).visible.apply(() => 0.25);
    assert.deepEqual(values(frames[0].visible), first);
  }
});

test('stepwise sampling rejects invalid settings before producing a frame', () => {
  const model = new RBM(6, 4, 42);
  for (const steps of [0, -1, 1.5, Infinity, NaN]) {
    assert.throws(() => model.sampleSteps(steps).next(), /positive integer/);
    assert.throws(() => model.completeSteps(patterns(), Array(6).fill(false), steps).next(), /positive integer/);
  }
  for (const temperature of [0, -1, Infinity, NaN]) {
    assert.throws(() => model.sampleSteps(10, temperature).next(), /greater than zero/);
  }
  assert.throws(() => model.sampleSteps(10, 1, DenseMatrix.zeros(1, 5)).next(), /6 columns/);
  assert.throws(() => model.completeSteps(patterns(), [true], 10).next(), /one boolean per visible pixel/);
  assert.throws(() => model.completeSteps(patterns(), Array(6).fill(1), 10).next(), /one boolean per visible pixel/);
});
