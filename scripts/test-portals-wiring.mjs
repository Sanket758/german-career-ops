#!/usr/bin/env node

/**
 * test-portals-wiring.mjs — regression tests for the portals.yml wiring.
 *
 * Why: the Berlin AI/retail research produced 155 companies with a
 * HTTP-verified careers_url. All of them must end up in portals.yml
 * `tracked_companies`, and the title filter must be able to select
 * AI/Python/Software/ML developer roles while rejecting logistics and
 * marketing roles.
 *
 * This test is deliberately SELF-CONTAINED: it does not import the
 * wiring script, so a bug in the normaliser cannot hide behind the
 * same bug in the test.
 *
 * Usage:
 *   node scripts/test-portals-wiring.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTALS = join(ROOT, 'portals.yml');
// The COMMITTED source of truth. The richer CSV next to it is *.csv and
// therefore gitignored in this repo, so a test that depended on it would
// pass locally and fail on a fresh clone.
const BLOCK = join(ROOT, 'research', 'berlin-ai-retail', 'portals-block.yml');

let fail = 0;
function check(ok, label, detail) {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : '  → ' + (detail ?? '')}`);
}

// Normalise a company name for comparison: strip accents, drop parentheticals,
// drop legal-form noise, collapse to alphanumerics.
function normalizeName(name) {
  let n = String(name).normalize('NFKD');
  n = n.replace(/[̀-ͯ]/g, '').toLowerCase();
  n = n.replace(/\([^)]*\)/g, ' ');
  n = n.replace(/\b(gmbh|mbh|ag|se|kg|ug|co|group|holding|ventures|technologies|technology|and|company|inc|ltd|ex)\b/g, ' ');
  n = n.replace(/[^a-z0-9]+/g, ' ');
  return n.trim().replace(/\s+/g, ' ');
}

// ── load ────────────────────────────────────────────────────────────────
if (!existsSync(PORTALS)) { console.error('FAIL  portals.yml missing'); process.exit(1); }
const cfg = yaml.load(readFileSync(PORTALS, 'utf-8'));
const companies = cfg.tracked_companies || [];
const tf = cfg.title_filter || { positive: [], negative: [] };

// ── 1. tracked_companies grew ───────────────────────────────────────────
check(companies.length >= 280, 'tracked_companies count >= 280 (was 132 before wiring)',
  `actual ${companies.length}`);

// ── 2. every research company is wired in ───────────────────────────────
const block = (yaml.load(readFileSync(BLOCK, 'utf-8')) || []).filter(e => e && e.name && e.careers_url);
const csvRows = block.map(e => ({ company: e.name, careers_url: e.careers_url }));
const tracked = new Set(companies.map(c => normalizeName(c.name)));
const missing = csvRows.filter(r => !tracked.has(normalizeName(r.company)));
check(missing.length === 0, `all ${csvRows.length} researched companies are in tracked_companies`,
  `missing: ${missing.slice(0, 6).map(m => m.company).join(', ')}${missing.length > 6 ? ` (+${missing.length - 6} more)` : ''}`);

// ── 3. every entry has a usable careers_url ─────────────────────────────
const noUrl = companies.filter(c => !c.careers_url || !String(c.careers_url).startsWith('http'));
check(noUrl.length === 0, 'every tracked_companies entry has an http(s) careers_url',
  `offenders: ${noUrl.slice(0, 5).map(c => c.name).join(', ')}`);

// ── 4. no duplicate careers_url ─────────────────────────────────────────
const urlCount = new Map();
for (const c of companies) {
  const u = (c.careers_url || '').replace(/\/+$/, '').toLowerCase();
  if (!u) continue;
  urlCount.set(u, (urlCount.get(u) || 0) + 1);
}
const dupUrls = [...urlCount.entries()].filter(([, n]) => n > 1);
check(dupUrls.length === 0, 'no two tracked_companies share a careers_url',
  `dupes: ${dupUrls.slice(0, 5).map(([u]) => u).join(', ')}`);

// ── 5. every wired-in entry has priority + enabled ──────────────────────
// Scoped to the researched companies: pre-existing entries (Zep AI, Maxim AI)
// predate this change and are not this task's responsibility.
const researchNames = new Set(csvRows.map(r => normalizeName(r.company)));
const missingMeta = companies.filter(c => researchNames.has(normalizeName(c.name)) && (!c.priority || c.enabled === undefined));
check(missingMeta.length === 0, 'every wired-in entry has priority and enabled keys',
  `offenders: ${missingMeta.slice(0, 5).map(c => c.name).join(', ')}`);

// ── 6. title_filter positives cover Software/Developer roles ───────────
const positives = tf.positive || [];
for (const kw of ['Software Engineer', 'Software Developer', 'Developer', 'Software']) {
  check(positives.includes(kw), `title_filter.positive includes "${kw}"`);
}

// ── 7. title_filter negatives block logistics + marketing ───────────────
const negatives = tf.negative || [];
for (const kw of ['Logistics', 'Logistik', 'Backend']) {
  check(negatives.includes(kw), `title_filter.negative includes "${kw}"`);
}
for (const kw of ['Marketing', 'Supply Chain']) {
  check(negatives.includes(kw), `title_filter.negative still includes "${kw}" (not removed)`);
}

// ── 8. negatives must win over positives ────────────────────────────────
// A role titled "Logistics Software Developer" matches positives
// (Software, Developer, Software Engineer) AND negatives (Logistics).
// The filter must reject it.
function buildTitleFilter(titleFilter) {
  const positive = (titleFilter?.positive || []).map(k => k.toLowerCase());
  const negative = (titleFilter?.negative || []).map(k => k.toLowerCase());
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = (k) =>
    k.length <= 3 && /^[a-z0-9]+$/.test(k)
      ? new RegExp(`(^|[^a-z0-9])${escapeRe(k)}([^a-z0-9]|$)`)
      : null;
  const has = (keyword, lower) => {
    const rx = matcher(keyword);
    return rx ? rx.test(lower) : lower.includes(keyword);
  };
  return (title) => {
    const lower = title.toLowerCase();
    const hasPositive = positive.length === 0 || positive.some(k => has(k, lower));
    const hasNegative = negative.some(k => has(k, lower));
    return hasPositive && !hasNegative;
  };
}
const tfFn = buildTitleFilter(tf);
check(tfFn('Senior Software Engineer – Retail AI') === true, 'filter accepts "Senior Software Engineer – Retail AI"');
check(tfFn('Python Developer') === true, 'filter accepts "Python Developer"');
check(tfFn('Logistics Software Developer') === false, 'filter rejects "Logistics Software Developer" (negative wins)');
check(tfFn('Marketing Automation Engineer') === false, 'filter rejects "Marketing Automation Engineer"');
check(tfFn('Backend Developer') === false, 'filter rejects "Backend Developer"');

console.log(fail === 0 ? '\nAll cases pass' : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
