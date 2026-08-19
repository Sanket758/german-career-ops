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

async function fillStep() {
  // text inputs for years-of-experience
  const inputs = page.locator('.jobs-easy-apply-modal input[type="text"]');
  for (let i = 0; i < await inputs.count(); i++) {
    const inp = inputs.nth(i);
    if (!(await inp.isVisible().catch(() => false))) continue;
    const val = (await inp.inputValue().catch(() => '')).trim();
    if (!val) await inp.fill('2');
  }
  // selects -> German select -> "Gut"; others -> first real option
  const selects = page.locator('.jobs-easy-apply-modal select');
  for (let i = 0; i < await selects.count(); i++) {
    const sel = selects.nth(i);
    if (!(await sel.isVisible().catch(() => false))) continue;
    const opts = await sel.locator('option').allInnerTexts().catch(() => []);
    const labelText = await page.evaluate((el) => {
      const lbl = el.closest('.fb-dash-form-element, form')?.querySelector('.fb-dash-form-element__label, label');
      return lbl ? lbl.innerText : '';
    }, await sel.elementHandle());
    dump(`SELECT_${i}_LABEL`, (labelText || '').slice(0, 60));
    const clean = opts.map(o => o.trim()).filter(Boolean).slice(1);
    dump(`SELECT_${i}_OPTS`, clean.slice(0, 8).join(' | '));
    if (/deutsch|german|sprache/i.test(labelText)) {
      if (clean.includes('Gut')) await sel.selectOption({ label: 'Gut' });
      else await sel.selectOption({ index: 1 });
    } else if (clean.length > 0) {
      await sel.selectOption({ index: 0 });
    }
  }
  // radios -> pick Ja/Yes/first positive
  const radios = page.locator('.jobs-easy-apply-modal button[role="radio"], .jobs-easy-apply-modal input[type="radio"]');
  const radioGroups = new Set();
  for (let i = 0; i < await radios.count(); i++) {
    const r = radios.nth(i);
    if (!(await r.isVisible().catch(() => false))) continue;
    const txt = (await r.innerText().catch(() => '')).trim();
    dump(`RADIO_${i}`, txt.slice(0, 40));
  }
}

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

  const modal = page.locator('.jobs-easy-apply-modal').first();
  const next = page.locator('button[aria-label="Continue to next step"]').first();

  const phoneInput = page.locator('.jobs-easy-apply-modal input[type="tel"], input[id*="phone"]').first();
  if (await phoneInput.count() > 0) await phoneInput.fill('0176 76475359');
  await page.waitForTimeout(1200);
  await next.click();
  await page.waitForTimeout(2500);
  await next.click();
  await page.waitForTimeout(2500);

  // questions step
  dump('Q_STEP', (await modal.innerText().catch(() => '')).slice(0, 600).replace(/\n+/g, ' | '));
  await fillStep();
  await page.waitForTimeout(1200);

  const reviewBtn = page.locator('button:has-text("Review"), button[aria-label*="Review"]').filter({ visible: true }).first();
  dump('REVIEW_BTN_COUNT', String(await page.locator('button:has-text("Review")').count()));
  if (await reviewBtn.count() > 0) {
    await reviewBtn.click();
    await page.waitForTimeout(3000);
    dump('REVIEW_STEP', (await modal.innerText().catch(() => '')).slice(0, 900).replace(/\n+/g, ' | '));
    const submitBtns = await page.evaluate(() => {
      const m = document.querySelector('.jobs-easy-apply-modal');
      if (!m) return [];
      return [...m.querySelectorAll('button')].map(b => ({ text: (b.innerText||'').trim().slice(0,50), aria: b.getAttribute('aria-label'), cls: (b.className||'').slice(0,60), disabled: b.disabled })).filter(b => b.offsetParent);
    });
    dump('SUBMIT_BUTTONS', JSON.stringify(submitBtns, null, 1));
  }

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(600);
} catch (e) {
  dump('ERROR', String(e));
}

const out = log.join('\n\n');
console.log(out);
writeFileSync(join(process.cwd(), 'data/learn_steps3.md'), out);
await browser.close();