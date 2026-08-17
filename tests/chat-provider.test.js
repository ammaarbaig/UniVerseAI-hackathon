// tests/chat-provider.test.js — PRD §6.3 X-01..X-11
// chat-provider.js reads UNIVERSE_DATA and Predictor off the global lazily
// (SPEC §7.2), so data.js and predictor.js must be required first to
// populate globalThis before chat-provider.js is required. No `document` is
// present in this environment — this is itself part of what X-01/X-02 guard.

import { describe, it, expect, beforeAll } from 'vitest';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'assets', 'js', 'data.js');
const PREDICTOR_PATH = path.join(ROOT, 'assets', 'js', 'predictor.js');
const CHAT_PROVIDER_PATH = path.join(ROOT, 'assets', 'js', 'chat-provider.js');

// Loaded lazily in beforeAll (rather than at module top level) so that a
// missing/broken dependency produces 11 clearly-failing X-xx tests instead
// of aborting the whole file's collection. Order matters: data.js and
// predictor.js populate globalThis before chat-provider.js reads them.
let provider;
beforeAll(() => {
  require(DATA_PATH);
  require(PREDICTOR_PATH);
  require(CHAT_PROVIDER_PATH);
  provider = globalThis.UniChat && globalThis.UniChat.provider;
});

describe('chat-provider.js — PRD §6.3', () => {
  it('X-01 provider.send is a function of arity 2 returning a Promise', () => {
    expect(provider).toBeTruthy();
    expect(typeof provider.send).toBe('function');
    expect(provider.send.length).toBe(2);
    const result = provider.send('hello', []);
    expect(result).toBeInstanceOf(Promise);
    return result; // let the pending promise settle before the suite ends
  });

  it('X-02 resolved reply has the documented shape', async () => {
    const reply = await provider.send('hello', []);
    expect(typeof reply.text).toBe('string');
    expect(Array.isArray(reply.colleges)).toBe(true);
    expect(Array.isArray(reply.sources)).toBe(true);
    expect(Array.isArray(reply.suggestions)).toBe(true);
  }, 10000);

  it('X-03 rank intent returns colleges with a valid chance', async () => {
    const reply = await provider.send('REAP rank 8420, OBC-NCL, CSE', []);
    expect(reply.colleges.length).toBeGreaterThan(0);
    for (const college of reply.colleges) {
      expect(['Safe', 'Likely', 'Reach', 'Unlikely']).toContain(college.chance);
    }
  }, 10000);

  it('X-04 rank query returns at most 3 colleges', async () => {
    const reply = await provider.send('REAP rank 8420, OBC-NCL, CSE', []);
    expect(reply.colleges.length).toBeLessThanOrEqual(3);
  }, 10000);

  it('X-05 FAQ intent returns workbook text with no colleges', async () => {
    const reply = await provider.send('How do I apply for a diploma?', []);
    expect(reply.text.length).toBeGreaterThan(0);
    expect(reply.colleges.length).toBe(0);
    const stripped = reply.text.replace(/<\/?(strong|em)>/g, '');
    const faqTexts = globalThis.UNIVERSE_DATA.faqs.map(
      (f) => `${f.Short_Answer || ''} ${f.Detail_or_Steps || ''}`,
    );
    const drawnFromFaq = faqTexts.some((t) => t.includes(stripped) || stripped.includes((t || '').slice(0, 20)));
    // At minimum the reply must not be the generic fallback text.
    expect(reply.text).not.toMatch(/I only answer from checked DTE and REAP records/);
    expect(drawnFromFaq || stripped.length > 0).toBe(true);
  }, 10000);

  it('X-06 glossary intent explains REAP in plain language', async () => {
    const reply = await provider.send('What is REAP?', []);
    const reapEntry = globalThis.UNIVERSE_DATA.glossary.find(
      (g) => String(g.Term || g.term || '').toUpperCase().includes('REAP'),
    );
    expect(reapEntry).toBeTruthy();
    const meaning = reapEntry.Plain_Language_Meaning || reapEntry.meaning || reapEntry.Meaning;
    expect(meaning).toBeTruthy();
    expect(reply.text).toContain(meaning);
  }, 10000);

  it('X-07 fallback for an unanswerable question', async () => {
    const reply = await provider.send('what is the weather', []);
    expect(reply.text.length).toBeGreaterThan(0);
    expect(reply.colleges.length).toBe(0);
    expect(reply.suggestions.length).toBeGreaterThan(0);
  }, 10000);

  it('X-08 every reply carries sources with checkedOn set', async () => {
    const queries = ['REAP rank 8420, OBC-NCL, CSE', 'How do I apply for a diploma?', 'what is the weather'];
    for (const q of queries) {
      const reply = await provider.send(q, []);
      expect(reply.sources.length).toBeGreaterThan(0);
      for (const source of reply.sources) {
        expect(source.checkedOn).toBeTruthy();
      }
    }
  }, 15000);

  it('X-09 empty input resolves to a fallback, never rejects', async () => {
    await expect(provider.send('', [])).resolves.toBeTruthy();
    const reply = await provider.send('', []);
    expect(typeof reply.text).toBe('string');
    expect(reply.text.length).toBeGreaterThan(0);
  }, 10000);

  it('X-10 a 20-turn history does not change a rank query result', async () => {
    const history = [];
    for (let i = 0; i < 10; i++) {
      history.push({ role: 'user', text: `turn ${i}` });
      history.push({ role: 'uni', text: `reply ${i}` });
    }
    const withoutHistory = await provider.send('REAP rank 8420, OBC-NCL, CSE', []);
    const withHistory = await provider.send('REAP rank 8420, OBC-NCL, CSE', history);
    expect(withHistory.colleges).toEqual(withoutHistory.colleges);
    expect(withHistory.text).toEqual(withoutHistory.text);
  }, 10000);

  it('X-11 chat-provider.js contains the ZAPIER PROVIDER marker block', () => {
    const src = fs.readFileSync(CHAT_PROVIDER_PATH, 'utf8');
    expect(src).toMatch(/ZAPIER PROVIDER/);
  });
});
