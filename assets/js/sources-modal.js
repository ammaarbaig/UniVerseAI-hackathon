/* UniVerse — shared Data Sources modal.
   Self-mounting: builds its own DOM, listens for [data-sources-modal] clicks via a
   delegated document listener, and exposes window.UniVerseSourcesModal.
   Classic script — no import/export. See docs/SPEC.md §5.4, §9. Grounded in
   2026.08-College-Database-final.xlsx sheets 15_Sources / 14_Data_Gaps. */

(function () {
  'use strict';

  var backdropEl = null;
  var dialogEl = null;
  var lastFocusedEl = null;
  var isOpen = false;

  var FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var key in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue;
        if (key === 'text') {
          node.textContent = attrs[key];
        } else {
          node.setAttribute(key, attrs[key]);
        }
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        if (children[i]) node.appendChild(children[i]);
      }
    }
    return node;
  }

  function sourceItem(name, desc) {
    var item = el('li', { class: 'usm-source-item' });
    item.appendChild(el('p', { class: 'usm-source-name', text: name }));
    item.appendChild(el('p', { class: 'usm-source-desc', text: desc }));
    return item;
  }

  function buildAuthoritiesSection() {
    var section = el('div', { class: 'usm-section' });
    section.appendChild(el('h3', { class: 'usm-section-title', text: 'Where our data comes from' }));
    section.appendChild(el('p', {
      class: 'usm-section-lead',
      text: 'Institution, fee, scholarship, placement, curriculum and FAQ records are drawn from official published sources, checked against the authorities below.'
    }));

    var list = el('ul', { class: 'usm-source-list' });
    list.appendChild(sourceItem(
      'Department of Technical Education, Rajasthan (DTE)',
      'Institution directory, admission notices, seat matrices, fee orders, scholarship and placement information for government polytechnic and engineering colleges.'
    ));
    list.appendChild(sourceItem(
      'REAP — the state engineering admission counselling authority',
      'Engineering college and branch lists, counselling process and seat-allotment references used for the predictor.'
    ));
    list.appendChild(sourceItem(
      'Board of Technical Education, Rajasthan (BTER)',
      'Diploma curriculum, semester teaching schemes and exam/evaluation rules.'
    ));
    list.appendChild(sourceItem(
      'Directorate of Social Justice & Empowerment',
      'Scholarship scheme eligibility, amounts and helpdesk details for state schemes.'
    ));
    list.appendChild(sourceItem(
      'AICTE and the National Scholarship Portal',
      'Central scholarship schemes such as Pragati and Saksham, and the common application gateway.'
    ));
    section.appendChild(list);
    return section;
  }

  function buildCutoffCallout() {
    var section = el('div', { class: 'usm-section usm-callout' });
    section.appendChild(el('h3', { class: 'usm-section-title', text: 'How to read our cutoff figures' }));

    var p1 = el('p', {});
    p1.appendChild(document.createTextNode('Only around '));
    p1.appendChild(el('strong', { text: '30 real cutoff rows' }));
    p1.appendChild(document.createTextNode(
      ' exist in our source data — approximate, secondary figures covering roughly 14 colleges, almost entirely the General category.'
    ));
    section.appendChild(p1);

    var p2 = el('p', {});
    p2.appendChild(document.createTextNode('The rest of the predictor grid — every other college, branch and category combination — is '));
    p2.appendChild(el('strong', { text: 'generated, not observed' }));
    p2.appendChild(document.createTextNode(', and is tagged DEMO in our dataset.'));
    section.appendChild(p2);

    var p3 = el('p', {});
    p3.appendChild(el('strong', { text: 'These figures are guidance, not official cutoffs.' }));
    p3.appendChild(document.createTextNode(
      ' Always confirm the final closing rank on the official REAP or DTE portal before paying any fee or making an admission decision.'
    ));
    section.appendChild(p3);

    return section;
  }

  function buildCoverageSection() {
    var section = el('div', { class: 'usm-section' });
    section.appendChild(el('h3', { class: 'usm-section-title', text: 'What is verified vs. estimated' }));

    var row = el('div', { class: 'usm-stat-row' });
    row.appendChild(buildStat('35', 'source records reviewed'));
    row.appendChild(buildStat('~30', 'real cutoff rows (secondary)'));
    row.appendChild(buildStat('~14', 'colleges with real cutoffs'));
    section.appendChild(row);

    section.appendChild(el('p', {
      class: 'usm-section-lead',
      text: 'Some fee, placement, hostel and district fields are still being spot-checked against individual college pages as we expand coverage. Where a figure looks unusual for a specific college, treat it as indicative and verify with the institution directly.'
    }));

    return section;
  }

  function buildStat(num, label) {
    var stat = el('div', { class: 'usm-stat' });
    stat.appendChild(el('span', { class: 'usm-stat-num', text: num }));
    stat.appendChild(el('span', { class: 'usm-stat-label', text: label }));
    return stat;
  }

  function buildFooter() {
    var section = el('div', { class: 'usm-section' });
    section.appendChild(el('p', { class: 'usm-footer-note', text: 'Last verified 12 Aug 2026.' }));
    section.appendChild(el('p', {
      class: 'usm-footer-note',
      text: 'UniVerse is an independent student information project and is not affiliated with, endorsed by, or an official channel of the Government of Rajasthan.'
    }));
    return section;
  }

  function buildModal() {
    var titleId = 'usm-title-' + Date.now();

    var closeBtn = el('button', {
      type: 'button',
      class: 'usm-close',
      'aria-label': 'Close'
    });
    // Icon-only control: the SVG is decorative (aria-hidden, built by
    // assets/js/icons.js — official Lucide "x" path data), the accessible
    // name lives on the button's aria-label above.
    if (window.Icons) {
      closeBtn.innerHTML = window.Icons.svg('x', 18);
    } else {
      closeBtn.textContent = '×';
    }
    closeBtn.addEventListener('click', closeModal);

    var header = el('div', { class: 'usm-header' }, [
      el('div', {}, [
        el('h2', { id: titleId, class: 'usm-title', text: 'Data sources' }),
        el('p', { class: 'usm-subtitle', text: 'Where UniVerse’s college, fee, scholarship and cutoff information comes from.' })
      ]),
      closeBtn
    ]);
    // header wraps title block in a plain div; give it inline flex growth via CSS defaults
    header.firstChild.style.flex = '1 1 auto';

    var body = el('div', { class: 'usm-body' }, [
      buildAuthoritiesSection(),
      buildCutoffCallout(),
      buildCoverageSection(),
      buildFooter()
    ]);

    var dialog = el('div', {
      class: 'usm-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      tabindex: '-1'
    }, [header, body]);

    var backdrop = el('div', { class: 'usm-backdrop', hidden: 'hidden' }, [dialog]);
    backdrop.addEventListener('mousedown', function (event) {
      if (event.target === backdrop) closeModal();
    });

    document.body.appendChild(backdrop);
    backdropEl = backdrop;
    dialogEl = dialog;
  }

  function getFocusableElements() {
    if (!dialogEl) return [];
    var nodes = dialogEl.querySelectorAll(FOCUSABLE_SELECTOR);
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.offsetParent !== null || node === document.activeElement) {
        result.push(node);
      }
    }
    return result;
  }

  function onKeydown(event) {
    if (!isOpen) return;
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key === 'Tab') {
      var focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first || document.activeElement === dialogEl) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
  }

  function setBackgroundInert(inert) {
    var children = document.body.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child === backdropEl) continue;
      if (inert) {
        if (!child.hasAttribute('data-usm-prev-aria-hidden')) {
          child.setAttribute('data-usm-prev-aria-hidden', child.getAttribute('aria-hidden') || '');
        }
        child.setAttribute('aria-hidden', 'true');
        try { child.inert = true; } catch (e) { /* no-op if unsupported */ }
      } else {
        var prev = child.getAttribute('data-usm-prev-aria-hidden');
        if (prev) {
          child.setAttribute('aria-hidden', prev);
        } else {
          child.removeAttribute('aria-hidden');
        }
        child.removeAttribute('data-usm-prev-aria-hidden');
        try { child.inert = false; } catch (e) { /* no-op if unsupported */ }
      }
    }
  }

  function openModal(triggerEl) {
    if (!backdropEl) buildModal();
    if (isOpen) return;
    isOpen = true;
    lastFocusedEl = triggerEl || document.activeElement;

    backdropEl.removeAttribute('hidden');
    // Force layout so the transition runs.
    void backdropEl.offsetWidth;
    backdropEl.classList.add('is-open');

    setBackgroundInert(true);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeydown, true);

    dialogEl.focus();
  }

  function closeModal() {
    if (!isOpen || !backdropEl) return;
    isOpen = false;

    backdropEl.classList.remove('is-open');
    setBackgroundInert(false);
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown, true);

    backdropEl.setAttribute('hidden', 'hidden');

    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
      lastFocusedEl.focus();
    }
    lastFocusedEl = null;
  }

  function onDocumentClick(event) {
    var trigger = event.target.closest ? event.target.closest('[data-sources-modal]') : null;
    if (!trigger) return;
    event.preventDefault();
    openModal(trigger);
  }

  function init() {
    document.addEventListener('click', onDocumentClick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.UniVerseSourcesModal = {
    open: function () { openModal(document.activeElement); },
    close: closeModal
  };
})();
