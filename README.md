# Generative AI intuition

How does a model learn from examples—and then make something of its own?

This interactive tutorial explores that question with a small **restricted Boltzmann machine (RBM)**, written from scratch in TypeScript. Teach it simple 15 × 15 pixel patterns, inspect what it learns, and watch random noise evolve into a sample. Everything runs in your browser.

**[Read the tutorial →](https://felipecruz.github.io/ts_rbm/)** · English and Brazilian Portuguese, selectable in the page or with `?lang=en` and `?lang=pt-BR`.

## What you’ll learn

- **Learning a distribution:** examples teach the model which combinations of pixels tend to occur together.
- **Hidden units as evidence:** positive and negative weights show how pixels influence a hidden unit, and how hidden units influence pixels in return.
- **Generation through sampling:** follow the actual steps from random pixels to a pattern, pausing and stepping through the model’s predictions.
- **Completion from context:** keep part of an image fixed and let the same model imagine the missing pixels.

The tutorial starts with intuition, then introduces equations as a precise way to express each idea. The embedded pattern laboratory lets you test those ideas with shapes, letters, stripes, or your own drawings.

A small model may reproduce an example, blend familiar features, or produce noise. Seeing those outcomes helps explain what learning a distribution means—and why generating a sample does not guarantee an original design.

## A little TypeScript, a whole generative loop

At the heart of [ts_rbm](src/MachineLearning.ts), generation alternates between two layers: sample hidden units from the current pixels, then sample new pixels from those hidden units.

```ts
// One step inside RBM.sampleSteps(): visible → hidden → visible.
const hidden = this.sampleFromHidden(
  this.hiddenExpectation(visible, temperature)
)
const probabilities = this.visibleExpectation(hidden, temperature)
visible = this.sampleFrom(probabilities)
```

Repeat that step, starting from random pixels, and you get the chain shown in the tutorial. Training changes the weights behind these probabilities; sampling explores what those weights have learned.

## Try it locally

With Node.js 18 or newer:

```sh
npm install
npm run dev
```

Open [localhost:4173](http://127.0.0.1:4173). Use `npm test` to run the tests.

Original TypeScript RBM and linear algebra implementation by Felipe Cruz. Licensed under BSD-2-Clause.
