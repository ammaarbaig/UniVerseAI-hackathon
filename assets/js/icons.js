/* UniVerse — assets/js/icons.js
   Inline Lucide icon markup (https://lucide.dev, ISC licence) for the icons
   that chat-ui.js, sources-modal.js and predictor-ui.js build at runtime.
   Path data is copied verbatim from the official Lucide icon set — no CDN,
   no npm runtime dependency, no network request, works via file://.

   Classic script only (S-11: no ES module syntax). Attaches
   to window (or globalThis under Vitest/node) like every other module in
   assets/js/. Load this file before chat-ui.js, sources-modal.js and
   predictor-ui.js. See docs/SPEC.md §3, §9. */

(function () {
  'use strict';

  // Inner shape markup only (no outer <svg>) — official Lucide 24x24 path
  // data, one entry per icon actually injected from JS in this codebase.
  var ICONS = {
    'graduation-cap':
      '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"></path>' +
      '<path d="M22 10v6"></path>' +
      '<path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"></path>',
    landmark:
      '<path d="M10 18v-7"></path>' +
      '<path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z"></path>' +
      '<path d="M14 18v-7"></path>' +
      '<path d="M18 18v-7"></path>' +
      '<path d="M3 22h18"></path>' +
      '<path d="M6 18v-7"></path>',
    'shield-check':
      '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>' +
      '<path d="m9 12 2 2 4-4"></path>',
    'message-circle':
      '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path>',
    download:
      '<path d="M12 15V3"></path>' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>' +
      '<path d="m7 10 5 5 5-5"></path>',
    x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
    'trending-up':
      '<path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path>',
    wallet:
      '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path>' +
      '<path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path>',
    award:
      '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"></path>' +
      '<circle cx="12" cy="8" r="6"></circle>',
    briefcase:
      '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>' +
      '<rect width="20" height="14" x="2" y="6" rx="2"></rect>',
    'calendar-days':
      '<path d="M8 2v3"></path><path d="M16 2v3"></path>' +
      '<rect x="3" y="3" width="18" height="18" rx="2"></rect>' +
      '<path d="M3 9h18"></path>' +
      '<path d="M8 13h.01"></path><path d="M12 13h.01"></path><path d="M16 13h.01"></path>' +
      '<path d="M8 17h.01"></path><path d="M12 17h.01"></path><path d="M16 17h.01"></path>'
  };

  /**
   * Builds an inline SVG string for the named icon using standard Lucide
   * attributes (viewBox 0 0 24 24, fill none, stroke currentColor,
   * stroke-width 2, round caps/joins) so every icon in the app reads as one
   * family. `size` sets width/height in px (default 24, matches the
   * previous hand-rolled markup's dimensions when the caller passes it
   * explicitly). `attrs` optionally overrides/extends attributes — e.g.
   * `{ stroke: '#fff' }` for an icon that must stay a fixed colour on a
   * gradient tile rather than follow the surrounding text colour.
   *
   * These icons are always decorative (the control they sit in carries its
   * own aria-label or adjacent visible text — see docs/SPEC.md §9), so the
   * output always carries aria-hidden="true" and focusable="false".
   */
  function svg(name, size, attrs) {
    var inner = ICONS[name];
    if (!inner) return '';
    var s = size || 24;
    // Merge into one object first — HTML forbids duplicate attributes, and a
    // naive string-append would let a caller-supplied `stroke` collide with
    // the default instead of overriding it.
    var merged = {
      width: s,
      height: s,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    };
    if (attrs) {
      for (var key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) merged[key] = attrs[key];
      }
    }
    // aria-hidden/focusable are not overridable — every icon built here is
    // decorative by contract (see docstring above).
    merged['aria-hidden'] = 'true';
    merged.focusable = 'false';

    var out = '<svg';
    for (var k in merged) {
      if (Object.prototype.hasOwnProperty.call(merged, k)) {
        out += ' ' + k + '="' + String(merged[k]).replace(/"/g, '&quot;') + '"';
      }
    }
    out += '>' + inner + '</svg>';
    return out;
  }

  var Icons = { svg: svg };

  var __g = typeof window !== 'undefined' ? window : globalThis;
  __g.Icons = Icons;

  if (typeof module !== 'undefined' && module.exports) module.exports = Icons;
})();
