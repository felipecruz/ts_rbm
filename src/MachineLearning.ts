/// <reference path="LinearAlgebra.ts" />

module MachineLearning {
  function sigmoid(x: number) {
    return 1 / (1 + Math.exp(-x))
  }

  function norm(v: LinearAlgebra.Vector): number {
    var s = 0;

    for (var i = 0; i < v.size; i++) {
      s += v.get(i) * v.get(i)
    }

    return Math.sqrt(s)
  }

  export class RBM {
    weights: LinearAlgebra.Matrix
    hiddenBias: LinearAlgebra.Vector
    visibleBias: LinearAlgebra.Vector

    constructor(v: number, h: number) {
      this.weights = LinearAlgebra.DenseMatrix.random(v, h)
      this.hiddenBias = LinearAlgebra.DenseVector.zeros(h)
      this.visibleBias = LinearAlgebra.DenseVector.zeros(v)
    }

    hiddenExpectation(x: LinearAlgebra.Matrix): LinearAlgebra.Matrix {
      var m = LinearAlgebra.matrixMultiplication(x, this.weights)
      m.irowSum(this.hiddenBias)
      m.apply(sigmoid)
      return m
    }

    visibleExpectation(h: LinearAlgebra.Matrix): LinearAlgebra.Matrix {
      var m = LinearAlgebra.matrixMultiplication(h, this.weights.transpose())
      m.irowSum(this.visibleBias)
      m.apply(sigmoid)
      return m
    }

    sampleFromHidden(h: LinearAlgebra.Matrix): LinearAlgebra.Matrix {
      return h.copy().apply((n: number) => {
        if (Math.random() < n) {
          return 1
        } else {
          return 0
        }
      })
    }

    sampleFrom(v: LinearAlgebra.Matrix): LinearAlgebra.Matrix {
      var _v = v.copy()

      _v.apply((n: number) => {
        if (Math.random() < n) {
          return 1
        } else {
          return 0
        }
      })

      return _v
    }

    gradient(x: LinearAlgebra.Matrix): Array<LinearAlgebra.Matrix> {
      var v0 = x
      var h0 = this.hiddenExpectation(v0)
      var v1 = this.visibleExpectation(this.sampleFromHidden(h0))
      var h1 = this.hiddenExpectation(v1)

      return [v0, h0, v1, h1]
    }


    expectedValues(gradients: Array<LinearAlgebra.Matrix>): Array<any> {
      var current_w = LinearAlgebra.DenseMatrix.zeros(this.weights.rows,
                                                      this.weights.cols)
      var current_h = LinearAlgebra.DenseVector.zeros(this.weights.cols)
      var current_v = LinearAlgebra.DenseVector.zeros(this.weights.rows)

      var v0 = gradients[0]
      var h0 = gradients[1]
      var v1 = gradients[2]
      var h1 = gradients[3]

      for (var i = 0; i < v0.rows; i++) {
        var a = v0.row(i).copy().isub(v1.row(i))
        var b = h0.row(i).copy().isub(h1.row(i))
        var c = v0.row(i).outer(h0.row(i)).copy().isub(v1.row(i).outer(h1.row(i)))

        current_v = current_v.isum(a)
        current_h = current_h.isum(b)
        current_w = current_w.isum(c)
      }


      current_w.apply((n: number) => {
        return n / v0.rows
      })

      current_v.apply((n: number) => {
        return n / v0.rows
      })

      current_h.apply((n: number) => {
        return n / v0.rows
      })

      return [current_w, current_v, current_h]
    }

    runEpoch(x: LinearAlgebra.Matrix): void {
      var gradients = this.gradient(x)
      var v0 = gradients[0]
      var h0 = gradients[1]
      var v1 = gradients[2]
      var h1 = gradients[3]
      var expectedValues = this.expectedValues([v0, h0, v1, h1])
      var e_w: LinearAlgebra.Matrix = expectedValues[0]
      var e_v: LinearAlgebra.Vector = expectedValues[1]
      var e_h: LinearAlgebra.Vector = expectedValues[2]

      console.log(norm(e_v))

      e_v.apply((n: number) => n * 0.09)
      e_h.apply((n: number) => n * 0.09)
      e_w.apply((n: number) => n * 0.09)

      this.weights.isum(e_w)
      this.hiddenBias.isum(e_h)
      this.visibleBias.isum(e_v)
    }

    learn(dataset: LinearAlgebra.Matrix, epochs: number) {
      for (var i = 0; i < epochs; i++) {
        this.runEpoch(dataset)
      }
    }

    reconstruct(x: LinearAlgebra.Matrix): LinearAlgebra.Matrix {
      var gradients = this.gradient(x)
      var _v = gradients[2]
      return this.sampleFrom(_v)
    }
  }
}
