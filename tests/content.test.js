// tests/content.test.js — PRD §6.4 S-01..S-12
// Static assertions over the shipped HTML/JS source text. No DOM parsing —
// plain fs.readFileSync + string/regex checks per PRD.

import { describe, it, expect } from 'vitest';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const CHAT_PATH = path.join(ROOT, 'chat.html');
const JS_DIR = path.join(ROOT, 'assets', 'js');

// Valid HTML escapes "&" as "&amp;" in text content, so string checks below
// decode that one entity to compare against the plain copy quoted in
// docs/SPEC.md / docs/PRD.md.
function decodeAmp(html) {
  return html.replace(/&amp;/g, '&');
}
function readIndex() {
  return decodeAmp(fs.readFileSync(INDEX_PATH, 'utf8'));
}
function readChat() {
  return decodeAmp(fs.readFileSync(CHAT_PATH, 'utf8'));
}

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

describe('content — PRD §6.4', () => {
  it('S-01 index.html contains no raw source domains', () => {
    const html = readIndex();
    for (const domain of ['hte.rajasthan.gov.in', 'reap2026.in', 'targetadmission.com']) {
      expect(html).not.toContain(domain);
    }
  });

  it('S-02 index.html carries the replacement authority labels', () => {
    const html = readIndex();
    expect(html).toContain('Official government records');
    expect(html).toContain('Examination authority');
    expect(html).toContain('Counselling & admissions authority');
  });

  it('S-03 footer credit line is rewritten', () => {
    const html = readIndex();
    expect(html).toContain('official government, examination and counselling authority records');
  });

  it('S-04 hero copy is verbatim', () => {
    const html = readIndex();
    expect(html).toContain('Admission season can be confusing.');
    expect(html).toContain("We're here to help.");
  });

  it('S-05 predictor disclaimer is verbatim', () => {
    const html = readIndex();
    expect(html).toContain(
      'Predictions are guidance, not a guarantee — 2026 cutoffs move with seat matrix and applicant count. Uni AI flags every change as DTE publishes it.',
    );
  });

  it('S-06 chat composer safety footnote is verbatim', () => {
    const html = readChat();
    expect(html).toContain(
      'Uni AI answers only from verified DTE and REAP records. Always confirm final figures on the official portal before paying.',
    );
  });

  it('S-07 all 6 feature card headings are present', () => {
    const html = readIndex();
    const headings = [
      'Category-wise cutoffs',
      'Real fee structures',
      'Scholarships you qualify for',
      'Placement reality check',
      'Counselling dates & steps',
      'A verified database behind it',
    ];
    for (const heading of headings) {
      expect(html).toContain(heading);
    }
  });

  it('S-08 all 3 testimonial attributions are present and the swap note is gone', () => {
    const html = readIndex();
    for (const attribution of ['Priyanka S.', 'Ramesh M.', 'Aman K.']) {
      expect(html).toContain(attribution);
    }
    // Removed by request 2026-08-16 — placeholder note must not ship.
    expect(html).not.toContain('Sample quotes');
    // The old heading's sleep metaphor was replaced.
    expect(html).not.toContain('Parents slept');
  });

  it('S-09 each page has exactly one h1', () => {
    for (const [name, html] of [['index.html', readIndex()], ['chat.html', readChat()]]) {
      const matches = html.match(/<h1[\s>]/g) || [];
      expect(matches.length, `${name} has ${matches.length} <h1> elements`).toBe(1);
    }
  });

  it('S-10 neither page references the mockup runtime (support.js / x-dc)', () => {
    for (const [name, html] of [['index.html', readIndex()], ['chat.html', readChat()]]) {
      expect(html, `${name} references support.js`).not.toContain('support.js');
      expect(html, `${name} references x-dc`).not.toMatch(/x-dc/);
    }
  });

  it('S-11 no ES modules ship in assets/js/', () => {
    const files = fs.existsSync(JS_DIR) ? walkFiles(JS_DIR).filter((f) => f.endsWith('.js')) : [];
    expect(files.length, 'assets/js/ has no .js files to check').toBeGreaterThan(0);
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src, `${file} uses type="module"`).not.toMatch(/type=["']module["']/);
      expect(src, `${file} uses a bare import statement`).not.toMatch(/^\s*import\s.+from\s/m);
    }
  });

  it('S-12 chat.html retains its per-answer Sources block', () => {
    const html = readChat();
    expect(html).toContain('Sources');
    expect(html).toContain('CHECKED 12 AUG 2026');
  });

  // ── Revision 2026-08-16 ────────────────────────────────────────────────
  // Nav/footer trim, Uni AI rename, privacy page, favicon, honest actions.

  it('S-13 navbar carries only Home and the Ask Uni AI CTA', () => {
    const html = readIndex();
    for (const removed of ['>Colleges<', 'Fees & Scholarships']) {
      expect(html, `nav still contains ${removed}`).not.toContain(removed);
    }
    expect(html).toContain('Ask Uni AI');
    const navLinks = (html.match(/class="nav-link/g) || []).length;
    expect(navLinks, 'expected exactly one nav-link (Home)').toBe(1);
  });

  it('S-14 footer is trimmed to email only, with Terms removed', () => {
    const html = readIndex();
    expect(html).toContain('ammaarbaig2006@gmail.com');
    expect(html).toContain('mailto:ammaarbaig2006@gmail.com');
    for (const removed of [
      'help@universe.ai',
      '+91 141 000 0000',
      '9am–9pm',
      'Jaipur, Rajasthan 302001',
      'Category & reservation',
      'Choice-filling strategy',
      '>Terms<',
    ]) {
      expect(html, `footer still contains ${removed}`).not.toContain(removed);
    }
    expect(html, 'footer still links an all-colleges page').not.toMatch(/All \d+ colleges/);
  });

  it('S-15 the assistant is named "Uni AI" with no standalone "Uni" left', () => {
    for (const [name, html] of [['index.html', readIndex()], ['chat.html', readChat()]]) {
      // A bare "Uni" followed by a lowercase word is the un-renamed product noun.
      // "UniVerse", "University", "Uni AI" and identifiers must not match.
      expect(html, `${name} has an un-renamed standalone "Uni"`).not.toMatch(/\bUni (?!AI\b)[a-z]/);
      expect(html, `${name} has a botched rename`).not.toContain('Uni AIVerse');
      expect(html, `${name} has a botched rename`).not.toContain('Uni AIversity');
    }
  });

  it('S-16 privacy.html exists, is linked, and covers chat and predictor data', () => {
    const privacyPath = path.join(ROOT, 'privacy.html');
    expect(fs.existsSync(privacyPath), 'privacy.html is missing').toBe(true);
    const html = decodeAmp(fs.readFileSync(privacyPath, 'utf8'));
    expect((html.match(/<h1[\s>]/g) || []).length).toBe(1);
    expect(html).toContain('ammaarbaig2006@gmail.com');
    expect(html.toLowerCase()).toContain('chat');
    expect(html.toLowerCase()).toContain('predictor');
    expect(readIndex(), 'index.html does not link privacy.html').toContain('privacy.html');
  });

  it('S-17 every page declares the logo as its favicon', () => {
    const pages = ['index.html', 'chat.html', 'privacy.html'];
    for (const page of pages) {
      const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
      expect(html, `${page} has no favicon link`).toMatch(
        /<link[^>]+rel=["']icon["'][^>]+assets\/img\/uni-logo\.png/,
      );
    }
  });

  it('S-18 chat action row is functional, not decorative', () => {
    const html = readChat();
    // WhatsApp must be a real outbound link, not an inert span.
    expect(html).toMatch(/href=["']https:\/\/wa\.me\/\?text=/);
    expect(html).toContain('rel="noopener"');
    // PDF must actually trigger print, and print styles must exist.
    const css = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'chat.css'), 'utf8');
    expect(css, 'chat.css has no print stylesheet').toMatch(/@media\s+print/);
    // Theatre removed.
    expect(html, 'inert "Save this list" still renders').not.toContain('Save this list');
    expect(html, 'inert "Was this helpful?" still renders').not.toContain('Was this helpful?');
  });

  // ── Revision 2026-08-16b — Zapier embed, sources modal, CTA + mailto ──

  it('S-20 chat.html embeds the real Zapier chatbot', () => {
    const html = readChat();
    expect(html).toContain('zapier-interfaces-chatbot-embed');
    expect(html, 'chatbot-id missing or changed').toContain('cmssq12dm000nin6vyq3gnuyd');
    expect(html, 'Zapier module script not loaded').toMatch(
      /interfaces\.zapier\.com\/assets\/web-components/,
    );
    expect(html, "embed must not keep the snippet's 400px demo width").not.toMatch(
      /width=['"]400px['"]/,
    );
  });

  it('S-21 the local chat survives and is gated behind ?chat=local', () => {
    const html = readChat();
    // Local UI must remain in the source — S-12/S-18 assert on it.
    expect(html).toContain('local-chat-only');
    const ui = fs.readFileSync(path.join(JS_DIR, 'chat-ui.js'), 'utf8');
    expect(ui, 'chat-ui.js does not read the ?chat=local flag').toMatch(/chat=local|['"]local['"]/);
    expect(ui).toContain('chat-mode-local');
    // The hide rule must out-specify later single-class rules (e.g. .composer__box
    // { display:flex }), or the local composer leaks in below the Zapier embed.
    const css = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'chat.css'), 'utf8');
    expect(css, 'local-chat hide rule is not specificity-safe').toMatch(
      /body:not\(\.chat-mode-local\)\s+\.local-chat-only\s*\{[^}]*display:\s*none\s*!important/,
    );
  });

  it('S-22 the sources modal is a classic script that leaks no URLs', () => {
    const js = fs.readFileSync(path.join(JS_DIR, 'sources-modal.js'), 'utf8');
    expect(js).not.toMatch(/type=["']module["']/);
    expect(js).not.toMatch(/^\s*import\s.+from\s/m);
    for (const domain of ['hte.rajasthan.gov.in', 'reap2026.in', 'targetadmission.com']) {
      expect(js, `modal leaks ${domain}`).not.toContain(domain);
    }
    expect(js, 'modal contains a bare URL').not.toMatch(/https?:\/\//);
  });

  it('S-23 the modal discloses that most cutoff figures are estimated', () => {
    const js = fs.readFileSync(path.join(JS_DIR, 'sources-modal.js'), 'utf8');
    // The honesty section is the whole point of this modal — it must survive edits.
    expect(js.toLowerCase()).toMatch(/estimate/);
    expect(js.toLowerCase()).toMatch(/cutoff/);
    expect(js.toLowerCase()).toMatch(/not affiliated/);
  });

  it('S-24 every page loads and triggers the sources modal', () => {
    for (const page of ['index.html', 'chat.html', 'privacy.html']) {
      const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
      expect(html, `${page} missing modal stylesheet`).toContain('assets/css/sources-modal.css');
      expect(html, `${page} missing modal script`).toContain('assets/js/sources-modal.js');
      expect(html, `${page} has no modal trigger`).toContain('data-sources-modal');
    }
  });

  it('S-25 the secondary hero CTA is relabelled and mailto links work', () => {
    const html = readIndex();
    expect(html, 'old CTA label still present').not.toContain('Predict my colleges');
    expect(html).toContain('Match my rank to colleges');
    for (const page of ['index.html', 'privacy.html']) {
      const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
      expect(src, `${page} has no mailto link`).toContain('mailto:ammaarbaig2006@gmail.com');
    }
  });

  it('S-26 no API key ships, and the config template is empty', () => {
    const shipped = ['index.html', 'chat.html', 'privacy.html'].map((p) =>
      fs.readFileSync(path.join(ROOT, p), 'utf8'),
    );
    for (const file of walkFiles(JS_DIR).filter((f) => f.endsWith('.js'))) {
      shipped.push(fs.readFileSync(file, 'utf8'));
    }
    for (const src of shipped) {
      expect(src, 'a live API key is present in a shipped file').not.toMatch(/sk-[A-Za-z0-9_-]{12,}/);
    }
    // The committed template must never carry a real value.
    const example = fs.readFileSync(path.join(JS_DIR, 'config.example.js'), 'utf8');
    expect(example).toMatch(/OPENCODE_API_KEY:\s*['"]['"]/);
    // The real config must not be committed.
    expect(
      fs.existsSync(path.join(JS_DIR, 'config.local.js')),
      'config.local.js should never be committed',
    ).toBe(false);
    // .gitignore must actually cover the secrets.
    const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/config\.local\.js/);
  });

  it('S-19 the chat sidebar is gone and the shared header is used', () => {
    const html = readChat();
    expect(html, 'chat.html does not link universe.css').toContain('assets/css/universe.css');
    expect(html).toContain('class="site-header"');
    expect(html, 'sidebar markup still present').not.toMatch(/class="[^"]*sidebar/);
    expect(html, 'New question control missing').toContain('New question');
  });
});
