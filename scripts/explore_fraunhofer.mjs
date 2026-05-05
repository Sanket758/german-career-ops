import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const jobUrl = "https://jobs.fraunhofer.de/job/Berlin-Werkstudentin-Erkl%C3%A4rbare-K%C3%BCnstliche-Intelligenz-10587/1384850033/";
    
    try {
        await page.goto(jobUrl);
        await page.waitForLoadState('networkidle');
        
        // Find the "Jetzt bewerben" button
        const applyButton = await page.getByRole('link', { name: /Jetzt bewerben/i }).first();
        if (await applyButton.isVisible()) {
            console.log("Apply button found. Clicking...");
            await applyButton.click();
            await page.waitForLoadState('networkidle');
            
            console.log("Current URL after click:", page.url());
            
            // Check for login/registration
            const emailInput = await page.locator('input[type="email"], input[name*="email"], input[id*="email"]').first();
            if (await emailInput.isVisible()) {
                console.log("Login/Registration wall detected.");
                // Check if it's login or register
                const passwordInput = await page.locator('input[type="password"]').first();
                if (await passwordInput.isVisible()) {
                    console.log("Login form detected.");
                } else {
                    console.log("Registration form or email-first login detected.");
                }
            } else {
                console.log("Direct form or other wall detected.");
            }
        } else {
            console.log("Apply button NOT found.");
            // Take a screenshot if possible? No tool for that here besides maybe saving as image if I had the tool.
            // I'll just dump the page text.
            const content = await page.textContent('body');
            console.log("Page Body Snippet:", content.substring(0, 500));
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}
run();
