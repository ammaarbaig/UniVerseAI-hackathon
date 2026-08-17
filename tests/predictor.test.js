// tests/predictor.test.js — PRD §6.1 P-01..P-19
// Loads assets/js/predictor.js as a CommonJS module (classic script with a
// dual export guard). Written against docs/SPEC.md §6, not against whatever
// happens to be on disk.

import { describe, it, expect, beforeAll } from 'vitest';

const fs = require('fs');
const path = require('path');

const PREDICTOR_PATH = path.join(__dirname, '..', 'assets', 'js', 'predictor.js');

// Loaded lazily in beforeAll (rather than at module top level) so that a
// missing/broken predictor.js produces 19 clearly-failing P-xx tests instead
// of aborting the whole file's collection.
let Predictor;
beforeAll(() => {
  Predictor = require(PREDICTOR_PATH);
});

function makeCollege(id, overrides = {}) {
  return {
    id,
    name: `College ${id}`,
    shortName: `Col ${id}`,
    level: 'Engineering',
    type: 'Government',
    city: 'Ajmer',
    district: 'Ajmer',
    affiliation: 'BTER / DTE',
    established: 1990,
    fee: 70000,
    feeLabel: '₹70k',
    fourYearTotal: '₹2.8 L',
    placed: 60,
    seats: 100,
    sourceUrl: 'https://example.com',
    sourceStatus: 'SECONDARY',
    ...overrides,
  };
}

function makeCutoff(collegeId, branch, category, closing, overrides = {}) {
  return { collegeId, branch, category, year: 2025, closing, source: 'DEMO', ...overrides };
}

// Fixture used by the sort-order / tie-break / headline tests (P-09..P-12).
// Rank fixed at 10,000. Thresholds: Safe >= 12500, Likely >= 9800, Reach >= 8200.
function buildSortFixture() {
  const colleges = [
    makeCollege('A', { name: 'College A' }), // Safe, closing 13500
    makeCollege('B', { name: 'College B' }), // Safe, closing 13000 (should sort before A)
    makeCollege('C', { name: 'College C' }), // Likely, closing 9900
    makeCollege('D', { name: 'College D' }), // Reach, closing 8300
    makeCollege('E', { name: 'College E' }), // Unlikely, closing 5000
  ];
  const cutoffs = [
    makeCutoff('A', 'CSE', 'OBC-NCL', 13500),
    makeCutoff('B', 'CSE', 'OBC-NCL', 13000),
    makeCutoff('C', 'CSE', 'OBC-NCL', 9900),
    makeCutoff('D', 'CSE', 'OBC-NCL', 8300),
    makeCutoff('E', 'CSE', 'OBC-NCL', 5000),
  ];
  return { colleges, cutoffs };
}

describe('predictor.js — PRD §6.1', () => {
  it('P-01 Safe lower boundary is inclusive', () => {
    expect(10000).toBe(8000 * 1.25);
    expect(Predictor.classify(8000, 10000).chance).toBe('Safe');
  });

  it('P-02 just below Safe boundary is Likely', () => {
    expect(Predictor.classify(8000, 9999).chance).toBe('Likely');
  });

  it('P-03 Likely lower boundary is inclusive', () => {
    expect(9800).toBe(10000 * 0.98);
    expect(Predictor.classify(10000, 9800).chance).toBe('Likely');
  });

  it('P-04 just below Likely boundary is Reach', () => {
    expect(Predictor.classify(10000, 9799).chance).toBe('Reach');
  });

  it('P-05 Reach lower boundary is inclusive', () => {
    expect(8200).toBe(10000 * 0.82);
    expect(Predictor.classify(10000, 8200).chance).toBe('Reach');
  });

  it('P-06 just below Reach boundary is Unlikely', () => {
    expect(Predictor.classify(10000, 8199).chance).toBe('Unlikely');
  });

  it('P-07 chip colours match the band', () => {
    expect(Predictor.classify(8000, 10000)).toMatchObject({ chipBg: '#E4F5EA', chipFg: '#2F7A4A' });
    expect(Predictor.classify(10000, 9800)).toMatchObject({ chipBg: '#E6EEFC', chipFg: '#2C55B8' });
    expect(Predictor.classify(10000, 8200)).toMatchObject({ chipBg: '#FFF0DC', chipFg: '#A96A15' });
    expect(Predictor.classify(10000, 8199)).toMatchObject({ chipBg: '#F3F0F6', chipFg: '#7A6E86' });
  });

  it('P-08 mockup parity: rank 8420, OBC-NCL', () => {
    // Verified arithmetically: 8420*1.25=10525, 8420*0.98=8251.6, 8420*0.82=6904.4
    expect(Predictor.classify(8420, 11240).chance).toBe('Safe');
    expect(Predictor.classify(8420, 9860).chance).toBe('Likely');
    expect(Predictor.classify(8420, 8470).chance).toBe('Likely');
  });

  it('P-09 results sort non-decreasing in Safe,Likely,Reach,Unlikely order', () => {
    const { colleges, cutoffs } = buildSortFixture();
    const results = Predictor.predict(10000, 'OBC-NCL', 'CSE', colleges, cutoffs);
    const order = { Safe: 0, Likely: 1, Reach: 2, Unlikely: 3 };
    const ranks = results.map((r) => order[r.chance]);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
    }
  });

  it('P-10 equal chance ties break by ascending closing', () => {
    const { colleges, cutoffs } = buildSortFixture();
    const results = Predictor.predict(10000, 'OBC-NCL', 'CSE', colleges, cutoffs);
    const safes = results.filter((r) => r.chance === 'Safe');
    expect(safes.length).toBe(2);
    expect(safes[0].closing).toBe(13000);
    expect(safes[1].closing).toBe(13500);
  });

  it('P-11 headline text matches the documented format', () => {
    const { colleges, cutoffs } = buildSortFixture();
    const results = Predictor.predict(10000, 'OBC-NCL', 'CSE', colleges, cutoffs);
    const headline = Predictor.headline(results, colleges.length, 'CSE', 'OBC-NCL');
    expect(headline).toMatch(/^\d+ of \d+ colleges match — .+, .+$/);
  });

  it('P-12 headline count excludes Unlikely results', () => {
    const { colleges, cutoffs } = buildSortFixture();
    const results = Predictor.predict(10000, 'OBC-NCL', 'CSE', colleges, cutoffs);
    const nonUnlikely = results.filter((r) => r.chance !== 'Unlikely').length;
    const headline = Predictor.headline(results, colleges.length, 'CSE', 'OBC-NCL');
    const match = headline.match(/^(\d+) of (\d+) colleges match/);
    expect(match).toBeTruthy();
    expect(Number(match[1])).toBe(nonUnlikely);
    expect(nonUnlikely).toBe(4); // A,B,C,D are not Unlikely; E is
  });

  it('P-13 formatRank uses en-IN grouping', () => {
    expect(Predictor.formatRank(8420)).toBe('8,420');
    expect(Predictor.formatRank(1240000)).toBe('12,40,000');
  });

  it('P-14 unknown category returns [] without throwing', () => {
    const { colleges, cutoffs } = buildSortFixture();
    expect(() => Predictor.predict(8420, 'XYZ', 'CSE', colleges, cutoffs)).not.toThrow();
    expect(Predictor.predict(8420, 'XYZ', 'CSE', colleges, cutoffs)).toEqual([]);
  });

  it('P-15 unknown branch returns [] without throwing', () => {
    const { colleges, cutoffs } = buildSortFixture();
    expect(() => Predictor.predict(8420, 'OBC-NCL', 'XYZ', colleges, cutoffs)).not.toThrow();
    expect(Predictor.predict(8420, 'OBC-NCL', 'XYZ', colleges, cutoffs)).toEqual([]);
  });

  it('P-16 rank coercion: string, float and int ranks are identical', () => {
    const { colleges, cutoffs } = buildSortFixture();
    const fromString = Predictor.predict('8420', 'OBC-NCL', 'CSE', colleges, cutoffs);
    const fromFloat = Predictor.predict(8420.7, 'OBC-NCL', 'CSE', colleges, cutoffs);
    const fromInt = Predictor.predict(8420, 'OBC-NCL', 'CSE', colleges, cutoffs);
    expect(fromString).toEqual(fromInt);
    expect(fromFloat).toEqual(fromInt);
  });

  it('P-17 rank is clamped to 1..200000', () => {
    const { colleges, cutoffs } = buildSortFixture();
    const zero = Predictor.predict(0, 'OBC-NCL', 'CSE', colleges, cutoffs);
    const negative = Predictor.predict(-5, 'OBC-NCL', 'CSE', colleges, cutoffs);
    const atOne = Predictor.predict(1, 'OBC-NCL', 'CSE', colleges, cutoffs);
    expect(zero).toEqual(atOne);
    expect(negative).toEqual(atOne);

    const huge = Predictor.predict(9e9, 'OBC-NCL', 'CSE', colleges, cutoffs);
    const atMax = Predictor.predict(200000, 'OBC-NCL', 'CSE', colleges, cutoffs);
    expect(huge).toEqual(atMax);
  });

  it('P-18 predict does not mutate its colleges or cutoffs arguments', () => {
    const { colleges, cutoffs } = buildSortFixture();
    const collegesCopy = JSON.parse(JSON.stringify(colleges));
    const cutoffsCopy = JSON.parse(JSON.stringify(cutoffs));
    Predictor.predict(10000, 'OBC-NCL', 'CSE', colleges, cutoffs);
    expect(colleges).toEqual(collegesCopy);
    expect(cutoffs).toEqual(cutoffsCopy);
  });

  it('P-19 predictor.js has no DOM reference outside the export guard', () => {
    const src = fs.readFileSync(PREDICTOR_PATH, 'utf8');
    // Strip the dual-export guard lines (SPEC §3.1) wherever they occur —
    // they legitimately reference `window.` / `module.exports`. Everything
    // else in the file must be DOM-free, whether or not the guard sits at
    // the very end of the file (e.g. inside a trailing IIFE close).
    const body = src
      .split('\n')
      .filter((line) => !/module\.exports\s*=/.test(line) && !/typeof window[^)]*\)\s*(window|__g)\.\w+\s*=/.test(line))
      .join('\n');
    expect(body).not.toMatch(/\bdocument\b/);
    expect(body).not.toMatch(/window\./);
  });
});
