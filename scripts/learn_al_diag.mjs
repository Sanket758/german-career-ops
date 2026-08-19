import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';

const CDP = 'http://127.0.0.1:9222';
const BASE = 'https://www.linkedin.com/jobs/search/?keywords=Computer%20Vision&location=Germany&f_E=2%2C3&f_JT=F&f_TPR=r604800';
const WITH_AL = BASE + '&f_AL=true';

const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];
const log = [];
const dump = (k, v) => { log.push(`## ${k}\n${v}`); };

async function scrollResults(distance = 800) {
  const list = await page.evaluate(() => {
    const el = document.querySelector('.jobs-search-results-list, [data-results-list], .scaffold-layout__list');
    if (!el) return { found: false };
    const before = el.scrollTop;
    el.scrollTop += 800;
    return { found: true, before, after: el.scrollTop };
  });
  return list;
}

try {
  dump('STEP', '1. WITHOUT f_AL');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  let cards = await page.locator('li:has(a[href*="/jobs/view/"])').count();
  let easyTxt = (await page.evaluate(() => document.body.innerText)).match(/Easy Apply/g) || [];
  dump('NO_FILTER', `cards=${cards} easyApplyText=${easyTxt.length}`);
  let s = await scrollResults(); await page.waitForTimeout(2500);
  let cardsAfter = await page.locator('li:has(a[href*="/jobs/view/"])').count();
  dump('NO_FILTER_SCROLL', JSON.stringify({ ...s, cardsBefore: cards, cardsAfter }));

  dump('STEP', '2. WITH f_AL=true');
  await page.goto(WITH_AL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  cards = await page.locator('li:has(a[href*="/jobs/view/"])').count();
  easyTxt = (await page.evaluate(() => document.body.innerText)).match(/Easy Apply/g) || [];
  dump('WITH_FILTER', `cards=${cards} easyApplyText=${easyTxt.length} url=${page.url().slice(0, 120)}`);

  const firstCard = page.locator('li:has(a[href*="/jobs/view/"])').first();
  await firstCard.locator('a[href*="/jobs/view/"]').first().click();
  await page.waitForTimeout(4000);

  const applyButtons = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, a')].filter(b => /apply|easy|submit/i.test((b.innerText || '') + ' ' + (b.getAttribute('aria-label') || '')));
    return btns.slice(0, 10).map(b => ({
      tag: b.tagName, text: (b.innerText || '').trim().slice(0, 40),
      aria: b.getAttribute('aria-label'), cls: b.className.slice(0, 80),
      href: b.getAttribute('href')?.slice(0, 80) || '',
    }));
  });
  dump('DETAIL_APPLY_BUTTONS', JSON.stringify(applyButtons, null, 1));

  const detailText = await page.evaluate(() => document.body.innerText.slice(0, 400).replace(/\n+/g, ' | '));
  dump('DETAIL_TEXT', detailText);
} catch (e) {
  dump('ERROR', String(e));
}

const out = log.join('\n\n');
console.log(out);
writeFileSync(join(process.cwd(), 'data/learn_al_diag.md'), out);
await browser.close();