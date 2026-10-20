// Open the LinkedIn login page in the automation Chrome (CDP) so a human can sign in.
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => p.url().includes('linkedin.com'));
if (!page) page = await ctx.newPage();
await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log('opened:', page.url());
await browser.close();
