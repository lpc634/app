// Guard against duplicate customElements.define that some third-party bundles register
// Must be imported BEFORE any other imports that might define custom elements
(function () {
  try {
    if (typeof window === 'undefined') return;
    if (!('customElements' in window)) return;
    var ce = window.customElements;
    if (!ce || typeof ce.define !== 'function' || typeof ce.get !== 'function') return;
    var originalDefine = ce.define.bind(ce);
    ce.define = function (name, constructor, options) {
      try {
        if (ce.get(name)) return;
        originalDefine(name, constructor, options);
      } catch (err) {
        var msg = err && err.message ? String(err.message) : '';
        if (!msg.includes('has already been defined')) {
          throw err;
        }
      }
    };
  } catch (_) {
    // swallow; this is a defensive guard
  }
})();


