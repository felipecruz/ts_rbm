compile:
	tsc --out run.js src/LinearAlgebra.ts src/MachineLearning.ts run.ts && node run.js

test:
	tsc --out tests/test.js \
	    src/LinearAlgebra.ts src/MachineLearning.ts \
			tests/*.ts && clear && node tests/test.js
