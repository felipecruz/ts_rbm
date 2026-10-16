'use strict';

// A single illustrative unit makes the sigmoid tangible without touching the RBM.
(() => {
  const slider = document.getElementById('evidenceSlider');
  const equation = document.getElementById('evidenceEquation');
  const evidence = document.getElementById('evidenceValue');
  const probability = document.getElementById('probabilityValue');
  const meter = document.getElementById('probabilityMeter');
  const fill = document.getElementById('probabilityFill');

  function updateEvidence() {
    const z = Number(slider.value);
    const p = 1 / (1 + Math.exp(-z));
    const signed = `${z > 0 ? '+' : ''}${z.toFixed(1)}`;
    const percent = (p * 100).toFixed(1);
    evidence.value = signed;
    probability.textContent = `${percent}%`;
    meter.setAttribute('aria-valuenow', percent);
    fill.style.width = `${percent}%`;
    slider.setAttribute('aria-valuetext', `Total evidence ${signed}; ${percent} percent chance of being on`);
    equation.dataset.tex = `\\sigma(${z.toFixed(1)})\\approx${p.toFixed(3)}`;
    // Keep a current plain-language fallback even if KaTeX is unavailable.
    equation.textContent = `Sigmoid(${z.toFixed(1)}) is approximately ${p.toFixed(3)}.`;
    equation.dispatchEvent(new Event('math:update', { bubbles: true }));
  }

  slider.addEventListener('input', updateEvidence);
  updateEvidence();
})();
