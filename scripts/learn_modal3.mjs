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

  const applyBtn = page.locator('button.jobs-apply-button').filter({ visible: true });
  const applyCount = await applyBtn.count();
  dump('VISIBLE_APPLY_BTN_COUNT', String(applyCount));
  if (applyCount === 0) {
    dump('DETAIL', await page.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n+/g, ' | ')));
    throw new Error('no visible apply button');
  }

  await applyBtn.first().click();
  await page.waitForTimeout(3500);

  const dialogs = await page.locator('[role="dialog"]').count();
  dump('DIALOG_COUNT', String(dialogs));

  const modalText = await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal, div[role="dialog"]');
    return m ? m.innerText.slice(0, 900).replace(/\n+/g, ' | ') : 'no modal';
  });
  dump('MODAL_TEXT', modalText);

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

  const modalFields = await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal, div[role="dialog"]');
    if (!m) return [];
    return [...m.querySelectorAll('input, select, textarea, button[role="radio"], [role="checkbox"]')].map(i => ({
      tag: i.tagName, type: i.type || '', name: i.name || '', placeholder: i.placeholder || '',
      aria: i.getAttribute('aria-label') || '', required: i.required,
    })).slice(0, 20);
  });
  dump('MODAL_FIELDS', JSON.stringify(modalFields, null, 1));

  const modalHtml = await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal, div[role="dialog"]');
    return m ? m.innerHTML.slice(0, 2000) : 'no modal';
  });
  dump('MODAL_HTML', modalHtml);

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(800);
} catch (e) {
  dump('ERROR', String(e));
}

const out = log.join('\n\n');
console.log(out);
writeFileSync(join(process.cwd(), 'data/learn_modal3.md'), out);
await browser.close();