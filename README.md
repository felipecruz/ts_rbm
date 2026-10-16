# A little machine for imagination

An interactive essay about generative models, with a restricted Boltzmann machine (RBM) written from scratch in TypeScript. Draw binary pixel patterns, teach the machine their recurring structure, and watch it reconstruct, complete, and generate patterns of its own.

The essay and experiment run locally in your browser. Training data and model weights stay on your device; there is no server-side model, account, API key, or external ML library.

Read the live essay: **[A little machine for imagination](https://felipecruz.github.io/ts_rbm/)**.

## Run locally

Install [Node.js](https://nodejs.org/) 18 or newer, then:

```sh
npm install
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The development command builds the TypeScript and serves the page. After changing TypeScript, run `npm run build` and refresh the browser. HTML, CSS, and JavaScript edits only need a refresh. Set `PORT` to choose a different preview port.

```sh
npm run build   # Compile the model, validate equations, and prepare local math assets
npm test        # Run the original algebra suite, RBM behavior, and math rendering tests
```

`make`, `make dev`, and `make test` are aliases for these commands. The project uses TypeScript and a pinned [KaTeX](https://katex.org/) dependency; the local server and test runner use Node's standard library.

The essay introduces its equations alongside the ideas they describe. LaTeX lives in `data-tex` attributes, with readable text inside each element as a fallback. `npm run build` checks every equation and copies KaTeX's script, styles, and fonts to `assets/vendor/katex/`, so rendering does not depend on a math CDN. KaTeX supplies both visual HTML and accessible MathML. These generated assets are ignored by Git; include them alongside `index.html`, `run.js`, and `assets/` when publishing the built page. Rebuild after changing equations to check their syntax.

## Publish to GitHub Pages

The repository uses GitHub Actions to publish the tutorial at [felipecruz.github.io/ts_rbm/](https://felipecruz.github.io/ts_rbm/). A separate personal Pages repository is not required.

Every push to `main` installs the locked dependencies, runs the tests, builds the model and math assets, and deploys the resulting website. You can also run **Deploy tutorial to GitHub Pages** manually from the repository's Actions tab. In **Settings → Pages**, the publishing source is **GitHub Actions**.

Run `npm run build:site` to prepare the same website locally in `_site/`. The deployment contains only the essay, browser scripts, styles, and bundled KaTeX assets. Generated files stay out of Git.

## The experiment

Each image is a 15 × 15 grid: 225 visible units that can be on or off. A smaller layer of hidden units learns relationships between those pixels. Training uses one-step contrastive divergence (CD-1) and seeded pseudorandom sampling.

- **Train:** choose a collection of examples or add your own drawing, then watch reconstruction error change.
- **Restore:** select an example, hide its right half, and let the model fill in missing pixels while preserving the left half.
- **Generate:** start from random pixels and alternate between hidden and visible units to produce samples from the learned distribution. Temperature changes how random those samples are.
- **Inspect:** select a hidden unit to see its learned positive and negative pixel weights.

Restore displays the final completion immediately in the large preview, while a highlighted live frame in the trace plays its recorded evolution. The completed image stays fixed during playback, stepping, and replay. Generation continues to animate in the large preview.

Generation and restoration play the model's actual Gibbs-sampling chain: initial noise followed by 100 visible → hidden → visible updates. Pause, advance one step, or change playback speed to inspect the process. The filmstrip retains steps 0, 1, 10, and 100; Replay shows the exact same recorded chain. Starting a new sample draws a new chain. Changing the dataset, training settings, or mode cancels the current playback. Reduced-motion preferences start playback paused, with manual stepping available.

Generated images are not labels or guaranteed new designs. With a small dataset, a small model often reproduces familiar patterns, combines fragments, or produces noise. That limitation is part of the experiment: a generative model learns a distribution from examples, and sampling explores what it has learned.

The error chart reports mean squared reconstruction error per pixel. It is a useful training signal, not a measure of originality or a complete assessment of generative quality.

## Project structure

- `index.html` — the essay and embedded experiment.
- `src/LinearAlgebra.ts` — vectors, matrices, and arithmetic.
- `src/MachineLearning.ts` — RBM training, expectations, and sampling.
- `run.ts` — equally weighted 15 × 15 shape, letter, and stripe datasets.
- `assets/app.js` — drawing, training controls, visualizations, and model interaction.
- `assets/style.css` — responsive editorial layout and experiment styling.
- `assets/math.js` — accessible LaTeX rendering and updates for interactive equations.
- `assets/tutorial.js` — the illustrative evidence-to-probability slider, separate from the trained model.
- `tests/` — the original tsUnit linear algebra tests.
- `scripts/test.mjs` — temporary compilation and Node tests for probability ranges, learning, reproducibility, generation, and completion.
- `scripts/serve.mjs` — a dependency-free local static server.
- `scripts/build-math.mjs` — formula validation and local KaTeX asset preparation.
- `scripts/build-site.mjs` — packages the static website for GitHub Pages.
- `.github/workflows/deploy-pages.yml` — tests, builds, and publishes pushes to `main`.

No generated test files are left in the repository. `run.js` is a build artifact and can be regenerated with `npm run build`.

## Credits

Original TypeScript RBM and linear algebra implementation by Felipe Cruz. Licensed under BSD-2-Clause.
