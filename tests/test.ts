var test = new tsUnit.Test(TestLinearAlgebra);
var testOutcome = test.run();
var result = test.getTapResults(testOutcome);
console.log(result);
if (testOutcome.passes.length === 0 || testOutcome.errors.length > 0) {
  throw new Error("Linear algebra tests failed or no tests were discovered.");
}
