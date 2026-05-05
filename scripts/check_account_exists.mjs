import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const loginUrl = "https://career5.successfactors.eu/careers?company=fraunhofer";
    
    try {
        await page.goto(loginUrl);
        await page.waitForLoadState('networkidle');
        
        console.log("Clicking 'Create an account'...");
        await page.getByRole('link', { name: /Create an account/i }).click();
        await page.waitForTimeout(3000);
        
        console.log("Current URL:", page.url());
        
        // Fill the registration form partially to check if email is taken
        // SuccessFactors registration usually has email, password, etc.
        const emailInput = await page.locator('input[name*="email"], input[id*="email"]').first();
        if (await emailInput.isVisible()) {
            console.log("Filling email to check for existing account...");
            await emailInput.fill("gadgesanket75@gmail.com");
            // Sometimes it checks on blur or when we click next
            await emailInput.blur();
            await page.waitForTimeout(2000);
            
            const errorText = await page.innerText('body');
            if (errorText.includes("already exists") || errorText.includes("bereits vergeben")) {
                console.log("RESULT: Account already exists for gadgesanket75@gmail.com.");
            } else {
                console.log("RESULT: No account detected yet. Might need registration.");
            }
        } else {
            console.log("Registration email input NOT found.");
        }
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}
run();
