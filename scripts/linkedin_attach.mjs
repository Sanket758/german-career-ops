import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const CDP = 'http://127.0.0.1:9222';
const COOKIES = join(process.cwd(), 'data/linkedin_cookies.json');

if (!existsSync(COOKIES)) { console.error('NO_COOKIES'); process.exit(1); }
const cookies = JSON.parse(readFileSync(COOKIES, 'utf8'));

const browser = await chromium.connectOverCDP(CDP);
const contexts = browser.contexts();
const ctx = contexts[0] || await browser.newContext();

await ctx.addCookies(cookies.map(c => ({
  name: c.name, value: c.value, domain: c.domain, path: c.path || '/',
  expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
  secure: c.secure !== false, httpOnly: c.httpOnly === true,
  sameSite: c.sameSite || 'Lax',
})));

const pages = ctx.pages();
const page = pages[0] || await ctx.newPage();
await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

const url = page.url();
const body = await page.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n+/g, ' | '));
const isLogin = url.includes('/login');
const authed = !isLogin && /Sanket|Me|Home|Jobs/i.test(body) && !/Welcome back/i.test(body.slice(0, 40));

console.log('URL:', url);
console.log('AUTHED:', authed);
console.log('BODYTEXT:', body);

if (authed) {
  const storage = join(process.cwd(), 'data/linkedin_storage_state.json');
  await ctx.storageState({ path: storage });
  console.log('STORAGE_SAVED');
}
await browser.close();
process.exit(authed ? 0 : 1);
