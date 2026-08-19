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
  await page.waitForTimeout(5000);

  const cards = page.locator('li:has(a[href*="/jobs/view/"])');
  if (await cards.count() === 0) throw new Error('no cards');
  await cards.first().locator('a[href*="/jobs/view/"]').first().click();
  await page.waitForTimeout(4000);

  const applyBtn = page.locator('button.jobs-apply-button').filter({ visible: true });
  if (await applyBtn.count() === 0) throw new Error('no apply btn');
  await applyBtn.first().click();
  await page.waitForTimeout(3000);

  const modal = page.locator('.jobs-easy-apply-modal, div[role="dialog"]').first();
  dump('STEP0_MODAL', (await modal.innerText().catch(() => '')).slice(0, 500).replace(/\n+/g, ' | '));

  // --- STEP 1: fill contact info (phone). Email is prefilled.
  const phoneInput = page.locator('.jobs-easy-apply-modal input[type="tel"], input[id*="phone"]').first();
  const phoneCount = await phoneInput.count();
  dump('PHONE_INPUT_COUNT', String(phoneCount));
  if (phoneCount > 0) {
    await phoneInput.fill('0176 00000000');
    dump('PHONE_FILLED', 'yes');
  }

  // country code select already prefilled Deutschland (+49). Select phone type if present.
  const phoneType = page.locator('.jobs-easy-apply-modal select').nth(1);
  if (await phoneType.count() > 0) {
    dump('PHONE_TYPE_OPTIONS', await phoneType.locator('option').allInnerTexts().then(a => a.slice(0, 6).join(' | ')));
    await phoneType.selectOption({ index: 1 });
  }

  await page.locator('button[aria-label="Continue to next step"]').first().click();
  await page.waitForTimeout(3000);
  dump('STEP1_AFTER_NEXT', (await modal.innerText().catch(() => '')).slice(0, 700).replace(/\n+/g, ' | '));

  const step1Buttons = await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal');
    if (!m) return [];
    return [...m.querySelectorAll('button')].map(b => ({ text: (b.innerText||'').trim().slice(0,40), aria: b.getAttribute('aria-label'), cls: (b.className||'').slice(0,60), disabled: b.disabled })).filter(b => b.visible !== false && b.offsetParent);
  });
  dump('STEP1_BUTTONS', JSON.stringify(step1Buttons, null, 1));

  const step1Fields = await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal');
    if (!m) return [];
    return [...m.querySelectorAll('input, select, textarea, button[role="radio"]')].map(i => ({
      tag: i.tagName, type: i.type || '', aria: i.getAttribute('aria-label') || '', checked: i.checked !== undefined ? i.checked : null,
    })).slice(0, 25);
  });
  dump('STEP1_FIELDS', JSON.stringify(step1Fields, null, 1));

  // If resume step: confirm resume selection if needed, then Next
  const nextBtns = await page.locator('button[aria-label="Continue to next step"]').count();
  dump('STEP1_NEXT_COUNT', String(nextBtns));

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(600);
} catch (e) {
  dump('ERROR', String(e));
}

const out = log.join('\n\n');
console.log(out);
writeFileSync(join(process.cwd(), 'data/learn_steps.md'), out);
await browser.close();