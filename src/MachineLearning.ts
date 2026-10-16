/// <reference path="LinearAlgebra.ts" />

module MachineLearning {
  export interface SamplingFrame {
    step: number
    visible: LinearAlgebra.Matrix
    hidden: LinearAlgebra.Matrix | null
    probabilities: LinearAlgebra.Matrix | null
  }

  function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x))
  }

  export class RBM {
    weights: LinearAlgebra.Matrix
    hiddenBias: LinearAlgebra.Vector
    visibleBias: LinearAlgebra.Vector
    learningRate: number = 0.12

    private randomState: number
    private lastHidden: LinearAlgebra.Vector

    constructor(v: number, h: number, seed: number = 42) {
      if (!Number.isInteger(v) || v < 1 || !Number.isInteger(h) || h < 1) {
        throw new Error("An RBM needs positive integer visible and hidden unit counts.")
      }
      if (!Number.isFinite(seed)) {
        throw new Error("The random seed must be finite.")
      }
      this.randomState = (seed | 0) || 1
      this.weights = LinearAlgebra.DenseMatrix.zeros(v, h)
      // Centered, small initial weights avoid saturating sigmoid activations.
      this.weights.apply(() => (this.random() - 0.5) * 0.1)
      this.hiddenBias = LinearAlgebra.DenseVector.zeros(h)
      this.visibleBias = LinearAlgebra.DenseVector.zeros(v)
      this.lastHidden = LinearAlgebra.DenseVector.zeros(h)
    }

    private random(): number {
      // A local xorshift32 generator makes a full experiment reproducible.
      let x = this.randomState
      x ^= x << 13
      x ^= x >>> 17
      x ^= x << 5
      this.randomState = x | 0
      return (x >>> 0) / 4294967296
    }

    private validateInput(x: LinearAlgebra.Matrix, columns: number): void {
      if (x.cols !== columns || !Number.isInteger(x.rows) || x.rows < 1) {
        throw new Error("Input must contain at least one row and " + columns + " columns.")
      }
      for (let r = 0; r < x.rows; r++) {
        const values = x.row(r).values
        for (let c = 0; c < columns; c++) {
          if (!Number.isFinite(values[c]) || values[c] < 0 || values[c] > 1) {
            throw new Error("Visible and hidden values must be probabilities between 0 and 1.")
          }
        }
      }
    }

    private validateSteps(steps: number): void {
      if (!Number.isInteger(steps) || steps < 1) {
        throw new Error("The number of sampling steps must be a positive integer.")
      }
    }

    private validateTemperature(temperature: number): void {
      if (!Number.isFinite(temperature) || temperature <= 0) {
        throw new Error("Sampling temperature must be greater than zero.")
      }
    }

    hiddenExpectation(x: LinearAlgebra.Matrix, temperature: number = 1): LinearAlgebra.Matrix {
      this.validateInput(x, this.weights.rows)
      this.validateTemperature(temperature)
      const result = LinearAlgebra.DenseMatrix.zeros(x.rows, this.weights.cols)
      const bias = this.hiddenBias.values
      const visibleCount = this.weights.rows
      const hiddenCount = this.weights.cols
      for (let r = 0; r < x.rows; r++) {
        const input = x.row(r).values
        const output = result.row(r).values
        for (let j = 0; j < hiddenCount; j++) output[j] = bias[j]
        for (let i = 0; i < visibleCount; i++) {
          const value = input[i]
          if (value === 0) continue
          const weights = this.weights.row(i).values
          for (let j = 0; j < hiddenCount; j++) output[j] += value * weights[j]
        }
        for (let j = 0; j < hiddenCount; j++) output[j] = sigmoid(output[j] / temperature)
      }
      return result
    }

    visibleExpectation(h: LinearAlgebra.Matrix, temperature: number = 1): LinearAlgebra.Matrix {
      this.validateInput(h, this.weights.cols)
      this.validateTemperature(temperature)
      const result = LinearAlgebra.DenseMatrix.zeros(h.rows, this.weights.rows)
      const bias = this.visibleBias.values
      const visibleCount = this.weights.rows
      const hiddenCount = this.weights.cols
      for (let r = 0; r < h.rows; r++) {
        const input = h.row(r).values
        const output = result.row(r).values
        for (let i = 0; i < visibleCount; i++) {
          const weights = this.weights.row(i).values
          let logit = bias[i]
          for (let j = 0; j < hiddenCount; j++) logit += input[j] * weights[j]
          output[i] = sigmoid(logit / temperature)
        }
      }
      return result
    }

    sampleFromHidden(h: LinearAlgebra.Matrix): LinearAlgebra.Matrix {
      return this.sampleFrom(h)
    }

    sampleFrom(probabilities: LinearAlgebra.Matrix): LinearAlgebra.Matrix {
      this.validateInput(probabilities, probabilities.cols)
      return probabilities.copy().apply((p: number) => this.random() < p ? 1 : 0)
    }

    // CD-1: data -> hidden sample -> visible probabilities -> hidden probabilities.
    // Using visible probabilities in the negative phase reduces gradient variance.
    gradient(x: LinearAlgebra.Matrix): Array<LinearAlgebra.Matrix> {
      const h0 = this.hiddenExpectation(x)
      const v1 = this.visibleExpectation(this.sampleFromHidden(h0))
      const h1 = this.hiddenExpectation(v1)
      return [x, h0, v1, h1]
    }

    expectedValues(gradients: Array<LinearAlgebra.Matrix>): [LinearAlgebra.Matrix, LinearAlgebra.Vector, LinearAlgebra.Vector] {
      if (gradients.length !== 4) throw new Error("CD-1 requires four phase matrices.")
      const [v0, h0, v1, h1] = gradients
      const visibleCount = this.weights.rows
      const hiddenCount = this.weights.cols
      if (v0.rows < 1 || v0.cols !== visibleCount || v1.cols !== visibleCount ||
          h0.cols !== hiddenCount || h1.cols !== hiddenCount ||
          v0.rows !== v1.rows || v0.rows !== h0.rows || v0.rows !== h1.rows) {
        throw new Error("Contrastive-divergence matrices must match the model and batch size.")
      }
      const weightGradient = LinearAlgebra.DenseMatrix.zeros(visibleCount, hiddenCount)
      const visibleGradient = LinearAlgebra.DenseVector.zeros(visibleCount)
      const hiddenGradient = LinearAlgebra.DenseVector.zeros(hiddenCount)
      // Accumulate outer products directly, avoiding one temporary matrix per example.
      for (let r = 0; r < v0.rows; r++) {
        const data = v0.row(r).values
        const reconstruction = v1.row(r).values
        const positive = h0.row(r).values
        const negative = h1.row(r).values
        for (let j = 0; j < hiddenCount; j++) {
          hiddenGradient.values[j] += positive[j] - negative[j]
        }
        for (let i = 0; i < visibleCount; i++) {
          const row = weightGradient.row(i).values
          const original = data[i]
          const generated = reconstruction[i]
          visibleGradient.values[i] += original - generated
          for (let j = 0; j < hiddenCount; j++) {
            row[j] += original * positive[j] - generated * negative[j]
          }
        }
      }
      const scale = 1 / v0.rows
      weightGradient.apply((value: number) => value * scale)
      visibleGradient.apply((value: number) => value * scale)
      hiddenGradient.apply((value: number) => value * scale)
      return [weightGradient, visibleGradient, hiddenGradient]
    }

    runEpoch(x: LinearAlgebra.Matrix): { error: number, hiddenLayer: LinearAlgebra.Vector } {
      if (!Number.isFinite(this.learningRate) || this.learningRate <= 0) {
        throw new Error("The learning rate must be greater than zero.")
      }
      const gradients = this.gradient(x)
      const [weightGradient, visibleGradient, hiddenGradient] = this.expectedValues(gradients)
      const h0 = gradients[1]
      const v1 = gradients[2]
      const activations = LinearAlgebra.DenseVector.zeros(this.weights.cols)
      let squaredError = 0
      for (let r = 0; r < x.rows; r++) {
        for (let i = 0; i < x.cols; i++) {
          const residual = x.get(r, i) - v1.get(r, i)
          squaredError += residual * residual
        }
        for (let j = 0; j < h0.cols; j++) activations.values[j] += h0.get(r, j) / x.rows
      }
      const rate = this.learningRate
      this.weights.isum(weightGradient.apply((value: number) => value * rate))
      this.visibleBias.isum(visibleGradient.apply((value: number) => value * rate))
      this.hiddenBias.isum(hiddenGradient.apply((value: number) => value * rate))
      this.lastHidden = activations
      // Per-pixel MSE, measured before this epoch's update. It is not likelihood.
      return { error: squaredError / (x.rows * x.cols), hiddenLayer: activations.copy() }
    }

    learn(dataset: LinearAlgebra.Matrix, epochs: number): number[] {
      if (!Number.isInteger(epochs) || epochs < 0) throw new Error("Epochs must be a nonnegative integer.")
      const errors: number[] = []
      for (let i = 0; i < epochs; i++) errors.push(this.runEpoch(dataset).error)
      return errors
    }

    *ilearn(dataset: LinearAlgebra.Matrix, epochs: number): Iterator<{ error: number, hiddenLayer: LinearAlgebra.Vector }> {
      if (!Number.isInteger(epochs) || epochs < 0) throw new Error("Epochs must be a nonnegative integer.")
      for (let i = 0; i < epochs; i++) yield this.runEpoch(dataset)
    }

    reconstruct(x: LinearAlgebra.Matrix): LinearAlgebra.Matrix {
      return this.sampleFrom(this.gradient(x)[2])
    }

    // Alternate Bernoulli samples from both layers: a genuine Gibbs chain.
    // With no initial state, generation starts from independent fair coin flips.
    sample(steps: number = 60, temperature: number = 1, initial?: LinearAlgebra.Matrix): LinearAlgebra.Matrix {
      let visible!: LinearAlgebra.Matrix
      for (const frame of this.sampleSteps(steps, temperature, initial)) visible = frame.visible
      return visible
    }

    // Frame zero is the starting noise. Later frames expose the hidden sample
    // and visible probabilities used to produce that frame's visible sample.
    *sampleSteps(steps: number = 100, temperature: number = 1, initial?: LinearAlgebra.Matrix): IterableIterator<SamplingFrame> {
      this.validateSteps(steps)
      this.validateTemperature(temperature)
      let visible: LinearAlgebra.Matrix
      if (initial) {
        this.validateInput(initial, this.weights.rows)
        visible = this.sampleFrom(initial)
      } else {
        visible = LinearAlgebra.DenseMatrix.zeros(1, this.weights.rows)
        visible.apply(() => this.random() < 0.5 ? 1 : 0)
      }
      yield { step: 0, visible: visible.copy(), hidden: null, probabilities: null }
      for (let step = 1; step <= steps; step++) {
        const hidden = this.sampleFromHidden(this.hiddenExpectation(visible, temperature))
        const probabilities = this.visibleExpectation(hidden, temperature)
        visible = this.sampleFrom(probabilities)
        // Snapshots are detached from the chain, so an inspector can retain or
        // modify a frame without changing future samples.
        yield { step, visible: visible.copy(), hidden: hidden.copy(), probabilities: probabilities.copy() }
      }
    }

    // True mask entries are observed pixels, re-clamped after every Gibbs step.
    complete(input: LinearAlgebra.Matrix, mask: boolean[], steps: number = 40): LinearAlgebra.Matrix {
      let visible!: LinearAlgebra.Matrix
      for (const frame of this.completeSteps(input, mask, steps)) visible = frame.visible
      return visible
    }

    *completeSteps(input: LinearAlgebra.Matrix, mask: boolean[], steps: number = 100): IterableIterator<SamplingFrame> {
      this.validateInput(input, this.weights.rows)
      this.validateSteps(steps)
      if (mask.length !== this.weights.rows || mask.some(value => typeof value !== "boolean")) {
        throw new Error("The observation mask must have one boolean per visible pixel.")
      }
      const observed = input.copy()
      const observedMask = mask.slice()
      let visible = observed.copy()
      for (let r = 0; r < visible.rows; r++) {
        for (let i = 0; i < visible.cols; i++) {
          if (!observedMask[i]) visible.set(r, i, this.random() < 0.5 ? 1 : 0)
        }
      }
      yield { step: 0, visible: visible.copy(), hidden: null, probabilities: null }
      for (let step = 1; step <= steps; step++) {
        const hidden = this.sampleFromHidden(this.hiddenExpectation(visible))
        const probabilities = this.visibleExpectation(hidden)
        visible = this.sampleFrom(probabilities)
        for (let r = 0; r < visible.rows; r++) {
          for (let i = 0; i < visible.cols; i++) {
            if (observedMask[i]) visible.set(r, i, observed.get(r, i))
          }
        }
        yield { step, visible: visible.copy(), hidden: hidden.copy(), probabilities: probabilities.copy() }
      }
    }

    getHiddenUnitsGrid(): LinearAlgebra.Vector {
      return this.lastHidden.copy()
    }
  }
}
