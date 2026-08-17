/* UniVerse — assets/js/chat-provider.js
   The ONLY file that knows how a chat reply is produced. See docs/SPEC.md §7.

   window.UniChat.provider = { send(message, history) -> Promise<UniReply> }

   UniReply = {
     text: string,                 // may contain <strong> and <em> only
     colleges: [{ name, subtitle, closingLabel, closing, totalLabel, total, chance }],
     sources: [{ label, checkedOn }],
     suggestions: [string]
   }

   No DOM access anywhere in this file. All rendering lives in chat-ui.js.
   Must load and run under Node (require()) as well as <script src> in a browser,
   so UNIVERSE_DATA / Predictor are read off the shared global lazily, at call
   time — never at file-parse time. */

(function () {
  'use strict';

  var __g = typeof window !== 'undefined' ? window : globalThis;
  __g.UniChat = __g.UniChat || {};

  var CHECKED_ON = '12 Aug 2026';

  var CATEGORY_PATTERNS = [
    { cat: 'OBC-NCL', re: /\bOBC(-NCL)?\b/i },
    { cat: 'EWS', re: /\bEWS\b/i },
    { cat: 'SC', re: /\bSC\b/i },
    { cat: 'ST', re: /\bST\b/i },
    { cat: 'General', re: /\bGeneral\b/i }
  ];

  var BRANCH_PATTERNS = [
    { branch: 'CSE', re: /\bCSE\b|\bcomputer science\b/i },
    { branch: 'AI & DS', re: /\bAI\s*&\s*DS\b|\bAI\s*and\s*DS\b|\bartificial intelligence\b/i },
    { branch: 'IT', re: /\bIT\b|\binformation technology\b/i },
    { branch: 'ECE', re: /\bECE\b|\belectronics\b/i },
    { branch: 'Electrical', re: /\belectrical\b/i },
    { branch: 'Mechanical', re: /\bmechanical\b/i },
    { branch: 'Civil', re: /\bcivil\b/i },
    { branch: 'Chemical', re: /\bchemical\b/i }
  ];

  var RANK_RE = /\b(\d{3,6})\b/;

  var STOPWORDS = {
    'a': 1, 'an': 1, 'the': 1, 'is': 1, 'are': 1, 'do': 1, 'does': 1, 'i': 1,
    'to': 1, 'for': 1, 'of': 1, 'in': 1, 'on': 1, 'at': 1, 'and': 1, 'or': 1,
    'what': 1, 'how': 1, 'my': 1, 'me': 1, 'can': 1, 'will': 1, 'with': 1
  };

  function tokenize(str) {
    return String(str || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(function (t) { return t.length > 1 && !STOPWORDS[t]; });
  }

  function getData() {
    return __g.UNIVERSE_DATA || null;
  }

  function getPredictor() {
    return __g.Predictor || null;
  }

  function detectCategory(message) {
    for (var i = 0; i < CATEGORY_PATTERNS.length; i++) {
      if (CATEGORY_PATTERNS[i].re.test(message)) return CATEGORY_PATTERNS[i].cat;
    }
    return null;
  }

  function detectBranch(message) {
    for (var i = 0; i < BRANCH_PATTERNS.length; i++) {
      if (BRANCH_PATTERNS[i].re.test(message)) return BRANCH_PATTERNS[i].branch;
    }
    return null;
  }

  function detectRank(message) {
    var m = RANK_RE.exec(message);
    if (!m) return null;
    var n = parseInt(m[1], 10);
    if (!isFinite(n) || n <= 0) return null;
    return n;
  }

  /** Map a Predictor result row (college + cutoff + chance) onto the UniReply
   *  college shape required by SPEC §7.1. Predictor result fields are read
   *  defensively since predictor.js is authored by another workstream. */
  function toReplyCollege(row, branch, category, predictor) {
    var name = row.name || row.shortName || row.collegeName || 'Unknown college';
    var city = row.city || row.district || '';
    var seats = (row.seats === null || row.seats === undefined) ? null : row.seats;
    var seatsPart = seats ? (seats + ' seats') : null;
    var subtitleParts = [branch, seatsPart, city].filter(Boolean);
    var closing = row.closing;
    var closingText = (predictor && typeof predictor.formatRank === 'function' && typeof closing === 'number')
      ? predictor.formatRank(closing)
      : String(closing);
    var total = row.fourYearTotal || row.total || row.feeLabel || '—';
    return {
      name: name,
      subtitle: subtitleParts.join(' · '),
      closingLabel: category + ' CLOSE',
      closing: closingText,
      totalLabel: '4-YR TOTAL',
      total: total,
      chance: row.chance
    };
  }

  function rankQuery(message) {
    var rank = detectRank(message);
    var category = detectCategory(message);
    if (rank === null || category === null) return null;
    var branch = detectBranch(message) || 'CSE';

    var data = getData();
    var predictor = getPredictor();
    if (!data || !predictor || typeof predictor.predict !== 'function') return null;

    var results = predictor.predict(rank, category, branch, data.colleges || [], data.cutoffs || []);
    if (!results || !results.length) return null;

    var top3 = results.slice(0, 3);
    var colleges = top3.map(function (row) {
      return toReplyCollege(row, branch, category, predictor);
    });

    var rankText = (typeof predictor.formatRank === 'function') ? predictor.formatRank(rank) : String(rank);

    return {
      text: '<strong>' + rankText + '</strong> in <strong>' + category + '</strong> for <strong>' + branch +
        '</strong> — here are the closest matches, safest first.',
      colleges: colleges,
      sources: [
        { label: 'REAP 2025 final allotment', checkedOn: CHECKED_ON },
        { label: 'hte.rajasthan.gov.in fee notification', checkedOn: CHECKED_ON }
      ],
      suggestions: [
        'Explain the scholarship form',
        'Compare placements at these colleges',
        'What order should he fill choices in?'
      ]
    };
  }

  function faqIntent(message) {
    var data = getData();
    if (!data || !Array.isArray(data.faqs) || !data.faqs.length) return null;

    var queryTokens = tokenize(message);
    if (!queryTokens.length) return null;
    var querySet = {};
    queryTokens.forEach(function (t) { querySet[t] = 1; });

    var best = null;
    var bestScore = 0;
    data.faqs.forEach(function (faq) {
      var question = faq.question || faq.User_Intent_or_Question || '';
      var faqTokens = tokenize(question);
      if (!faqTokens.length) return;
      var overlap = 0;
      var seen = {};
      faqTokens.forEach(function (t) {
        if (querySet[t] && !seen[t]) { overlap++; seen[t] = 1; }
      });
      var union = Object.keys(querySet).length + faqTokens.length - overlap;
      var score = union > 0 ? overlap / union : 0;
      if (score > bestScore) {
        bestScore = score;
        best = faq;
      }
    });

    var THRESHOLD = 0.2;
    if (!best || bestScore < THRESHOLD) return null;

    var shortAnswer = best.shortAnswer || best.Short_Answer || '';
    var detail = best.detail || best.Detail_or_Steps || '';
    var text = '<strong>' + shortAnswer + '</strong>' + (detail ? ' ' + detail : '');

    return {
      text: text,
      colleges: [],
      sources: [{ label: 'UniVerse FAQ database', checkedOn: CHECKED_ON }],
      suggestions: [
        'What is the REAP 2026 last date?',
        'Hostel fees at MBM Jodhpur',
        'Diploma vs B.Tech after 12th'
      ]
    };
  }

  function glossaryIntent(message) {
    var data = getData();
    if (!data || !Array.isArray(data.glossary) || !data.glossary.length) return null;

    var lower = String(message || '').toLowerCase();
    var match = null;
    data.glossary.forEach(function (entry) {
      if (match) return;
      var term = entry.term || entry.Term || '';
      if (!term) return;
      var re = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (re.test(lower)) match = entry;
    });

    if (!match) return null;

    var term = match.term || match.Term || '';
    var fullForm = match.fullForm || match.Full_Form || '';
    var meaning = match.meaning || match['Plain-Language_Meaning'] || match.plain_language_meaning || '';

    var text = '<strong>' + term + '</strong>' + (fullForm ? ' (' + fullForm + ')' : '') +
      ' — ' + meaning;

    return {
      text: text,
      colleges: [],
      sources: [{ label: 'UniVerse glossary', checkedOn: CHECKED_ON }],
      suggestions: [
        'What is the REAP 2026 last date?',
        'SC cutoff for GEC Bikaner',
        'Diploma vs B.Tech after 12th'
      ]
    };
  }

  function fallback() {
    return {
      text: 'I only answer from checked DTE and REAP records, and I couldn\'t match that to one confidently. ' +
        'Try asking with a rank and category, or pick one of these:',
      colleges: [],
      sources: [{ label: 'DTE & REAP records', checkedOn: CHECKED_ON }],
      suggestions: [
        'What is the REAP 2026 last date?',
        'SC cutoff for GEC Bikaner',
        'Hostel fees at MBM Jodhpur',
        'Diploma vs B.Tech after 12th'
      ]
    };
  }

  function buildReply(message) {
    var msg = String(message || '').trim();
    if (!msg) return fallback();
    // Glossary is checked ahead of FAQ intent: a message naming a defined term
    // ("What is REAP?") should return that term's exact plain-language meaning
    // rather than whichever FAQ happens to share the most tokens with it.
    return rankQuery(msg) || glossaryIntent(msg) || faqIntent(msg) || fallback();
  }

  function randomLatency() {
    return 400 + Math.floor(Math.random() * 301); // 400–700ms
  }

  var LocalProvider = {
    send: function (message, history) {
      // history is accepted for API compatibility but intentionally does not
      // influence LocalProvider's answer (PRD X-10: a rank query's result must
      // be unaffected by history).
      void history;
      var reply = buildReply(message);
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(reply); }, randomLatency());
      });
    }
  };

  // ─── ZAPIER PROVIDER ─────────────────────────────────────────
  // SHIPPED, but not as a UniReply provider. Zapier arrived as a
  // <zapier-interfaces-chatbot-embed> web component (see chat.html), not as
  // a client library — it renders its own self-contained UI inside its
  // shadow DOM and exposes no JS message API to call from here. There is
  // nothing to wrap against the §7.1 contract, so it never becomes
  // window.UniChat.provider.
  //
  // The providers below serve ONLY the manual local chat UI, reachable via
  // the ?chat=local URL flag (see assets/js/chat-ui.js) — Zapier is the
  // default chat experience and is unaffected by anything in this file.
  // ─────────────────────────────────────────────────────────────

  // ─── OPENCODE PROVIDER (Task 3) — wired but disabled, no key shipped ──
  // This is a static site with no backend, so a real API key placed in
  // client JS would be publicly readable by every visitor. We therefore
  // ship NO key. OpenCodeProvider only activates if a consuming page has
  // supplied window.UNIVERSE_CONFIG.OPENCODE_API_KEY at runtime (e.g. via
  // an untracked assets/js/config.local.js — see assets/js/config.example.js
  // for the template). Absent that, LocalProvider remains the default for
  // the local UI.

  var OPENCODE_ENDPOINT = 'https://api.opencode.ai/v1/chat/completions';

  var OPENCODE_SYSTEM_PROMPT =
    'You are Uni AI, an assistant grounded strictly in Rajasthan DTE ' +
    '(Directorate of Technical Education) engineering and polytechnic ' +
    'admissions, including REAP counselling. Answer only from verified DTE ' +
    'and REAP records; if you are not confident, say so rather than guess. ' +
    'Keep answers concise and factual, in plain language a parent can follow.';

  function getConfig() {
    return __g.UNIVERSE_CONFIG || null;
  }

  function isOpenCodeConfigured() {
    var cfg = getConfig();
    return !!(cfg && cfg.OPENCODE_API_KEY);
  }

  function historyToOpenCodeMessages(history) {
    var out = [];
    (history || []).forEach(function (turn) {
      if (!turn || !turn.text) return;
      out.push({
        role: turn.role === 'user' ? 'user' : 'assistant',
        content: stripReplyMarkup(turn.text)
      });
    });
    return out;
  }

  function stripReplyMarkup(text) {
    return String(text || '').replace(/<\/?(strong|em)>/g, '');
  }

  /** Maps an OpenCode chat-completions response onto the UniReply shape
   *  (SPEC §7.1). OpenCode has no notion of college cards, so `colleges`
   *  is always empty for this provider — the reply text carries everything. */
  function toUniReply(json) {
    var choice = json && json.choices && json.choices[0];
    var content = (choice && choice.message && choice.message.content) || '';
    var text = String(content).trim() || 'Uni AI had no answer for that — try rephrasing your question.';
    return {
      text: text,
      colleges: [],
      sources: [{ label: 'OpenCode Go (Uni AI)', checkedOn: CHECKED_ON }],
      suggestions: [
        'What is the REAP 2026 last date?',
        'Hostel fees at MBM Jodhpur',
        'Diploma vs B.Tech after 12th'
      ]
    };
  }

  var OpenCodeProvider = {
    send: function (message, history) {
      var cfg = getConfig();
      var apiKey = cfg && cfg.OPENCODE_API_KEY;
      var msg = String(message || '').trim();
      if (!msg) return Promise.resolve(fallback());
      if (!apiKey || typeof fetch !== 'function') return Promise.resolve(fallback());

      var body = {
        model: 'opencode-go',
        messages: [{ role: 'system', content: OPENCODE_SYSTEM_PROMPT }]
          .concat(historyToOpenCodeMessages(history))
          .concat([{ role: 'user', content: msg }])
      };

      return fetch(OPENCODE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify(body)
      })
        .then(function (res) { return res.json(); })
        .then(toUniReply)
        .catch(function () { return fallback(); });
    }
  };

  // Precedence for the LOCAL UI (?chat=local) only: OpenCodeProvider if a
  // key has been supplied at runtime, else LocalProvider. Zapier is its own
  // embedded UI in chat.html and is not affected by this choice.
  var defaultProvider = isOpenCodeConfigured() ? OpenCodeProvider : LocalProvider;

  __g.UniChat.provider = __g.UniChat.provider || defaultProvider;
  __g.UniChat.LocalProvider = LocalProvider;
  __g.UniChat.OpenCodeProvider = OpenCodeProvider;

  if (typeof module !== 'undefined' && module.exports) module.exports = __g.UniChat;
})();
