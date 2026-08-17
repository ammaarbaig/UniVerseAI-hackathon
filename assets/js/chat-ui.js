/* UniVerse — assets/js/chat-ui.js
   Rendering only. Consumes answer content EXCLUSIVELY via window.UniChat.provider
   (PRD C-13) — never reads UNIVERSE_DATA for answer text (the verified-database
   strip's college count is presentation chrome, not answer content, so it is the
   one permitted exception). All DOM work lives here; chat-provider.js has none.

   The opening exchange (rank 8,420 / OBC-NCL / Kota) is server-rendered directly
   into chat.html's #transcript as static markup (PRD S-12) so the page has
   meaningful content with JS disabled and no first-paint flash. This file wires
   interactivity onto that static markup and takes over rendering for every
   subsequent turn — it does not re-render the seed. */

(function () {
  'use strict';

  var CHECKED_ON_LABEL = 'CHECKED 12 AUG 2026';

  var SEED_PROMPTS = [
    'What is the REAP 2026 last date?',
    'SC cutoff for GEC Bikaner',
    'Hostel fees at MBM Jodhpur',
    'Diploma vs B.Tech after 12th'
  ];

  var TOPICS = [
    { label: 'Cutoffs & ranks', query: 'What are the cutoff ranks for CSE this year?', icon: 'trending-up' },
    { label: 'Fees & deposits', query: 'What fees and deposits should I expect at admission?', icon: 'wallet' },
    { label: 'Scholarships', query: 'Is there a fee waiver or scholarship for SC/ST/OBC/EWS students?', icon: 'award' },
    { label: 'Placements', query: 'Which colleges have the best placement record?', icon: 'briefcase' },
    { label: 'Counselling dates', query: 'What are the REAP 2026 counselling dates?', icon: 'calendar-days' }
  ];

  var CHANCE_CLASS = {
    Safe: 'chip--safe',
    Likely: 'chip--likely',
    Reach: 'chip--reach',
    Unlikely: 'chip--unlikely'
  };

  var transcriptEl, composerInput, sendBtn, popularRow, topicsRow;

  document.addEventListener('DOMContentLoaded', init);

  /* ── Zapier embed vs. local chat (Task 2, manual-only fallback) ─────
     Zapier always renders by default; the built-in transcript + composer are
     reachable ONLY via ?chat=local. All local-chat markup stays in the
     document source either way (PRD S-12/S-18/S-19) — this only toggles
     which half is visible and which half gets wired up. */
  function isLocalMode() {
    return /(?:^|[?&])chat=local(?:&|$)/.test(window.location.search || '');
  }

  function init() {
    var local = isLocalMode();

    if (local) {
      document.body.classList.add('chat-mode-local');

      transcriptEl = document.getElementById('transcript');
      composerInput = document.getElementById('composerInput');
      sendBtn = document.getElementById('sendBtn');
      popularRow = document.getElementById('popularRow');
      topicsRow = document.getElementById('topicsRow');

      renderPopularPrompts();
      renderTopics();
      wireComposer();
      wireExistingTranscript();

      var newQuestionBtn = document.getElementById('newQuestionBtn');
      if (newQuestionBtn) {
        newQuestionBtn.addEventListener('click', function () {
          transcriptEl.textContent = '';
          history = [];
          composerInput.value = '';
          updateSendState();
          composerInput.focus();
        });
      }
    } else {
      setupZapierFallback();
    }

    // The verified-database strip (college count) sits below the composer in
    // both modes, so its count is kept current regardless of which chat UI
    // is active.
    renderVerifiedCount();
  }

  /* One safety net, no more (Task 2): if the Zapier custom element hasn't
     upgraded ~6s after load — CDN blocked, offline, ad-blocker, or the page
     opened via file:// — show a short inline notice inside the embed frame
     explaining that and linking to the manual fallback. Never auto-swaps
     the UI. */
  function setupZapierFallback() {
    setTimeout(function () {
      if (isLocalMode()) return; // user navigated to ?chat=local in the meantime
      var upgraded = typeof window.customElements !== 'undefined' &&
        !!window.customElements.get('zapier-interfaces-chatbot-embed');
      if (upgraded) return;

      var frame = document.getElementById('chatEmbedFrame');
      if (!frame || frame.querySelector('.chat-embed-fallback')) return;

      var notice = document.createElement('div');
      notice.className = 'chat-embed-fallback';
      var p = document.createElement('p');
      p.textContent = 'Uni AI’s assistant could not load — this can happen if this page can’t reach Zapier’s servers (offline, an ad-blocker, or opened directly as a file). ';
      var link = document.createElement('a');
      link.href = '?chat=local';
      link.textContent = 'Use the built-in chat instead';
      p.appendChild(link);
      notice.appendChild(p);
      frame.appendChild(notice);
    }, 6000);
  }

  /* ── Rich text (provider text may contain <strong> and <em> only) ───── */

  function renderRichText(container, text) {
    var str = String(text || '');
    var re = /<(strong|em)>([\s\S]*?)<\/\1>/g;
    var lastIndex = 0;
    var match;
    while ((match = re.exec(str)) !== null) {
      if (match.index > lastIndex) {
        container.appendChild(document.createTextNode(str.slice(lastIndex, match.index)));
      }
      var el = document.createElement(match[1]);
      el.textContent = match[2];
      container.appendChild(el);
      lastIndex = re.lastIndex;
    }
    if (lastIndex < str.length) {
      container.appendChild(document.createTextNode(str.slice(lastIndex)));
    }
  }

  function stripTags(text) {
    return String(text || '').replace(/<\/?(strong|em)>/g, '');
  }

  /* ── Popular prompts / topic chips (empty-state starters) ────────── */

  function renderPopularPrompts() {
    if (!popularRow) return;
    popularRow.textContent = '';
    SEED_PROMPTS.forEach(function (prompt) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'popular-chip';
      chip.textContent = prompt;
      chip.addEventListener('click', function () { sendMessage(prompt); });
      popularRow.appendChild(chip);
    });
  }

  function renderTopics() {
    if (!topicsRow) return;
    topicsRow.textContent = '';
    TOPICS.forEach(function (topic) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'topic-chip';
      if (window.Icons && topic.icon) {
        var iconSpan = document.createElement('span');
        iconSpan.className = 'topic-chip__icon';
        iconSpan.style.cssText = 'display:inline-flex;align-items:center;vertical-align:middle;margin-right:6px';
        iconSpan.innerHTML = window.Icons.svg(topic.icon, 14);
        chip.appendChild(iconSpan);
      }
      chip.appendChild(document.createTextNode(topic.label));
      chip.addEventListener('click', function () { sendMessage(topic.query); });
      topicsRow.appendChild(chip);
    });
  }

  function renderVerifiedCount() {
    var el = document.getElementById('verifiedCount');
    var data = window.UNIVERSE_DATA;
    if (el && data && data.meta && data.meta.collegeCount) {
      el.textContent = String(data.meta.collegeCount);
    }
  }

  /* ── Wire interactivity onto the statically server-rendered seed ─── */

  function wireExistingTranscript() {
    if (!transcriptEl) return;
    var suggestionChips = transcriptEl.querySelectorAll('.suggestion-chip');
    for (var i = 0; i < suggestionChips.length; i++) {
      (function (chip) {
        chip.addEventListener('click', function () { sendMessage(chip.textContent); });
      })(suggestionChips[i]);
    }
    var actionRows = transcriptEl.querySelectorAll('.action-row');
    for (var j = 0; j < actionRows.length; j++) {
      wireActionRow(actionRows[j]);
    }
  }

  /* ── Message rendering ───────────────────────────────────────────── */

  function appendUserMessage(text) {
    var bubble = document.createElement('div');
    bubble.className = 'msg msg--user';
    bubble.textContent = text; // user-supplied text: textContent only, never innerHTML
    transcriptEl.appendChild(bubble);
    scrollToBottom();
  }

  function appendUniReply(reply) {
    var row = document.createElement('div');
    row.className = 'msg-row';

    var avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = uniAvatarSvg();
    row.appendChild(avatar);

    var bubble = document.createElement('div');
    bubble.className = 'msg msg--uni';

    var p = document.createElement('p');
    p.className = 'msg__text';
    renderRichText(p, reply.text);
    bubble.appendChild(p);

    if (reply.colleges && reply.colleges.length) {
      var cardList = document.createElement('div');
      cardList.className = 'college-list';
      reply.colleges.forEach(function (college) {
        cardList.appendChild(buildCollegeCard(college));
      });
      bubble.appendChild(cardList);
    }

    if (reply.sources && reply.sources.length) {
      bubble.appendChild(buildSourcesBlock(reply.sources));
    }

    bubble.appendChild(buildActionRow(reply));

    row.appendChild(bubble);
    transcriptEl.appendChild(row);

    if (reply.suggestions && reply.suggestions.length) {
      transcriptEl.appendChild(buildSuggestions(reply.suggestions));
    }

    scrollToBottom();
  }

  function buildCollegeCard(college) {
    var card = document.createElement('div');
    card.className = 'college-card';

    var icon = document.createElement('div');
    icon.className = 'college-card__icon';
    icon.innerHTML = collegeIconSvg();
    card.appendChild(icon);

    var info = document.createElement('div');
    info.className = 'college-card__info';
    var nameRow = document.createElement('div');
    nameRow.className = 'college-card__name-row';
    var name = document.createElement('div');
    name.className = 'college-card__name';
    name.textContent = college.name;
    nameRow.appendChild(name);

    var mobileChip = document.createElement('span');
    mobileChip.className = 'chip chip--compact ' + (CHANCE_CLASS[college.chance] || 'chip--unlikely');
    mobileChip.textContent = college.chance;
    nameRow.appendChild(mobileChip);
    info.appendChild(nameRow);

    var subtitle = document.createElement('div');
    subtitle.className = 'college-card__subtitle';
    subtitle.textContent = college.subtitle;
    info.appendChild(subtitle);

    var compactMeta = document.createElement('div');
    compactMeta.className = 'college-card__compact-meta';
    compactMeta.textContent = 'Close ' + college.closing + ' · ' + college.total + ' / 4 yrs';
    info.appendChild(compactMeta);

    card.appendChild(info);

    card.appendChild(buildStat(college.closingLabel, college.closing));
    card.appendChild(buildStat(college.totalLabel, college.total));

    var chip = document.createElement('span');
    chip.className = 'chip chip--full ' + (CHANCE_CLASS[college.chance] || 'chip--unlikely');
    chip.textContent = college.chance;
    card.appendChild(chip);

    return card;
  }

  function buildStat(label, value) {
    var wrap = document.createElement('div');
    wrap.className = 'college-card__stat';
    var l = document.createElement('div');
    l.className = 'college-card__stat-label';
    l.textContent = label;
    var v = document.createElement('div');
    v.className = 'college-card__stat-value';
    v.textContent = value;
    wrap.appendChild(l);
    wrap.appendChild(v);
    return wrap;
  }

  function buildSourcesBlock(sources) {
    var block = document.createElement('div');
    block.className = 'sources';

    var icon = document.createElement('span');
    icon.className = 'sources__icon';
    icon.innerHTML = shieldSvg();
    block.appendChild(icon);

    var label = document.createElement('span');
    label.className = 'sources__label';
    label.textContent = 'Sources';
    block.appendChild(label);

    sources.forEach(function (src) {
      var chip = document.createElement('span');
      chip.className = 'sources__chip';
      chip.textContent = src.label;
      block.appendChild(chip);
    });

    var checked = document.createElement('span');
    checked.className = 'sources__checked';
    checked.textContent = CHECKED_ON_LABEL;
    block.appendChild(checked);

    return block;
  }

  /** Plain-text rendition of a reply, for the WhatsApp share link (PRD C-07).
   *  Strips the <strong>/<em> markup the provider contract allows and folds
   *  the college list into readable lines. */
  function buildPlainTextSummary(reply) {
    var lines = [stripTags(reply.text)];
    (reply.colleges || []).forEach(function (college, i) {
      lines.push(
        (i + 1) + '. ' + college.name + ' — ' + college.subtitle + ' — ' +
        college.closingLabel + ' ' + college.closing + ' · ' +
        college.totalLabel + ' ' + college.total + ' · ' + college.chance
      );
    });
    return lines.join('\n');
  }

  function buildActionRow(reply) {
    var row = document.createElement('div');
    row.className = 'action-row';

    var whatsapp = document.createElement('a');
    whatsapp.className = 'action-row__btn action-row__whatsapp';
    whatsapp.target = '_blank';
    whatsapp.rel = 'noopener';
    whatsapp.href = 'https://wa.me/?text=' + encodeURIComponent(buildPlainTextSummary(reply));
    whatsapp.innerHTML = whatsappSvg() + ' ';
    whatsapp.appendChild(document.createTextNode('Share on WhatsApp'));
    row.appendChild(whatsapp);

    var pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.className = 'action-row__btn action-row__pdf';
    pdfBtn.innerHTML = pdfSvg() + ' ';
    pdfBtn.appendChild(document.createTextNode('Download as PDF'));
    row.appendChild(pdfBtn);

    wireActionRow(row);

    return row;
  }

  /** Attaches behaviour to an action row already in the DOM — used both for
   *  rows built dynamically above and for the statically server-rendered
   *  seed row in chat.html. The WhatsApp link needs no JS (it is a real
   *  href); only the PDF button needs a click handler to call window.print(). */
  function wireActionRow(row) {
    var pdfBtn = row.querySelector('.action-row__pdf');
    if (pdfBtn && !pdfBtn.__wired) {
      pdfBtn.__wired = true;
      pdfBtn.addEventListener('click', function () { window.print(); });
    }
  }

  function buildSuggestions(list) {
    var wrap = document.createElement('div');
    wrap.className = 'suggestions';
    list.forEach(function (text) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'suggestion-chip';
      chip.textContent = text;
      chip.addEventListener('click', function () { sendMessage(text); });
      wrap.appendChild(chip);
    });
    return wrap;
  }

  function buildTypingIndicator() {
    var row = document.createElement('div');
    row.className = 'msg-row';
    row.id = 'typingRow';

    var avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = uniAvatarSvg();
    row.appendChild(avatar);

    var bubble = document.createElement('div');
    bubble.className = 'msg msg--uni msg--typing';
    for (var i = 0; i < 3; i++) {
      var dot = document.createElement('span');
      dot.className = 'typing-dot';
      bubble.appendChild(dot);
    }
    row.appendChild(bubble);
    return row;
  }

  /* ── Composer / send flow ────────────────────────────────────────── */

  function wireComposer() {
    composerInput.addEventListener('input', updateSendState);
    composerInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        trySend();
      }
    });
    sendBtn.addEventListener('click', trySend);
    updateSendState();
  }

  function updateSendState() {
    var hasText = composerInput.value.trim().length > 0;
    sendBtn.disabled = !hasText;
    sendBtn.setAttribute('aria-disabled', String(!hasText));
  }

  function trySend() {
    var text = composerInput.value.trim();
    if (!text) return;
    composerInput.value = '';
    updateSendState();
    sendMessage(text);
  }

  var history = [];

  function sendMessage(text) {
    appendUserMessage(text);
    history.push({ role: 'user', text: text });

    var typingRow = buildTypingIndicator();
    transcriptEl.appendChild(typingRow);
    scrollToBottom();

    var provider = (window.UniChat && window.UniChat.provider) || null;
    var promise = provider
      ? provider.send(text, history.slice())
      : Promise.resolve({ text: 'Chat is unavailable right now.', colleges: [], sources: [{ label: 'UniVerse', checkedOn: '12 Aug 2026' }], suggestions: [] });

    promise
      .then(function (reply) {
        var row = document.getElementById('typingRow');
        if (row) row.remove();
        history.push({ role: 'uni', text: reply.text });
        appendUniReply(reply);
      })
      .catch(function () {
        var row = document.getElementById('typingRow');
        if (row) row.remove();
        appendUniReply({
          text: 'Something went wrong reaching Uni AI. Please try again.',
          colleges: [],
          sources: [{ label: 'UniVerse', checkedOn: '12 Aug 2026' }],
          suggestions: []
        });
      });
  }

  function scrollToBottom() {
    var scroller = document.getElementById('transcriptScroller');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }

  /* ── Icons (static, non-user-controlled markup) ──────────────────── */
  /* Sourced from assets/js/icons.js (official Lucide path data, inlined —
     see docs/SPEC.md §3, §9). All decorative: Icons.svg() always marks its
     output aria-hidden + non-focusable, and every call site here places the
     icon next to a visible label or inside a control that already carries
     its own aria-label, so no accessible name is lost. */

  function uniAvatarSvg() {
    return window.Icons ? window.Icons.svg('graduation-cap', 20, { stroke: '#fff' }) : '';
  }

  function collegeIconSvg() {
    return window.Icons ? window.Icons.svg('landmark', 20, { stroke: '#3D5CD8' }) : '';
  }

  function shieldSvg() {
    return window.Icons ? window.Icons.svg('shield-check', 16, { stroke: '#5A5F80' }) : '';
  }

  function whatsappSvg() {
    return window.Icons ? window.Icons.svg('message-circle', 14) : '';
  }

  function pdfSvg() {
    return window.Icons ? window.Icons.svg('download', 14) : '';
  }
})();
