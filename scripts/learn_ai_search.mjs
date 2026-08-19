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
  await page.waitForTimeout(7000);

  dump('URL', page.url());
  dump('TITLE', await page.title());

  const aiElements = await page.evaluate(() => {
    const result = { aiSearchBtns: [], classicHints: [], allBtnsWithAI: [] };
    document.querySelectorAll('button').forEach(b => {
      const t = (b.innerText || '').trim();
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      const cls = (b.className || '');
      if (/ai|classic|toggle|dismiss/i.test(label) && t.length < 60) {
        result.aiSearchBtns.push({ text: t.slice(0, 60), label: b.getAttribute('aria-label'), cls: cls.slice(0, 80) });
      }
      if (/ai search/i.test(t)) result.allBtnsWithAI.push({ text: t.slice(0, 60), label: b.getAttribute('aria-label') });
    });
    return result;
  });
  dump('AI_ELEMENTS', JSON.stringify(aiElements, null, 1));

  const banner = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[class*="ai-powered"], [class*="genai"], [class*="search-context"]')];
    return els.slice(0, 5).map(e => ({ cls: e.className.slice(0, 100), text: e.innerText.slice(0, 120) }));
  });
  dump('AI_BANNERS', JSON.stringify(banner, null, 1));

  const cardCtas = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('li')].filter(li => li.querySelector('a[href*="/jobs/view/"]'));
    return cards.slice(0, 10).map(c => {
      const btns = [...c.querySelectorAll('button')].map(b => b.innerText.trim().slice(0, 30));
      return btns;
    });
  });
  dump('CARD_CTA_BUTTONS', JSON.stringify(cardCtas, null, 1));

  dump('BODY_AI_MENTIONS', String((await page.evaluate(() => document.body.innerText)).match(/AI job search|Try AI|classic/gi) || 'none'));
} catch (e) {
  dump('ERROR', String(e));
}

const out = log.join('\n\n');
console.log(out);
writeFileSync(join(process.cwd(), 'data/learn_ai_search.md'), out);
await browser.close();