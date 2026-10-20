'use strict';

(() => {
  const messages = globalThis.PORTUGUESE_MESSAGES || {};
  function resolveLanguage(value) {
    return ['pt', 'pt-br'].includes(String(value || '').toLowerCase()) ? 'pt-BR' : 'en';
  }
  const language = resolveLanguage(new URLSearchParams(globalThis.location?.search || '').get('lang'));
  const locale = language === 'pt-BR' ? 'pt-BR' : 'en-US';

  // Tagged templates keep variable values separate from the translated sentence.
  function t(text, ...values) {
    if (Array.isArray(text)) {
      const key = text.reduce((result, part, index) => result + (index ? `{${index - 1}}` : '') + part, '');
      const translated = language === 'pt-BR' ? messages[key] ?? key : key;
      return translated.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)]));
    }
    const original = String(text);
    const key = original.trim();
    return language === 'pt-BR' && Object.hasOwn(messages, key)
      ? original.replace(key, () => messages[key]) : original;
  }

  function number(value, digits = 0) {
    return Number(value).toLocaleString(locale, {
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    });
  }

  function tex(source) {
    if (language !== 'pt-BR') return source;
    return source.replace(/\\mathrm\{examples\}/g, '\\text{exemplos}')
      .replace(/\\mathrm\{rebuilt\}/g, '\\text{reconstrução}')
      .replace(/\\mathrm\{on\}/g, '\\text{ligado}')
      .replace(/(\d)\.(?=\d)/g, '$1{,}');
  }

  function languageURL(href, selected) {
    const url = new URL(href);
    url.searchParams.set('lang', resolveLanguage(selected));
    return url.href;
  }

  function localizeDocument(document) {
    document.documentElement.lang = language;
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement.closest('script, style, [data-language-name]')) node.nodeValue = t(node.nodeValue);
    }
    document.querySelectorAll('[aria-label], [title], [placeholder], meta[name="description"]').forEach(element => {
      for (const attribute of ['aria-label', 'title', 'placeholder', 'content']) {
        if (element.hasAttribute(attribute)) element.setAttribute(attribute, t(element.getAttribute(attribute)));
      }
    });
    const selector = document.getElementById('languageSelect');
    selector.value = language;
    selector.addEventListener('change', () => {
      // A normal navigation gives a translated fresh experiment, with its section and other params intact.
      globalThis.location.assign(languageURL(globalThis.location.href, selector.value));
    });
  }

  globalThis.I18n = Object.freeze({ language, locale, t, number, tex, resolveLanguage, languageURL, localizeDocument });
  if (typeof document !== 'undefined') localizeDocument(document);
})();
