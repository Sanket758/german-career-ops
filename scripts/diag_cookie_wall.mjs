import { chromium } from 'playwright';

const CDP = 'http://127.0.0.1:9222';
const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];

const cookies = await ctx.cookies('https://www.linkedin.com');
const consentRelated = cookies.filter(c => /consent|gc|oatml|lang|li_theme|UserMatch|bscookie|bcookie/i.test(c.name));
console.log('TOTAL_COOKIES', cookies.length);
console.log('CONSENT_RELATED', JSON.stringify(consentRelated.map(c => ({ name: c.name, value: (c.value || '').slice(0, 40), exp: c.expires })), null, 1));

// Go to feed and check the banner state
await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

const banner = page.locator('.artdeco-global-alert--COOKIE_CONSENT, [alert-id*="COOKIE_CONSENT"]');
const bannerVisible = await banner.count() > 0;
console.log('BANNER_VISIBLE', bannerVisible);

if (bannerVisible) {
  const accept = banner.locator('button:has-text("Accept")');
  if (await accept.count() > 0) {
    await accept.first().click();
    await page.waitForTimeout(3000);
    console.log('CLICKED_ACCEPT');
  }
  const still = await banner.count();
  console.log('BANNER_AFTER_ACCEPT', still > 0);
}

// Reload to test persistence
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const afterReload = await page.locator('.artdeco-global-alert--COOKIE_CONSENT, [alert-id*="COOKIE_CONSENT"]').count();
console.log('BANNER_AFTER_RELOAD', afterReload > 0);

const cookiesAfter = await ctx.cookies('https://www.linkedin.com');
const gc = cookiesAfter.filter(c => /li_gc|oatml|lang|consent/i.test(c.name));
console.log('COOKIES_AFTER', JSON.stringify(gc.map(c => ({ name: c.name, value: (c.value || '').slice(0, 40), exp: c.expires })), null, 1));

await browser.close();