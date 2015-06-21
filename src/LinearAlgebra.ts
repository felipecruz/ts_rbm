module LinearAlgebra {
  export interface Vector {
    values: Array<number>
    size: number

    get(pos: number): number
    set(pos: number, value:number): void
    copy(): Vector

    eq(v: Vector): boolean

    inner(v: Vector): number
    outer(v: Vector): Matrix

    apply(f: ((n: number) => any)): Vector
    iapply(f: ((i: number, n: number) => any)): Vector
    applyVec(v: Vector, f: (a: number, b: number) => any): Vector

    isum(v: Vector): Vector
    isub(v: Vector): Vector
    imul(v: Vector): Vector
    idiv(v: Vector): Vector

    str(): string
    print(): void
  }

  export interface Matrix {
    cols: number
    rows: number
    size: number

    eq(m: Matrix): boolean
    get(r: number, c:number): number
    set(r: number, c:number, val: number): void
    row(r: number): Vector
    col(c: number): Vector
    copy(): Matrix
    array(): Array<number>
    shape(): Array<number>
    transpose(): Matrix

    apply(f: ((n: number) => any)): Matrix
    iApply(f: ((i: number, j: number, n: number) => any)): Matrix
    isum(m: Matrix): Matrix
    isub(m: Matrix): Matrix
    imul(m: Matrix): Matrix
    idiv(m: Matrix): Matrix

    irowSum(v: Vector): Matrix

    str(): string
    strShape(i: number, j: number): string

    print(): void
    printShape(r: number, c: number): void
  }

  export class DenseVector implements Vector {
    values: Array<number>
    size: number

    constructor(values?: Array<number>) {
      this.size = values.length

      if (values) {
        this.values = values
      } else {
        if (this.size) {
          this.values = new Array<number>(this.size)
        } else{
          this.values = new Array<number>()
        }
      }
    }

    get(pos: number): number {
      return this.values[pos]
    }

    set(pos: number, value: number) {
      this.values[pos] = value
    }

    eq(v: Vector) {
      for (var i = 0; i < this.size; i++) {
        if (this.get(i) != v.get(i)) return false
      }
      return true
    }

    copy(): Vector {
      return new DenseVector(this.values.slice(0))
    }

    outer(v: Vector): Matrix {
      var r = this.values.length
      var c = v.size

      var numbers = []
      for (var i = 0; i < r; i++) {
        for (var j = 0; j < c; j++) {
          numbers[(i * c) + j] = this.values[i] * v.get(j)
        }
      }
      return new DenseMatrix(r, c, numbers)
    }

    inner(v: DenseVector) {
      var val = 0;

      if (this.values.length != v.values.length) {
        return -1;
      }

      for (var i = 0; i < this.values.length; i++) {
        val += this.values[i] * v.values[i]
      }

      return val
    }

    apply(f: ((n: number) => number)): Vector {
      for (var i = 0; i < this.values.length; i++) {
        this.set(i, f(this.get(i)))
      }
      return this
    }

    iapply(f: ((i: number, n: number) => number)): Vector {
      for (var i = 0; i < this.values.length; i++) {
        this.set(i, f(i, this.get(i)))
      }
      return this
    }

    applyVec(v: Vector, f: ((a: number, b: number) => any)): Vector {
      for (var i = 0; i < this.values.length; i++) {
        this.set(i, f(this.get(i), v.get(i)))
      }
      return this
    }

    isum(v: Vector): Vector {
      var sum = (a: number, b: number) => a + b
      return this.applyVec(v, sum)
    }

    isub(v: Vector): Vector {
      var sub = (a: number, b: number) => a - b
      return this.applyVec(v, sub)
    }

    imul(v: Vector): Vector {
      var mul = (a: number, b: number) => a * b
      return this.applyVec(v, mul)
    }

    idiv(v: Vector): Vector {
      var div = (a: number, b: number) => a / b
      return this.applyVec(v, div)
    }

    str(): string {
      var str = ""
      for (var j = 0; j < this.values.length; j++) {
        var s = " "
        if (j == 0) s = ""
        str += s + this.values[j]
      }
      return str
    }

    print(): void {
      console.log(this.str() + "\n")
    }

    static zeros(size: number): Vector {
      var v = []
      for (var i = 0; i < size; i++) {
        v.push(0)
      }
      return new DenseVector(v)
    }

    static random(size: number): Vector {
      var v = []
      for (var i = 0; i < size; i++) {
        v.push(Math.random())
      }
      return new DenseVector(v)
    }
  }

  export class DenseMatrix implements Matrix {
    val_rows: Array<DenseVector> = new Array<DenseVector>()
    size: number
    rows: number
    cols: number

    constructor(r: number,
                c: number,
                values: number[]) {
      this.rows = r
      this.cols = c
      this.size = r * c

      for (var i = 0; i < r; i++) {
        var v = new Array(c)
        for (var j = 0; j < c; j++) {
          v[j] = values[(i * c) + j]
        }
        this.val_rows[i] = new DenseVector(v)
      }
    }

    get(r: number, c:number) {
      return this.val_rows[r].get(c)
    }

    set(r: number, c: number, value: number) {
      this.val_rows[r].set(c, value)
    }

    eq(m: Matrix): boolean {
      for (var i = 0; i < this.rows; i++) {
        for (var j = 0; j < this.cols; j++) {
          if (this.get(i, j) != m.get(i, j)) {
            return false
          }
        }
      }
      return true
    }

    copy(): Matrix {
      var numbers = []
      for (var i = 0; i < this.rows; i++) {
        for (var j = 0; j < this.cols; j++) {
          numbers.push(this.get(i, j))
        }
      }
      return new DenseMatrix(this.rows, this.cols, numbers)
    }

    array(): Array<number> {
      var numbers = []
      for (var i = 0; i < this.rows; i++) {
        for (var j = 0; j < this.cols; j++) {
          numbers.push(this.get(i, j))
        }
      }
      return numbers
    }

    row(r: number): DenseVector {
      return this.val_rows[r]
    }

    col(c: number): DenseVector {
      var values = []
      for (var i = 0; i < this.val_rows.length; i++) {
        values.push(this.val_rows[i].get(c))
      }
      return new DenseVector(values)
    }

    shape(): Array<number> {
      return [this.rows, this.cols]
    }

    transpose(): DenseMatrix {
      var values = []

      for (var j = 0; j < this.cols; j++) {
        for (var i = 0; i < this.val_rows.length; i++) {
          values.push(this.val_rows[i].get(j))
        }
      }

      return new DenseMatrix(this.cols, this.rows, values)
    }

    apply(f: ((v: number) => number)): Matrix {
      for (var i = 0; i < this.val_rows.length; i++) {
        for (var j = 0; j < this.cols; j++) {
          this.set(i, j, f(this.get(i, j)))
        }
      }
      return this
    }

    iApply(f: ((i: number, j: number, v: number) => number)): Matrix {
      for (var i = 0; i < this.val_rows.length; i++) {
        for (var j = 0; j < this.cols; j++) {
          this.set(i, j, f(i, j, this.get(i, j)))
        }
      }
      return this
    }

    isum(m: Matrix): Matrix {
      var sum = (i: number, j: number, n: number) => n + m.get(i, j)
      return this.iApply(sum)
    }

    isub(m: Matrix): Matrix {
      var sub = (i: number, j: number, n: number) => n - m.get(i, j)
      return this.iApply(sub)
    }

    imul(m: Matrix): Matrix {
      var mul = (i: number, j: number, n: number) => n * m.get(i, j)
      return this.iApply(mul)
    }

    idiv(m: Matrix): Matrix {
      var div = (i: number, j: number, n: number) => n / m.get(i, j)
      return this.iApply(div)
    }

    irowSum(v: Vector): Matrix {
      var isum = (i: number, n: number) => n + v.get(i)
      for (var i = 0; i < this.val_rows.length; i++) {
        this.val_rows[i].iapply(isum)
      }
      return this
    }

    str(): string {
      var rows = this.val_rows.length;
      var cols = this.val_rows[0].size
      var str = ""

      for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
          var s = " "
          if (j == 0) s = ""
          str += s + this.val_rows[i].get(j)
        }
        if (i == rows-1 && j == cols) break
        str += "\n"
      }
      return str
    }

    strShape(r: number, c: number) {
      var rows = this.val_rows.length;
      var cols = this.val_rows[0].size
      var str = ""

      var numbers = []

      for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
          numbers.push(this.val_rows[i].get(j))
        }
      }

      for (var i = 0; i < r; i++) {
        for (var j = 0; j < c; j++) {
          var s = " "
          if (j == 0) s = ""
          str += s + numbers[(i * c) + j]
        }
        if (i == r-1 && j == c) break
        str += "\n"
      }
      return str
    }

    print() {
      console.log(this.str() + "\n")
    }

    printShape(i: number, j: number) {
      console.log(this.strShape(i, j) + "\n")
    }

    static random(r: number, c: number): Matrix {
      var numbers = new Array<number>()
      for (var i = 0; i < r * c; i++) {
        numbers[i] = Math.random()
      }
      return new DenseMatrix(r, c, numbers)
    }

    static zeros(r: number, c: number): Matrix {
      var numbers = new Array<number>()
      for (var i = 0; i < r * c; i++) {
        numbers[i] = 0
      }
      return new DenseMatrix(r, c, numbers)
    }
  }

  export function matrixMultiplication(m1: Matrix, m2: Matrix): Matrix {
    var rows = m1.rows
    var cols = m2.cols
    var result = DenseMatrix.zeros(rows, cols)

    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++) {
        var v1 = m1.row(i)
        var v2 = m2.col(j)
        result.set(i, j, v1.inner(v2))
      }
    }

    return result
  }

  export function matrixMean(matrices: Array<Matrix>) {
    var matrix: Matrix = matrices[0]
    var rows = matrix.rows
    var cols = matrix.cols
    var meanMatrix = DenseMatrix.zeros(rows, cols)

    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++) {
        for (var k = 0; k < matrices.length; k++) {
          var current = meanMatrix.get(i, j)
          meanMatrix.set(i, j, current + matrices[k].get(i, j))
        }
      }
    }

    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++) {
        var current = meanMatrix.get(i, j)
        meanMatrix.set(i, j, current / matrices.length)
      }
    }

    return meanMatrix
  }
}
