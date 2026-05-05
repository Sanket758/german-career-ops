import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const loginUrl = "https://career5.successfactors.eu/careers?company=fraunhofer";
    
    try {
        await page.goto(loginUrl);
        await page.waitForLoadState('networkidle');
        
        console.log("Accepting cookies...");
        const acceptCookies = await page.getByRole('button', { name: /Accept All Cookies/i }).first();
        if (await acceptCookies.isVisible()) {
            await acceptCookies.click();
            await page.waitForTimeout(2000);
        }
        
        await page.getByRole('link', { name: /Sign In/i }).first().click();
        await page.waitForTimeout(3000);
        
        await page.getByRole('link', { name: /Create an account/i }).first().click();
        await page.waitForTimeout(5000);
        
        // Check for Data Protection Policy
        const acceptButton = await page.getByRole('button', { name: /Accept|Annehmen|I Accept/i }).first();
        if (await acceptButton.isVisible()) {
            await acceptButton.click();
            await page.waitForTimeout(3000);
        }
        
        console.log("Filling email to check for existing account...");
        const emailInputs = await page.locator('input[type="text"]').all();
        // Usually the first visible text input is Email Address
        let emailInputFound = false;
        for (const input of emailInputs) {
             const label = await page.evaluate(el => {
                 return document.querySelector(`label[for="${el.id}"]`)?.innerText || "";
             }, input);
             if (label.includes("Email Address")) {
                 await input.fill("gadgesanket75@gmail.com");
                 await input.blur();
                 emailInputFound = true;
                 break;
             }
        }
        
        if (emailInputFound) {
            await page.waitForTimeout(3000);
            const bodyText = await page.innerText('body');
            if (bodyText.includes("already exists") || bodyText.includes("already has an account") || bodyText.includes("bereits vergeben")) {
                console.log("RESULT: Account already exists for gadgesanket75@gmail.com.");
            } else {
                console.log("RESULT: No account detected for gadgesanket75@gmail.com. Registration is likely required.");
            }
        } else {
            console.log("Could not find Email Address input by label.");
        }
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}
run();
