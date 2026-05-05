import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const loginUrl = "https://career5.successfactors.eu/careers?company=fraunhofer";
    
    try {
        await page.goto(loginUrl);
        await page.waitForLoadState('networkidle');
        
        console.log("Clicking 'Sign In' link to reveal options...");
        const signInLink = await page.getByRole('link', { name: /Sign In/i }).first();
        if (await signInLink.isVisible()) {
            await signInLink.click();
            await page.waitForTimeout(3000);
            
            console.log("Searching for 'Create an account' link...");
            const createAccountLink = await page.getByRole('link', { name: /Create an account/i }).first();
            if (await createAccountLink.isVisible()) {
                console.log("Found 'Create an account' link. Clicking...");
                await createAccountLink.click();
                await page.waitForTimeout(3000);
                
                console.log("Current URL:", page.url());
                
                const emailInput = await page.locator('input[name*="email"], input[id*="email"]').first();
                if (await emailInput.isVisible()) {
                    await emailInput.fill("gadgesanket75@gmail.com");
                    await emailInput.blur();
                    await page.waitForTimeout(3000);
                    
                    const bodyText = await page.innerText('body');
                    if (bodyText.includes("already exists") || bodyText.includes("bereits vergeben")) {
                        console.log("RESULT: Account already exists for gadgesanket75@gmail.com.");
                    } else {
                        console.log("RESULT: No account detected yet. Might need registration.");
                        // List the fields to be helpful
                        const fields = await page.evaluate(() => {
                            return Array.from(document.querySelectorAll('input:visible')).map(el => ({
                                id: el.id,
                                label: document.querySelector(`label[for="${el.id}"]`)?.innerText || el.placeholder || el.name
                            }));
                        });
                        console.log("Registration fields:", JSON.stringify(fields, null, 2));
                    }
                } else {
                    console.log("Email input NOT visible on registration page.");
                }
            } else {
                console.log("'Create an account' link NOT found after clicking 'Sign In'.");
            }
        } else {
            console.log("'Sign In' link NOT found.");
        }
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}
run();
