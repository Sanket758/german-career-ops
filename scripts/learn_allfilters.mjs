import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';

const CDP = 'http://127.0.0.1:9222';
const JOBS_URL = 'https://www.linkedin.com/jobs/search/?keywords=Computer%20Vision&location=Germany&f_AL=true';

const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];
const log = [];
const dump = (k, v) => { log.push(`## ${k}\n${v}`); };

try {
  await page.goto(JOBS_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  const allFilters = page.locator('button:has-text("All filters")');
  if (await allFilters.count() > 0) {
    await allFilters.first().click();
    await page.waitForTimeout(3000);

    const modal = page.locator('.search-reusables__secondary-filters-modal, div[role="dialog"]:has(h2:has-text("All filters"))');
    dump('MODAL_FOUND', String(await modal.count()));

    const fullText = await page.evaluate(() => {
      const m = document.querySelector('.search-reusables__secondary-filters-modal, div[role="dialog"]');
      return m ? m.innerText : 'no modal';
    });
    dump('FULL_MODAL_TEXT', fullText.replace(/\n+/g, ' | '));

    const easyApplyCheckbox = page.locator('.search-reusables__filter-radio-label:has-text("Easy Apply"), label:has-text("Easy Apply"), input[value="f_AL"], [data-search-filter="f_AL"]');
    dump('EASY_APPLY_FILTER_COUNT', String(await easyApplyCheckbox.count()));

    const applyTypeSection = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('label, span, div')].filter(e => /Easy Apply|On-site|Remote|Hybrid|Under 10 applicants/i.test(e.innerText || '') && (e.innerText || '').length < 60);
      return labels.slice(0, 12).map(l => ({ tag: l.tagName, cls: l.className.slice(0, 60), text: l.innerText.slice(0, 40) }));
    });
    dump('EASY_APPLY_ELS', JSON.stringify(applyTypeSection, null, 1));
  } else {
    dump('ALL_FILTERS_BTN', 'NOT FOUND');
  }
} catch (e) {
  dump('ERROR', String(e));
}

const out = log.join('\n\n');
console.log(out);
writeFileSync(join(process.cwd(), 'data/learn_allfilters.md'), out);
await browser.close();