// tests/data.test.js — PRD §6.2 D-01..D-16
// Loads assets/js/data.js as a CommonJS module. Written against docs/SPEC.md
// §5, not against whatever happens to be on disk.

import { describe, it, expect, beforeAll } from 'vitest';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'assets', 'js', 'data.js');
const BUILD_SCRIPT = path.join(ROOT, 'tools', 'build-data.py');
const WORKBOOK_PATH = path.join(ROOT, '2026.08-College-Database-final.xlsx');

const CATEGORIES = ['General', 'EWS', 'OBC-NCL', 'SC', 'ST'];
const BRANCHES = ['CSE', 'IT', 'ECE', 'Electrical', 'Mechanical', 'Civil', 'Chemical', 'AI & DS'];
const CATEGORY_ORDER = ['General', 'EWS', 'OBC-NCL', 'SC', 'ST']; // ascending closing per SPEC §6

let UNIVERSE_DATA;
beforeAll(() => {
  UNIVERSE_DATA = require(DATA_PATH);
});

describe('data.js — PRD §6.2', () => {
  it('D-01 loads in Node and yields an object', () => {
    expect(UNIVERSE_DATA).toBeTypeOf('object');
    expect(UNIVERSE_DATA).not.toBeNull();
  });

  it('D-02 college count is 115 and matches meta.collegeCount', () => {
    expect(UNIVERSE_DATA.colleges.length).toBe(115);
    expect(UNIVERSE_DATA.meta.collegeCount).toBe(UNIVERSE_DATA.colleges.length);
  });

  it('D-03 level split: 71 Diploma, 44 Engineering', () => {
    const diploma = UNIVERSE_DATA.colleges.filter((c) => c.level === 'Diploma');
    const engineering = UNIVERSE_DATA.colleges.filter((c) => c.level === 'Engineering');
    expect(diploma.length).toBe(71);
    expect(engineering.length).toBe(44);
  });

  it('D-04 no duplicate college ids', () => {
    const ids = UNIVERSE_DATA.colleges.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('D-05 every college has non-empty required fields', () => {
    for (const c of UNIVERSE_DATA.colleges) {
      for (const field of ['id', 'name', 'level', 'type', 'city', 'district']) {
        expect(c[field], `college ${c.id} missing ${field}`).toBeTruthy();
        expect(typeof c[field]).toBe('string');
      }
    }
  });

  it('D-06 every college has a cutoff for all 5 categories x 8 branches', () => {
    const key = (collegeId, branch, category) => `${collegeId}|${branch}|${category}`;
    const have = new Set(UNIVERSE_DATA.cutoffs.map((c) => key(c.collegeId, c.branch, c.category)));
    for (const college of UNIVERSE_DATA.colleges) {
      for (const branch of BRANCHES) {
        for (const category of CATEGORIES) {
          expect(have.has(key(college.id, branch, category)), `missing ${college.id}/${branch}/${category}`).toBe(true);
        }
      }
    }
  });

  it('D-07 every cutoff.collegeId matches a college', () => {
    const ids = new Set(UNIVERSE_DATA.colleges.map((c) => c.id));
    for (const cutoff of UNIVERSE_DATA.cutoffs) {
      expect(ids.has(cutoff.collegeId), `orphan cutoff for ${cutoff.collegeId}`).toBe(true);
    }
  });

  it('D-08 every cutoff.source is one of PRIMARY, SECONDARY, DEMO', () => {
    for (const cutoff of UNIVERSE_DATA.cutoffs) {
      expect(['PRIMARY', 'SECONDARY', 'DEMO']).toContain(cutoff.source);
    }
  });

  it('D-09 at least one cutoff carries a non-DEMO source', () => {
    const real = UNIVERSE_DATA.cutoffs.filter((c) => c.source !== 'DEMO');
    expect(real.length).toBeGreaterThanOrEqual(1);
  });

  it('D-10 generated rows (no workbook counterpart) are tagged DEMO', () => {
    // SPEC §5.3: the workbook holds ~30 real (PRIMARY/SECONDARY) rows; every
    // other combination is generated and must be tagged DEMO. A real count
    // wildly exceeding the workbook's ~30 rows would mean generated rows are
    // being mislabelled as real.
    const real = UNIVERSE_DATA.cutoffs.filter((c) => c.source !== 'DEMO');
    const demo = UNIVERSE_DATA.cutoffs.filter((c) => c.source === 'DEMO');
    expect(real.length).toBeLessThanOrEqual(30);
    expect(demo.length).toBeGreaterThan(real.length);
  });

  it('D-11 every cutoff.closing is a positive integer', () => {
    for (const cutoff of UNIVERSE_DATA.cutoffs) {
      expect(Number.isInteger(cutoff.closing), `non-integer closing for ${cutoff.collegeId}`).toBe(true);
      expect(cutoff.closing).toBeGreaterThan(0);
    }
  });

  it('D-12 category ordering: General <= EWS <= OBC-NCL <= SC <= ST', () => {
    const byCollegeBranch = new Map();
    for (const c of UNIVERSE_DATA.cutoffs) {
      const key = `${c.collegeId}|${c.branch}`;
      if (!byCollegeBranch.has(key)) byCollegeBranch.set(key, {});
      byCollegeBranch.get(key)[c.category] = c.closing;
    }
    for (const [key, byCategory] of byCollegeBranch) {
      const values = CATEGORY_ORDER.map((cat) => byCategory[cat]);
      for (let i = 1; i < values.length; i++) {
        expect(values[i], `${key}: ${CATEGORY_ORDER[i]} < ${CATEGORY_ORDER[i - 1]}`).toBeGreaterThanOrEqual(values[i - 1]);
      }
    }
  });

  it('D-13 branch ordering: CSE is the lowest closing rank for a fixed college+category', () => {
    const byCollegeCategory = new Map();
    for (const c of UNIVERSE_DATA.cutoffs) {
      const key = `${c.collegeId}|${c.category}`;
      if (!byCollegeCategory.has(key)) byCollegeCategory.set(key, {});
      byCollegeCategory.get(key)[c.branch] = c.closing;
    }
    for (const [key, byBranch] of byCollegeCategory) {
      const cse = byBranch['CSE'];
      for (const branch of BRANCHES) {
        if (branch === 'CSE') continue;
        expect(cse, `${key}: CSE not lowest vs ${branch}`).toBeLessThanOrEqual(byBranch[branch]);
      }
    }
  });

  it(
    'D-14 tools/build-data.py is deterministic (byte-identical output across runs)',
    () => {
      let original;
      try {
        original = fs.readFileSync(DATA_PATH);
      } catch (err) {
        throw new Error(`assets/js/data.js not present — cannot test determinism: ${err.message}`);
      }
      const hashOf = () => crypto.createHash('sha256').update(fs.readFileSync(DATA_PATH)).digest('hex');
      try {
        execFileSync('python', [BUILD_SCRIPT], { cwd: ROOT, stdio: 'pipe' });
        const hash1 = hashOf();
        execFileSync('python', [BUILD_SCRIPT], { cwd: ROOT, stdio: 'pipe' });
        const hash2 = hashOf();
        expect(hash1).toBe(hash2);
      } catch (err) {
        if (err && err.code === 'ENOENT') {
          throw new Error('python is not available on PATH — cannot verify build-data.py determinism');
        }
        throw err;
      } finally {
        fs.writeFileSync(DATA_PATH, original);
      }
    },
    60000,
  );

  it('D-15 real sheets carried: fees, scholarships, placements, faqs, glossary, contacts all non-empty', () => {
    for (const key of ['fees', 'scholarships', 'placements', 'faqs', 'glossary', 'contacts']) {
      expect(Array.isArray(UNIVERSE_DATA[key]), `${key} is not an array`).toBe(true);
      expect(UNIVERSE_DATA[key].length, `${key} is empty`).toBeGreaterThan(0);
    }
  });

  it(
    'D-16 every faqs[].id traces to a workbook FAQ_ID',
    () => {
      const pyScript = [
        'import openpyxl, json',
        `wb = openpyxl.load_workbook(r"${WORKBOOK_PATH}", read_only=True, data_only=True)`,
        "ws = wb['16_Chatbot_FAQ_Intents']",
        'rows = list(ws.iter_rows(values_only=True))',
        'headers = rows[0]',
        "idx = headers.index('FAQ_ID')",
        'ids = [str(r[idx]) for r in rows[1:] if r[idx] is not None]',
        'print(json.dumps(ids))',
      ].join('\n');
      let out;
      try {
        out = execFileSync('python', ['-c', pyScript], { cwd: ROOT, encoding: 'utf8' });
      } catch (err) {
        if (err && err.code === 'ENOENT') {
          throw new Error('python is not available on PATH — cannot verify faqs against the workbook');
        }
        throw new Error(`failed to read FAQ_ID from workbook: ${err.message}`);
      }
      const lastLine = out.trim().split('\n').pop();
      const workbookIds = new Set(JSON.parse(lastLine));
      for (const faq of UNIVERSE_DATA.faqs) {
        expect(workbookIds.has(String(faq.id)), `faq id ${faq.id} not found in workbook FAQ_ID column`).toBe(true);
      }
    },
    30000,
  );
});
