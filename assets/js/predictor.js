// assets/js/predictor.js
// Pure scoring logic. No DOM. No globals beyond the export guard at the
// bottom of this file. See docs/SPEC.md §6.

var CATEGORIES = ['General', 'EWS', 'OBC-NCL', 'SC', 'ST'];
var BRANCHES = ['CSE', 'IT', 'ECE', 'Electrical', 'Mechanical', 'Civil', 'Chemical', 'AI & DS'];

var CHANCE_ORDER = ['Safe', 'Likely', 'Reach', 'Unlikely'];

var BANDS = {
  Safe: { chipBg: '#E4F5EA', chipFg: '#2F7A4A' },
  Likely: { chipBg: '#E6EEFC', chipFg: '#2C55B8' },
  Reach: { chipBg: '#FFF0DC', chipFg: '#A96A15' },
  Unlikely: { chipBg: '#F3F0F6', chipFg: '#7A6E86' }
};

var RANK_MIN = 1;
var RANK_MAX = 200000;

function coerceRank(rank) {
  var n = typeof rank === 'string' ? parseFloat(rank) : rank;
  if (typeof n !== 'number' || isNaN(n)) n = RANK_MIN;
  n = Math.trunc(n);
  if (n < RANK_MIN) n = RANK_MIN;
  if (n > RANK_MAX) n = RANK_MAX;
  return n;
}

function classify(rank, closing) {
  var r = coerceRank(rank);
  var chance;
  if (closing >= r * 1.25) {
    chance = 'Safe';
  } else if (closing >= r * 0.98) {
    chance = 'Likely';
  } else if (closing >= r * 0.82) {
    chance = 'Reach';
  } else {
    chance = 'Unlikely';
  }
  var band = BANDS[chance];
  return { chance: chance, chipBg: band.chipBg, chipFg: band.chipFg };
}

function formatRank(n) {
  var num = typeof n === 'number' ? n : parseFloat(n);
  if (isNaN(num)) num = 0;
  num = Math.trunc(num);
  var negative = num < 0;
  if (negative) num = -num;
  var str = String(num);
  var lastThree = str.length > 3 ? str.slice(-3) : str;
  var rest = str.length > 3 ? str.slice(0, -3) : '';
  var restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  var out = rest ? restGrouped + ',' + lastThree : lastThree;
  return negative ? '-' + out : out;
}

function predict(rank, category, branch, colleges, cutoffs) {
  if (!Array.isArray(colleges) || !Array.isArray(cutoffs)) return [];
  if (CATEGORIES.indexOf(category) === -1) return [];
  if (BRANCHES.indexOf(branch) === -1) return [];

  var r = coerceRank(rank);

  var collegeById = {};
  for (var i = 0; i < colleges.length; i++) {
    collegeById[colleges[i].id] = colleges[i];
  }

  var results = [];
  for (var j = 0; j < cutoffs.length; j++) {
    var cutoff = cutoffs[j];
    if (cutoff.category !== category || cutoff.branch !== branch) continue;
    var college = collegeById[cutoff.collegeId];
    if (!college) continue;

    var classification = classify(r, cutoff.closing);

    results.push({
      name: college.name,
      city: college.city,
      type: college.type,
      fee: typeof college.fee === 'number' ? college.fee : null,
      feeLabel: college.feeLabel || null,
      placed: typeof college.placed === 'number' ? college.placed : null,
      closing: cutoff.closing,
      closingLabel: formatRank(cutoff.closing),
      fourYearTotal: college.fourYearTotal || null,
      chance: classification.chance,
      chipBg: classification.chipBg,
      chipFg: classification.chipFg
    });
  }

  results.sort(function (a, b) {
    var chanceDiff = CHANCE_ORDER.indexOf(a.chance) - CHANCE_ORDER.indexOf(b.chance);
    if (chanceDiff !== 0) return chanceDiff;
    return a.closing - b.closing;
  });

  return results;
}

function headline(results, total, branch, category) {
  var list = Array.isArray(results) ? results : [];
  var matchCount = 0;
  for (var i = 0; i < list.length; i++) {
    if (list[i].chance !== 'Unlikely') matchCount++;
  }
  return matchCount + ' of ' + total + ' colleges match — ' + branch + ', ' + category;
}

var Predictor = {
  classify: classify,
  predict: predict,
  formatRank: formatRank,
  headline: headline,
  CATEGORIES: CATEGORIES,
  BRANCHES: BRANCHES
};

if (typeof module !== 'undefined' && module.exports) module.exports = Predictor;
(typeof window !== 'undefined' ? window : globalThis).Predictor = Predictor;
