// Regenerate the golden record file from the committed fixture.
//
//   node integrations/linkedin-scan/tools/update-golden.mjs
//
// The golden file pins the fields that must never change for a given fixture
// (identity, title, company, location, badges). Volatile values — the relative
// posting time — are deliberately left out: they age between captures.
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { scannerSource } from '../lib/inject.mjs';

const FIXTURE = resolve('integrations/linkedin-scan/fixtures/search-results.html');
const GOLDEN = resolve('integrations/linkedin-scan/test/golden/cards.json');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + FIXTURE, { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: scannerSource() });

const cards = await page.evaluate(() =>
  globalThis.__linkedinScan.findCards(document).map((c) => {
    const card = globalThis.__linkedinScan.extractCard(c);
    return {
      job_id: card.job_id,
      title: card.title,
      title_norm: card.title_norm,
      company: card.company,
      location_raw: card.location_raw,
      city: card.city,
      country: card.country,
      work_mode: card.work_mode,
      badges: card.badges,
      easy_apply: card.easy_apply,
      salary_raw: card.salary_raw,
    };
  })
);

await browser.close();

writeFileSync(GOLDEN, JSON.stringify(cards, null, 2) + '\n');
console.log(`WROTE ${cards.length} golden records to ${GOLDEN}`);
for (const c of cards) {
  console.log(`${c.job_id}  ${c.title}  |  ${c.company}  |  ${c.location_raw}  |  ${c.badges.join(', ')}`);
}
