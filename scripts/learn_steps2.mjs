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

  const modal = page.locator('.jobs-easy-apply-modal').first();
  const next = page.locator('button[aria-label="Continue to next step"]').first();

  // Step 1: phone
  const phoneInput = page.locator('.jobs-easy-apply-modal input[type="tel"], input[id*="phone"]').first();
  if (await phoneInput.count() > 0) await phoneInput.fill('0176 76475359');
  await page.waitForTimeout(1500);
  await next.click();
  await page.waitForTimeout(3000);

  // Step 2: resume - first radio already checked. Just Next.
  await next.click();
  await page.waitForTimeout(3000);

  dump('STEP2_AFTER_RESUME', (await modal.innerText().catch(() => '')).slice(0, 1200).replace(/\n+/g, ' | '));

  const qButtons = await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal');
    if (!m) return [];
    return [...m.querySelectorAll('button')].map(b => ({ text: (b.innerText||'').trim().slice(0,50), aria: b.getAttribute('aria-label'), cls: (b.className||'').slice(0,60), disabled: b.disabled })).filter(b => b.offsetParent);
  });
  dump('STEP2_BUTTONS', JSON.stringify(qButtons, null, 1));

  const qFields = await page.evaluate(() => {
    const m = document.querySelector('.jobs-easy-apply-modal');
    if (!m) return [];
    return [...m.querySelectorAll('input, select, textarea, button[role="radio"], [role="checkbox"], label')].map(i => ({
      tag: i.tagName, type: i.type || '', role: i.getAttribute('role') || '', aria: i.getAttribute('aria-label') || '', text: (i.innerText||'').trim().slice(0,50),
      checked: i.checked !== undefined ? i.checked : null, cls: (i.className||'').slice(0,50),
    })).slice(0, 40);
  });
  dump('STEP2_FIELDS', JSON.stringify(qFields, null, 1));

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(600);
} catch (e) {
  dump('ERROR', String(e));
}

const out = log.join('\n\n');
console.log(out);
writeFileSync(join(process.cwd(), 'data/learn_steps2.md'), out);
await browser.close();