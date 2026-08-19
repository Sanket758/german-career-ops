import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';

const CDP = 'http://127.0.0.1:9222';
const JOBS_URL = 'https://www.linkedin.com/jobs/search/?keywords=Computer%20Vision&location=Germany&f_AL=true&f_E=2%2C3&f_JT=F&f_TPR=r604800';

const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];
const log = [];
const dump = (k, v) => { log.push(`## ${k}\n${v}`); };

try {
  await page.goto(JOBS_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  const filterBar = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="All filters"], button[aria-label*="Filters"]');
    return {
      found: !!btn,
      label: btn ? btn.innerText.slice(0, 60) : null,
      filtersHtml: (document.querySelector('.jobs-search-filter-bar, [data-filter-bar], .search-reusables__filter-pill-wrapper') || {}).innerHTML?.slice(0, 1000) || 'no filter bar',
    };
  });
  dump('FILTER_BAR', JSON.stringify(filterBar, null, 1));

  const filterBtns = await page.locator('button[aria-expanded], button[role="combobox"]').count();
  dump('FILTER_BUTTONS', String(filterBtns));

  const labels = await page.locator('button[aria-expanded]').evaluateAll(btns => btns.slice(0, 15).map(b => ({ label: b.innerText.slice(0, 40), aria: b.getAttribute('aria-label'), exp: b.getAttribute('aria-expanded') })));
  dump('FILTER_BUTTON_LABELS', JSON.stringify(labels, null, 1));

  const allFilters = page.locator('button:has-text("All filters")');
  if (await allFilters.count() > 0) {
    await allFilters.first().click();
    await page.waitForTimeout(3000);
    dump('ALL_FILTERS_MODAL', await page.evaluate(() => {
      const m = document.querySelector('div[role="dialog"]');
      return m ? m.innerText.slice(0, 800).replace(/\n+/g, ' | ') : 'no dialog';
    }));
    dump('ALL_FILTERS_HTML', await page.evaluate(() => {
      const m = document.querySelector('div[role="dialog"]');
      return m ? m.innerHTML.slice(0, 2000) : 'no dialog';
    }));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }

  const easyApplyFilter = page.locator('button:has-text("Easy Apply"), label:has-text("Easy Apply"), input[aria-label*="Easy Apply"]');
  dump('EASY_APPLY_FILTER_COUNT', String(await easyApplyFilter.count()));

  dump('FINAL_URL', page.url());
} catch (e) {
  dump('ERROR', String(e));
}

const out = log.join('\n\n');
console.log(out);
writeFileSync(join(process.cwd(), 'data/learn_filters.md'), out);
await browser.close();