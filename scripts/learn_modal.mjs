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
  const applyCount = await applyBtn.count();
  dump('APPLY_BTN_COUNT', String(applyCount));
  if (applyCount === 0) {
    dump('DETAIL_TEXT', await page.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n+/g, ' | ')));
    throw new Error('no LinkedIn Apply button');
  }

  await applyBtn.first().click();
  await page.waitForTimeout(3500);

  const modal = page.locator('.jobs-easy-apply-modal, div[role="dialog"]');
  dump('MODAL_COUNT', String(await modal.count()));
  const modalText = await modal.first().innerText().catch(() => '');
  dump('MODAL_TEXT', modalText.slice(0, 800).replace(/\n+/g, ' | '));

  const modalButtons = await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal, div[role="dialog"]');
    if (!m) return [];
    return [...m.querySelectorAll('button')].map(b => ({
      text: (b.innerText || '').trim().slice(0, 40),
      aria: b.getAttribute('aria-label'),
      cls: b.className.slice(0, 60),
      disabled: b.disabled,
      visible: !!b.offsetParent,
    })).filter(b => b.visible);
  });
  dump('MODAL_BUTTONS', JSON.stringify(modalButtons, null, 1));

  const fields = await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal, div[role="dialog"]');
    if (!m) return [];
    return [...m.querySelectorAll('input, select, textarea')].map(i => ({
      tag: i.tagName, type: i.type || '', name: i.name || '', placeholder: i.placeholder || '',
      aria: i.getAttribute('aria-label') || '', required: i.required,
    }));
  });
  dump('MODAL_FIELDS', JSON.stringify(fields, null, 1));

  const modalHtml = await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal, div[role="dialog"]');
    return m ? m.innerHTML.slice(0, 1500) : 'no modal';
  });
  dump('MODAL_HTML', modalHtml);

  const footer = await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal, div[role="dialog"]');
    if (!m) return 'none';
    const f = m.querySelector('.jobs-easy-apply-footer, .artdeco-modal__actionbar');
    return f ? f.innerText.slice(0, 200).replace(/\n+/g, ' | ') : 'no footer el';
  });
  dump('MODAL_FOOTER', footer);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
} catch (e) {
  dump('ERROR', String(e));
}

const out = log.join('\n\n');
console.log(out);
writeFileSync(join(process.cwd(), 'data/learn_modal.md'), out);
await browser.close();