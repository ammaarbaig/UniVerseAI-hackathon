/* UniVerse landing predictor widget. See docs/SPEC.md §6.1.
   Consumes window.UNIVERSE_DATA (assets/js/data.js) and window.Predictor
   (assets/js/predictor.js). No other module reads/writes these globals. */

(function () {
  'use strict';

  var CATEGORIES = ['General', 'OBC-NCL', 'EWS', 'SC', 'ST'];
  var DEFAULT_CATEGORY = 'OBC-NCL';

  var BRANCHES = [
    { code: 'CSE', label: 'Computer Science & Engineering' },
    { code: 'IT', label: 'Information Technology' },
    { code: 'ECE', label: 'Electronics & Communication' },
    { code: 'Electrical', label: 'Electrical Engineering' },
    { code: 'Mechanical', label: 'Mechanical Engineering' },
    { code: 'Civil', label: 'Civil Engineering' },
    { code: 'Chemical', label: 'Chemical Engineering' },
    { code: 'AI & DS', label: 'AI & Data Science' }
  ];
  var DEFAULT_BRANCH = 'CSE';
  var DEFAULT_RANK = 8420;

  var els = {};
  var state = {
    rank: DEFAULT_RANK,
    category: DEFAULT_CATEGORY,
    branch: DEFAULT_BRANCH
  };

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function formatRank(n) {
    if (window.Predictor && typeof window.Predictor.formatRank === 'function') {
      return window.Predictor.formatRank(n);
    }
    return String(n);
  }

  function setCollegeCounts() {
    var data = window.UNIVERSE_DATA;
    var count = data && data.meta && data.meta.collegeCount;
    if (!count) return;
    var ids = ['statCollegeCount', 'statCollegeCountMobile', 'footerCollegeCount'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.textContent = String(count);
    }
  }

  function buildCategoryChips() {
    els.categoryChips.innerHTML = '';
    CATEGORIES.forEach(function (cat) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'category-chip';
      btn.textContent = cat;
      btn.setAttribute('aria-pressed', cat === state.category ? 'true' : 'false');
      btn.addEventListener('click', function () {
        state.category = cat;
        Array.prototype.forEach.call(els.categoryChips.children, function (child) {
          child.setAttribute('aria-pressed', child === btn ? 'true' : 'false');
        });
        render();
      });
      els.categoryChips.appendChild(btn);
    });
  }

  function buildBranchSelect() {
    els.branchSelect.innerHTML = '';
    BRANCHES.forEach(function (b) {
      var opt = document.createElement('option');
      opt.value = b.code;
      opt.textContent = b.label;
      if (b.code === state.branch) opt.selected = true;
      els.branchSelect.appendChild(opt);
    });
    els.branchSelect.addEventListener('change', function () {
      state.branch = els.branchSelect.value;
      render();
    });
  }

  function bindSlider() {
    els.rankSlider.value = String(state.rank);
    els.rankSlider.addEventListener('input', function () {
      state.rank = parseInt(els.rankSlider.value, 10) || DEFAULT_RANK;
      render();
    });
  }

  function updateRankDisplay() {
    var label = formatRank(state.rank);
    els.rankValue.textContent = label;
    els.rankSlider.setAttribute('aria-valuenow', String(state.rank));
    els.rankSlider.setAttribute('aria-valuetext', label);
  }

  function pickChipClass(chance) {
    switch (chance) {
      case 'Safe': return 'chip-safe';
      case 'Likely': return 'chip-likely';
      case 'Reach': return 'chip-reach';
      default: return 'chip-unlikely';
    }
  }

  function resultFee(r) {
    if (r.feeLabel) return r.feeLabel;
    if (typeof r.fee === 'number') {
      return '₹' + Math.round(r.fee / 1000) + 'k';
    }
    return '—';
  }

  function resultClosing(r) {
    if (typeof r.closing === 'number') return formatRank(r.closing);
    if (r.closing != null) return String(r.closing);
    return '—';
  }

  function resultPlaced(r) {
    if (r.placed === null || r.placed === undefined) return '—';
    return r.placed + '%';
  }

  // Institution icon for result cards — official Lucide "landmark" path data
  // via assets/js/icons.js (see docs/SPEC.md §3, §9). Decorative: sits next
  // to the college name, so Icons.svg()'s aria-hidden output is correct as-is.
  var houseIconSvg = window.Icons ? window.Icons.svg('landmark', 19) : '';
  var houseIconSvgSmall = window.Icons ? window.Icons.svg('landmark', 18) : '';

  function renderDesktopCards(results) {
    var container = els.cardsDesktop;
    container.innerHTML = '';
    if (!results.length) {
      var empty = document.createElement('div');
      empty.className = 'predictor-empty';
      empty.textContent = 'No colleges match this combination yet — try a different rank or category.';
      container.appendChild(empty);
      return;
    }
    results.slice(0, 3).forEach(function (r) {
      var card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML =
        '<div class="result-card-top">' +
          '<div class="result-icon">' + houseIconSvg + '</div>' +
          '<div style="flex:1">' +
            '<div class="result-name"></div>' +
            '<div class="result-sub"></div>' +
          '</div>' +
          '<span class="chip ' + pickChipClass(r.chance) + '"></span>' +
        '</div>' +
        '<div class="result-card-stats">' +
          '<div><div class="result-stat-label">CLOSING RANK</div><div class="result-stat-value closing-value"></div></div>' +
          '<div><div class="result-stat-label">FEE / YEAR</div><div class="result-stat-value fee-value"></div></div>' +
          '<div><div class="result-stat-label">PLACED 2025</div><div class="result-stat-value placed-value"></div></div>' +
        '</div>';
      card.querySelector('.result-name').textContent = r.name || 'Unknown college';
      card.querySelector('.result-sub').textContent = (r.city || '—') + ' · ' + (r.type || '—');
      card.querySelector('.chip').textContent = r.chance || 'Unlikely';
      card.querySelector('.closing-value').textContent = resultClosing(r);
      card.querySelector('.fee-value').textContent = resultFee(r);
      card.querySelector('.placed-value').textContent = resultPlaced(r);
      container.appendChild(card);
    });
  }

  function renderMobileRows(results) {
    var container = els.rowsMobile;
    container.innerHTML = '';
    if (!results.length) {
      var empty = document.createElement('div');
      empty.className = 'predictor-empty';
      empty.textContent = 'No colleges match this combination yet — try a different rank or category.';
      container.appendChild(empty);
      return;
    }
    results.slice(0, 3).forEach(function (r) {
      var row = document.createElement('div');
      row.className = 'result-row';
      row.innerHTML =
        '<div class="result-row-icon">' + houseIconSvgSmall + '</div>' +
        '<div class="result-row-info">' +
          '<div class="result-row-name"></div>' +
          '<div class="result-row-meta"></div>' +
        '</div>' +
        '<span class="chip ' + pickChipClass(r.chance) + '"></span>';
      row.querySelector('.result-row-name').textContent = r.name || 'Unknown college';
      row.querySelector('.result-row-meta').textContent = 'Close ' + resultClosing(r) + ' · ' + resultFee(r) + '/yr';
      row.querySelector('.chip').textContent = r.chance || 'Unlikely';
      container.appendChild(row);
    });
  }

  function render() {
    updateRankDisplay();

    var data = window.UNIVERSE_DATA;
    var Predictor = window.Predictor;

    if (!data || !Predictor || typeof Predictor.predict !== 'function') {
      els.headline.textContent = 'Predictor is warming up — check back in a moment.';
      renderDesktopCards([]);
      renderMobileRows([]);
      return;
    }

    var colleges = data.colleges || [];
    var cutoffs = data.cutoffs || [];
    var total = (data.meta && data.meta.collegeCount) || colleges.length;

    var results = [];
    try {
      results = Predictor.predict(state.rank, state.category, state.branch, colleges, cutoffs) || [];
    } catch (e) {
      results = [];
    }

    var headlineText;
    try {
      headlineText = Predictor.headline(results, total, state.branch, state.category);
    } catch (e) {
      headlineText = results.length + ' of ' + total + ' colleges match — ' + state.branch + ', ' + state.category;
    }
    els.headline.textContent = headlineText;

    renderDesktopCards(results);
    renderMobileRows(results);
  }

  ready(function () {
    els.rankSlider = document.getElementById('rankSlider');
    els.rankValue = document.getElementById('rankValue');
    els.categoryChips = document.getElementById('categoryChips');
    els.branchSelect = document.getElementById('branchSelect');
    els.headline = document.getElementById('resultHeadline');
    els.cardsDesktop = document.getElementById('predictorCardsDesktop');
    els.rowsMobile = document.getElementById('predictorRowsMobile');

    if (!els.rankSlider || !els.categoryChips || !els.branchSelect) {
      return; // predictor markup not present on this page
    }

    setCollegeCounts();
    buildCategoryChips();
    buildBranchSelect();
    bindSlider();
    render();
  });
})();
