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

  const cards = page.locator('li:has(a[href*="/jobs/view/"])');
  const n = await cards.count();
  dump('CARDS', String(n));
  if (n === 0) throw new Error('no cards');

  await cards.first().locator('a[href*="/jobs/view/"]').first().click();
  await page.waitForTimeout(4000);

  const applyBtn = page.locator('.jobs-apply-button, button[aria-label^="LinkedIn Apply"]');
  dump('APPLY_BTN_COUNT', String(await applyBtn.count()));
  for (let i = 0; i < Math.min(await applyBtn.count(), 3); i++) {
    const b = applyBtn.nth(i);
    dump(`APPLY_BTN_${i}`, JSON.stringify({
      text: await b.innerText().catch(() => ''),
      aria: await b.getAttribute('aria-label').catch(() => ''),
      cls: await b.getAttribute('class').then(c => (c || '').slice(0, 80)).catch(() => ''),
      visible: await b.isVisible().catch(() => false),
    }, null, 1));
  }

  await applyBtn.first().click();
  await page.waitForTimeout(3500);

  dump('URL_AFTER_CLICK', page.url().slice(0, 200));
  dump('TITLE_AFTER_CLICK', await page.title());

  const dialogs = await page.locator('[role="dialog"], .artdeco-modal, .modal').count();
  dump('DIALOG_COUNT', String(dialogs));

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600).replace(/\n+/g, ' | '));
  dump('BODY_AFTER_CLICK', bodyText);

  const modalEl = await page.evaluate(() => {
    const m = document.querySelector('[role="dialog"], .jobs-easy-apply-modal');
    if (!m) return 'none';
    return { cls: m.className.slice(0, 120), text: m.innerText.slice(0, 400).replace(/\n+/g, ' | ') };
  });
  dump('MODAL_SNIP', JSON.stringify(modalEl));

  const pageCount = ctx.pages().length;
  dump('PAGES', String(pageCount));
  for (const p of ctx.pages()) dump('PAGE_URL', p.url().slice(0, 150));

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(800);
} catch (e) {
  dump('ERROR', String(e));
}

const out = log.join('\n\n');
console.log(out);
writeFileSync(join(process.cwd(), 'data/learn_modal2.md'), out);
await browser.close();