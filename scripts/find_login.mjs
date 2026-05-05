import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const jobUrl = "https://jobs.fraunhofer.de/job/Berlin-Werkstudentin-Erkl%C3%A4rbare-K%C3%BCnstliche-Intelligenz-10587/1384850033/";
    
    try {
        await page.goto(jobUrl);
        await page.waitForLoadState('networkidle');
        
        console.log("Searching for apply buttons...");
        const buttons = await page.locator('a:has-text("Jetzt bewerben")').all();
        console.log(`Found ${buttons.length} apply buttons.`);
        
        if (buttons.length > 0) {
            console.log("Clicking the first apply button and waiting for navigation...");
            await buttons[0].click();
            await page.waitForTimeout(5000); // Wait for potential redirects/modals
            
            console.log("Current URL:", page.url());
            
            // If it's still the same URL, maybe it's a modal or we need to look for specific links
            if (page.url() === jobUrl) {
                console.log("URL didn't change. Checking for visible links in a dropdown or modal...");
                const subLinks = await page.locator('a:visible').all();
                for (const link of subLinks) {
                    const text = await link.innerText();
                    const href = await link.getAttribute('href');
                    if (text.includes('Jetzt bewerben') && href && !href.includes('talentcommunity')) {
                         console.log(`Found direct apply link: ${text} -> ${href}`);
                         // Navigate to it
                         await page.goto(new URL(href, jobUrl).href);
                         await page.waitForLoadState('networkidle');
                         console.log("New URL:", page.url());
                         break;
                    }
                }
            }
            
            // Check for login fields
            const loginEmail = await page.locator('input[type="email"], input[name*="username"], input[id*="username"]').first();
            if (await loginEmail.isVisible()) {
                console.log("Login form is visible.");
            } else {
                console.log("Login form NOT found. Page text snippet:");
                const text = await page.innerText('body');
                console.log(text.substring(0, 500));
            }
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}
run();
