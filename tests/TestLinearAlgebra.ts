/// <reference path="tsUnit.ts" />
/// <reference path="../src/LinearAlgebra.ts" />

module TestLinearAlgebra {
  export class TestVector extends tsUnit.TestClass {
    private baseVector: LinearAlgebra.Vector =
      new LinearAlgebra.DenseVector([1, 2, 3, 4, 5, 6])

    testDimension() {
      this.areIdentical(6, this.baseVector.size)
    }

    testGetSet() {
      var v = LinearAlgebra.DenseVector.zeros(4)
      v.set(0, 1)
      v.set(3, 4)
      this.areIdentical(1, v.get(0))
      this.areIdentical(4, v.get(3))
    }

    testEq() {
      var rand = LinearAlgebra.DenseVector.random(10)
      this.isTrue(this.baseVector.eq(this.baseVector))
      this.isTrue(rand.eq(rand))
    }

    testCopy() {
      var copy = this.baseVector.copy()
      this.areCollectionsIdentical(copy.values, this.baseVector.values)
    }

    testInner() {
      var a = new LinearAlgebra.DenseVector([1, 2, 3])
      var b = new LinearAlgebra.DenseVector([1, 2, 3])
      this.areIdentical(14, a.inner(b))

      a = new LinearAlgebra.DenseVector([-1, -2, -3])
      b = new LinearAlgebra.DenseVector([1, 2, 3])
      this.areIdentical(-14, a.inner(b))
    }

    testOuter() {
      var values =
        [1,  2,  3,  4,  5,  6,  7,  8,  9,
         2,  4,  6,  8, 10, 12, 14, 16, 18,
         3,  6,  9, 12, 15, 18, 21, 24, 27,
         4,  8, 12, 16, 20, 24, 28, 32, 36,
         5, 10, 15, 20, 25, 30, 35, 40, 45,
         6, 12, 18, 24, 30, 36, 42, 48, 54,
         7, 14, 21, 28, 35, 42, 49, 56, 63,
         8, 16, 24, 32, 40, 48, 56, 64, 72,
         9, 18, 27, 36, 45, 54, 63, 72, 81]

       var a = new LinearAlgebra.DenseVector(
         [1, 2, 3, 4, 5, 6, 7, 8, 9])
       var b = new LinearAlgebra.DenseVector(
         [1, 2, 3, 4, 5, 6, 7, 8, 9])

       this.areCollectionsIdentical(values, a.outer(b).array())
    }

    testApply() {
      var copy = this.baseVector.copy()
      copy.apply((n:number) => n * n)
      this.areCollectionsIdentical([1, 4, 9, 16, 25, 36],
                                   copy.values)
    }

    testIApply() {
      var copy = this.baseVector.copy()
      copy.iapply((i: number, n:number) => n * i)
      this.areCollectionsIdentical([0, 2, 6, 12, 20, 30],
                                   copy.values)
    }

    testApplyVec() {
      var copy = this.baseVector.copy()
      var other = copy.copy()

      copy.applyVec(other, (a:number, b:number) => a - b)

      this.areCollectionsIdentical(
        [0, 0, 0, 0, 0, 0], copy.values)
    }

    testIFuncs() {
      var copy = this.baseVector.copy()

      var other1 = copy.copy()
      var other2 = copy.copy()
      var other3 = copy.copy()
      var other4 = copy.copy()

      other1.isum(copy)
      this.areCollectionsIdentical(
        [2, 4, 6, 8, 10, 12], other1.values)

      other2.isub(copy)
      this.areCollectionsIdentical(
        [0, 0, 0, 0, 0, 0], other2.values)

      other3.imul(copy)
      this.areCollectionsIdentical(
        [1, 4, 9, 16, 25, 36], other3.values)

      other4.idiv(copy)
      this.areCollectionsIdentical(
        [1, 1, 1, 1, 1, 1], other4.values)
    }

    testStr() {
      this.areIdentical("1 2 3 4 5 6", this.baseVector.str())
    }

    testZeros() {
      this.areCollectionsIdentical([0, 0, 0],
        LinearAlgebra.DenseVector.zeros(3).values)
    }

    testRandom() {
      var v = LinearAlgebra.DenseVector.random(3)
      v.apply((n: number) => n > 0)
      this.areCollectionsIdentical([true, true, true], v.values)
    }
  }

  export class LinearAlgebraTests extends tsUnit.TestClass {
    private baseMatrix: LinearAlgebra.Matrix =
      new LinearAlgebra.DenseMatrix(3, 3, [1, 2, 3, 4, 5, 6, 7, 8, 9])

    testDimensionProperties() {
      this.areIdentical(9, this.baseMatrix.size)
      this.areIdentical(3, this.baseMatrix.rows)
      this.areIdentical(3, this.baseMatrix.cols)
      this.areCollectionsIdentical([3, 3], this.baseMatrix.shape())
    }

    testEq() {
      var different = LinearAlgebra.DenseMatrix.random(3, 3)
      var equal = this.baseMatrix.copy()

      this.isTrue(this.baseMatrix.eq(equal))
      this.isTrue(!this.baseMatrix.eq(different))
    }

    testGet() {
      this.areIdentical(1, this.baseMatrix.get(0, 0))
      this.areIdentical(2, this.baseMatrix.get(0, 1))
      this.areIdentical(3, this.baseMatrix.get(0, 2))
      this.areIdentical(4, this.baseMatrix.get(1, 0))
      this.areIdentical(5, this.baseMatrix.get(1, 1))
      this.areIdentical(6, this.baseMatrix.get(1, 2))
      this.areIdentical(7, this.baseMatrix.get(2, 0))
      this.areIdentical(8, this.baseMatrix.get(2, 1))
      this.areIdentical(9, this.baseMatrix.get(2, 2))
    }

    testGetSet() {
      var v = LinearAlgebra.DenseMatrix.zeros(2, 2)
      v.set(0, 0, 10)
      this.areIdentical(10, v.get(0, 0))
    }

    testArray() {
      var expected = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      this.areCollectionsIdentical(expected, this.baseMatrix.array())
    }

    testCopy() {
      var v = LinearAlgebra.DenseMatrix.random(2, 2)
      var copy = v.copy()
      for (var i = 0; i < v.rows; i++) {
        for (var j = 0; j < v.rows; j++) {
          this.areIdentical(copy.get(i, j), v.get(i, j))
        }
      }
    }

    testColRow() {
      this.areCollectionsIdentical([1, 2, 3], this.baseMatrix.row(0).values)
      this.areCollectionsIdentical([4, 5, 6], this.baseMatrix.row(1).values)
      this.areCollectionsIdentical([7, 8, 9], this.baseMatrix.row(2).values)
      this.areCollectionsIdentical([1, 4, 7], this.baseMatrix.col(0).values)
      this.areCollectionsIdentical([2, 5, 8], this.baseMatrix.col(1).values)
      this.areCollectionsIdentical([3, 6, 9], this.baseMatrix.col(2).values)
    }

    testTranspose() {
      var t = this.baseMatrix.transpose()

      this.areCollectionsIdentical([1, 2, 3], t.col(0).values)
      this.areCollectionsIdentical([4, 5, 6], t.col(1).values)
      this.areCollectionsIdentical([7, 8, 9], t.col(2).values)
      this.areCollectionsIdentical([1, 4, 7], t.row(0).values)
      this.areCollectionsIdentical([2, 5, 8], t.row(1).values)
      this.areCollectionsIdentical([3, 6, 9], t.row(2).values)
    }

    testApply() {
      var a = this.baseMatrix.copy()
      var expected = [1, 1, 1, 1, 1, 1, 1, 1, 1]

      this.areCollectionsIdentical(expected,
                                   a.apply((n: number) => n / n).array())
    }

    testIsum() {
      var expected = [2, 3, 4, 5, 6, 7, 8, 9, 10]
      var m = this.baseMatrix.copy()
      m.isum(new LinearAlgebra.DenseMatrix(3, 3,
        [1, 1, 1, 1, 1, 1, 1, 1, 1]))
      this.areCollectionsIdentical(expected, m.array())
    }

    testIsub() {
      var expected = [0, 0, 0, 0, 0, 0, 0, 0, 0]
      var m = this.baseMatrix.copy()
      m.isub(this.baseMatrix.copy())
      this.areCollectionsIdentical(expected, m.array())
    }

    testMul() {
      var expected = [1,4, 9, 16, 25, 36, 49, 64, 81]
      var m = this.baseMatrix.copy()
      m.imul(this.baseMatrix.copy())
      this.areCollectionsIdentical(expected, m.array())
    }

    testDiv() {
      var expected = [1, 1, 1, 1, 1, 1, 1, 1, 1]
      var m = this.baseMatrix.copy()
      m.idiv(this.baseMatrix.copy())
      this.areCollectionsIdentical(expected, m.array())
    }

    testIRowSum() {
      var expected = [2, 4, 6, 5, 7, 9, 8, 10, 12]
      var m = this.baseMatrix.copy()
      m.irowSum(new LinearAlgebra.DenseVector([1, 2, 3]))
      this.areCollectionsIdentical(expected, m.array())
    }

    testStr() {
      var expected =
      "1 2 3\n4 5 6\n7 8 9"

      this.areIdentical(expected, this.baseMatrix.str())
    }

    testStrShape() {
      var expected =
      "1 2\n3 4\n5 6"

      var m = new LinearAlgebra.DenseMatrix(2, 3, [
        1, 2, 3, 4, 5, 6
      ])

      this.areIdentical(expected, this.baseMatrix.strShape(3, 2))
    }

    testRandom() {
      var r = LinearAlgebra.DenseMatrix.random(2, 2)
      var m = r.apply((n: number) => n > 0)

      this.areCollectionsIdentical([true, true, true, true], m.array())
    }

    testZeros() {
      var r = LinearAlgebra.DenseMatrix.zeros(2, 2)
      var m = r.apply((n: number) => n == 0)

      this.areCollectionsIdentical([true, true, true, true], m.array())
    }

    testMatrixMultiplication() {
      var expected =
        [30,  36,  42,
         66,  81,  96,
        102, 126, 150]

      var matrix = LinearAlgebra.matrixMultiplication(
        this.baseMatrix.copy(), this.baseMatrix.copy())

      this.areCollectionsIdentical(expected, matrix.array())
    }

    testMatrixMean() {
      var a1 = this.baseMatrix.copy()
      var a2 = this.baseMatrix.copy()
      var a3 = this.baseMatrix.copy()

      var ms = [a1, a2, a3]

      var expected = [1, 2, 3, 4, 5, 6, 7, 8, 9]

      this.areCollectionsIdentical(expected,
        LinearAlgebra.matrixMean(ms).array())
    }
  }
}
