import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const jobUrl = "https://jobs.fraunhofer.de/job/Berlin-Werkstudentin-Erkl%C3%A4rbare-K%C3%BCnstliche-Intelligenz-10587/1384850033/";
    
    try {
        await page.goto(jobUrl);
        await page.waitForLoadState('networkidle');
        
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a, button')).map(el => ({
                text: el.innerText.trim(),
                href: el.href || null,
                tagName: el.tagName
            })).filter(el => el.text.length > 0);
        });
        
        console.log("Found links/buttons:");
        links.forEach(l => {
            if (l.text.toLowerCase().includes('bewerben')) {
                console.log(`- [${l.tagName}] ${l.text}: ${l.href}`);
            }
        });
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}
run();
