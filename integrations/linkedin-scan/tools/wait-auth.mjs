// Wait for a human to finish logging in inside the automation Chrome, then save storageState.
// Usage: node integrations/linkedin-scan/tools/wait-auth.mjs [timeoutSeconds]
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const TIMEOUT_S = Number(process.argv[2] || 900);
const CDP = 'http://127.0.0.1:9222';
// Resolved against the repository, never against the current directory: the
// file holds live session cookies and must land in the gitignored data/ folder.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data', 'linkedin_storage_state.json');

const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const started = Date.now();
let last = '';

while ((Date.now() - started) / 1000 < TIMEOUT_S) {
  const pages = ctx.pages();
  for (const page of pages) {
    let url = '';
    try {
      url = page.url();
      if (!/linkedin\.com/.test(url)) continue;
      const hasLiAt = await page
        .evaluate(() => document.cookie.includes('li_at='))
        .catch(() => false);
      // li_at is HttpOnly: it is invisible to document.cookie. Read the real cookie jar.
      const jar = await ctx.cookies('https://www.linkedin.com').catch(() => []);
      const liAt = jar.find((c) => c.name === 'li_at' && c.value);
      const jsession = jar.find((c) => c.name === 'JSESSIONID' && c.value);
      const isLoginPage = /\/(login|uas\/|checkpoint)/i.test(url);
      const body = await page
        .evaluate(() => document.body.innerText.slice(0, 200))
        .catch(() => '');
      const looksLoggedOut = /Sign in|Log in|Password \(6\+|einloggen/i.test(body);

      const status = `url=${url.slice(0, 60)} jar_li_at=${Boolean(liAt)} jsessionid=${Boolean(jsession)} docCookie=${hasLiAt} loginPage=${isLoginPage} loggedOut=${looksLoggedOut}`;
      if (status !== last) {
        console.log(`[${new Date().toISOString().slice(11, 19)}] ${status}`);
        last = status;
      }
      if (liAt && jsession && !isLoginPage && !looksLoggedOut) {
        mkdirSync(dirname(OUT), { recursive: true });
        await ctx.storageState({ path: OUT });
        console.log('AUTHED: true');
        console.log('STORAGE_SAVED:', OUT);
        await browser.close();
        process.exit(0);
      }
    } catch {
      /* page closed mid-poll */
    }
  }
  await new Promise((r) => setTimeout(r, 4000));
}

console.log('TIMEOUT: not authenticated within', TIMEOUT_S, 's');
await browser.close();
process.exit(1);
