import { chromium } from 'playwright';
import fs from 'fs';

async function run() {
  console.log('🚀 Starting Broad Fraunhofer Search via Google...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const query = 'Fraunhofer "Computer Vision" jobs Berlin 2026';
    console.log(`🌐 Searching Google for: ${query}`);
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
    
    // Handle cookie consent
    try {
        const consentButton = page.locator('button:has-text("Accept all"), button:has-text("Alle akzeptieren")');
        if (await consentButton.isVisible({ timeout: 5000 })) {
            await consentButton.click();
            console.log('🍪 Accepted cookies.');
        }
    } catch (e) {}

    await page.waitForTimeout(2000);

    const results = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('div.g'));
        return items.map(item => {
            const titleEl = item.querySelector('h3');
            const linkEl = item.querySelector('a');
            if (!titleEl || !linkEl) return null;
            return {
                title: titleEl.innerText,
                url: linkEl.href
            };
        }).filter(r => r !== null);
    });

    console.log(`✅ Found ${results.length} results.`);
    results.slice(0, 10).forEach((r, i) => console.log(`[${i+1}] ${r.title} - ${r.url}`));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

run();
