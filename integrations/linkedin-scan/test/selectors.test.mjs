import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { chromium } from 'playwright';
import { scannerSource } from '../lib/inject.mjs';
import { ATOMIC_CLASS_RE } from '../lib/atomic.mjs';

const FIXTURE = resolve('integrations/linkedin-scan/fixtures/search-results.html');
const RENAMED = resolve('integrations/linkedin-scan/fixtures/search-results.atomic-renamed.html');
const GOLDEN = resolve('integrations/linkedin-scan/test/golden/cards.json');

let browser;
let page;

before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
});

after(async () => {
  await browser?.close();
});

async function load(file) {
  const p = await browser.newPage();
  // The suite must never reach the network: anything that is not the fixture
  // file is aborted, so a fixture that sneaks in a remote asset fails loudly
  // instead of quietly loading it.
  await p.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('about:')) {
      return route.continue();
    }
    return route.abort();
  });
  await p.goto('file://' + file, { waitUntil: 'domcontentloaded' });
  await p.addScriptTag({ content: scannerSource() });
  return p;
}

const NOW = Date.parse('2026-10-20T12:00:00.000Z');

async function extractAll(file) {
  const p = await load(file);
  const cards = await p.evaluate(
    (now) =>
      globalThis.__linkedinScan
        .findCards(document)
        .map((c) => globalThis.__linkedinScan.extractCard(c, { now })),
    NOW
  );
  const detail = await p.evaluate(() => globalThis.__linkedinScan.extractDetail(document));
  await p.close();
  return { cards, detail };
}

test('finds every job card in the fixture', async () => {
  const { cards } = await extractAll(FIXTURE);
  assert.equal(cards.length, 25);
  const ids = cards.map((c) => c.job_id);
  assert.equal(new Set(ids).size, 25, 'job ids must be unique');
  assert.ok(ids.every((id) => /^\d{6,}$/.test(id)), 'every card must carry a job id');
});

test('reads the title, company and location of a known card', async () => {
  const { cards } = await extractAll(FIXTURE);
  const card = cards.find((c) => c.job_id === '4478659811');
  assert.ok(card, 'card 4478659811 must be present');
  assert.equal(card.title, 'Computer Vision ML Engineer');
  assert.equal(card.title_norm, 'Computer Vision ML Engineer');
  assert.equal(card.company, 'XpertDirect');
  assert.equal(card.location_raw, 'Munich (Hybrid)');
  assert.equal(card.work_mode, 'hybrid');
  assert.equal(card.city, 'Munich');
  // The card does not name a country; the search geography does that job.
  assert.equal(card.country, null);
  assert.equal(card.url_canonical, 'https://www.linkedin.com/jobs/view/4478659811/');
});

test('keeps a multi-word company in one piece', async () => {
  const { cards } = await extractAll(FIXTURE);
  const card = cards.find((c) => c.job_id === '4481530978');
  assert.equal(card.title, 'AI & Automation Expert (f/m/d)');
  assert.equal(card.title_norm, 'AI & Automation Expert');
  assert.equal(card.company, 'Heitkamp & Thumann Group');
  assert.equal(card.city, 'Düsseldorf');
});

test('reads the work mode of an on-site role', async () => {
  const { cards } = await extractAll(FIXTURE);
  const card = cards.find((c) => c.job_id === '4477080142');
  assert.equal(card.title, 'Software Engineer C++ / Image Processing (m/f/d)');
  assert.equal(card.title_norm, 'Software Engineer C++ / Image Processing');
  assert.equal(card.company, 'Next Ventures');
  assert.equal(card.work_mode, 'onsite');
  assert.equal(card.salary_raw, '85K EUR/yr');
});

test('reads a disclosed salary range', async () => {
  const { cards } = await extractAll(FIXTURE);
  const card = cards.find((c) => c.job_id === '4478299911');
  assert.equal(card.title, 'Founding Engineer');
  assert.equal(card.company, 'AI Futures');
  assert.equal(card.salary_raw, '70K EUR/yr - 95K EUR/yr');
  assert.equal(card.city, 'Berlin');
  assert.equal(card.country, 'DE');
  assert.equal(card.work_mode, 'onsite');
});

test('never returns an empty company for a card that has one', async () => {
  const { cards } = await extractAll(FIXTURE);
  const missing = cards.filter((c) => !c.company);
  assert.deepEqual(
    missing.map((c) => c.job_id),
    [],
    'a card must not be reported without a company'
  );
});

test('records the Easy Apply badge separately from the other badges', async () => {
  const { cards } = await extractAll(FIXTURE);
  const card = cards.find((c) => c.job_id === '4480443245');
  assert.equal(card.easy_apply, true);
  assert.ok(card.badges.includes('Be an early applicant'));
  assert.ok(!card.badges.includes('Easy Apply'));
});

test('extracts the job description from the detail pane', async () => {
  const { detail } = await extractAll(FIXTURE);
  assert.ok(detail.jd_text.length > 300, 'the description must be more than 300 characters');
  assert.match(detail.jd_text, /Computer Vision/);
  assert.equal(detail.title, 'Computer Vision ML Engineer');
  assert.equal(detail.company, 'XpertDirect');
});

test('matches the golden record file', async () => {
  const { cards } = await extractAll(FIXTURE);
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  const slim = cards.map((c) => ({
    job_id: c.job_id,
    title: c.title,
    title_norm: c.title_norm,
    company: c.company,
    location_raw: c.location_raw,
    city: c.city,
    country: c.country,
    work_mode: c.work_mode,
    badges: c.badges,
    easy_apply: c.easy_apply,
    salary_raw: c.salary_raw,
  }));
  assert.deepEqual(slim, golden);
});

test('reads the posting age of a card', async () => {
  const { cards } = await extractAll(FIXTURE);
  const card = cards.find((c) => c.job_id === '4480443245');
  assert.equal(typeof card.posted_age_hours, 'number', 'the posting age must be parsed');
  // The exact age ages between captures, so only its shape is pinned.
  assert.match(card.posted_raw, /^Posted \d+ (minutes?|hours?|days?) ago$/);
  assert.equal(card.posted_at, new Date(NOW - card.posted_age_hours * 3600_000).toISOString());
});

test('takes the detail pane time from the pane, not from the results list', async () => {
  const { cards, detail } = await extractAll(FIXTURE);
  // The detail header writes the bare age ("3 hours ago"); a card writes the
  // prefixed one ("Posted 5 hours ago"). Reading the wrong pane is therefore
  // visible in the raw value, whatever the two jobs happen to be today.
  assert.match(detail.posted_raw, /^\d+ (minutes?|hours?|days?) ago$/);
  assert.equal(typeof detail.posted_age_hours, 'number');
  const firstCardAge = cards.find((c) => c.posted_raw)?.posted_raw ?? null;
  assert.notEqual(detail.posted_raw, firstCardAge);
});

test('does not let an inline icon label become a card line', async () => {
  const p = await browser.newPage();
  await p.setContent(
    '<div id="c"><p>Real Title</p><svg><title>Secret Icon Label</title></svg><p>Real Company</p></div>'
  );
  await p.addScriptTag({ content: scannerSource() });
  const lines = await p.evaluate(() => globalThis.__linkedinScan.textLines(document.getElementById('c')));
  await p.close();
  assert.deepEqual(lines, ['Real Title', 'Real Company']);
});

test('without an "About the job" section the description is empty and flagged', async () => {
  const p = await browser.newPage();
  await p.setContent('<main><h1>Some Job</h1><p>Some Company</p><p>Berlin (Hybrid)</p></main>');
  await p.addScriptTag({ content: scannerSource() });
  const detail = await p.evaluate(() => globalThis.__linkedinScan.extractDetail(document));
  await p.close();
  assert.equal(detail.jd_text, '');
  assert.equal(detail.jd_chars, 0);
  assert.equal(detail.jd_incomplete, true);
});

test('names the strategy that actually resolved each field', async () => {
  const { cards, detail } = await extractAll(FIXTURE);
  const card = cards[0];
  assert.equal(card.extraction.tiers.cardRoot, 'T0');
  assert.equal(card.extraction.tiers.cardTitle, 'T3');
  assert.equal(card.extraction.tiers.cardCompany, 'T3');
  assert.equal(detail.extraction.tiers.detailJD, 'T0');
  assert.equal(detail.extraction.tiers.detailTitle, 'T0');
  assert.equal(detail.extraction.tiers.detailCompany, 'T0');
});

test('produces byte-identical output for the atomic-renamed fixture', async () => {
  const original = await extractAll(FIXTURE);
  const renamed = await extractAll(RENAMED);
  // The wall-clock fields are derived from Date.now() and would differ between
  // two runs, so they are compared separately.
  const stable = (cards) =>
    cards.map(({ posted_at, posted_age_hours, ...rest }) => rest);
  assert.deepEqual(stable(renamed.cards), stable(original.cards));
  for (const cards of [renamed.cards, original.cards]) {
    const withAge = cards.filter((c) => c.posted_raw);
    assert.ok(withAge.length > 0, 'the fixture must contain cards with a posting age');
    for (const card of withAge) {
      assert.equal(typeof card.posted_age_hours, 'number');
    }
  }
  // The detail record is guarded as well — not just its description.
  const stableDetail = (d) => ({
    job_id: d.job_id,
    title: d.title,
    company: d.company,
    jd_text: d.jd_text,
    jd_chars: d.jd_chars,
    posted_raw: d.posted_raw,
    jd_incomplete: d.jd_incomplete,
  });
  assert.deepEqual(stableDetail(renamed.detail), stableDetail(original.detail));
});

test('never resolves a field through an atomic class', async () => {
  const { cards } = await extractAll(FIXTURE);
  for (const card of cards) {
    for (const [field, tier] of Object.entries(card.extraction.tiers)) {
      assert.notEqual(tier, 'T4', `${field} must not be resolved through an atomic class`);
    }
  }
});

test('the fixture loads no remote asset', () => {
  const html = readFileSync(FIXTURE, 'utf8');
  // Links are inert; what must not exist is anything the browser would fetch.
  const remote = [...html.matchAll(/src="(https?:[^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(remote, [], 'a committed fixture must not pull anything from the network');
  assert.equal((html.match(/<link/g) || []).length, 0, 'no stylesheet link');
  assert.equal((html.match(/<script/g) || []).length, 0, 'no script tag');
});

test('the atomic-renamed fixture really renames the obfuscated classes', () => {
  const original = readFileSync(FIXTURE, 'utf8');
  const renamed = readFileSync(RENAMED, 'utf8');
  const tokens = (html) =>
    [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
  const atomic = tokens(original).filter((token) => ATOMIC_CLASS_RE.test(token));
  assert.ok(atomic.length > 100, 'the fixture must contain obfuscated classes to rename');
  const survivors = tokens(renamed).filter((token) => ATOMIC_CLASS_RE.test(token));
  assert.deepEqual(survivors, [], 'no obfuscated class may survive in the renamed fixture');
  assert.equal(
    original.replace(/class="[^"]*"/g, ''),
    renamed.replace(/class="[^"]*"/g, ''),
    'the two fixtures must differ only in their class names'
  );
});
