(() => {
  'use strict';

  const fallbacks = new WeakMap();
  let warnedUnavailable = false;

  function render(element) {
    if (!fallbacks.has(element)) fallbacks.set(element, element.textContent);
    if (!window.katex) {
      if (!warnedUnavailable) {
        console.warn('[Generative AI intuition] Math rendering is unavailable; the written formulas remain readable. Run npm run build to prepare the local math assets.');
        warnedUnavailable = true;
      }
      return;
    }
    try {
      // Render before replacing the fallback, so even an unexpected error leaves it intact.
      const rendered = window.katex.renderToString(window.I18n ? window.I18n.tex(element.dataset.tex) : element.dataset.tex, {
        displayMode: element.dataset.display === 'true',
        output: 'htmlAndMathml',
        throwOnError: true,
        strict: 'error',
        trust: false,
      });
      element.innerHTML = rendered;
    } catch (error) {
      element.textContent = fallbacks.get(element);
      console.warn('[Generative AI intuition] A formula could not render; its written explanation is shown.', error);
    }
  }

  for (const element of document.querySelectorAll('[data-tex]')) render(element);
  document.addEventListener('math:update', event => {
    if (event.target.matches?.('[data-tex]')) render(event.target);
  });
})();
