import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const loginUrl = "https://career5.successfactors.eu/careers?company=fraunhofer";
    
    try {
        await page.goto(loginUrl);
        await page.waitForLoadState('networkidle');
        
        const fields = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input')).map(el => ({
                id: el.id,
                name: el.name,
                type: el.type,
                placeholder: el.placeholder
            }));
        });
        
        console.log("Input fields:", JSON.stringify(fields, null, 2));
        
        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button, a')).map(el => ({
                text: el.innerText.trim(),
                tagName: el.tagName
            })).filter(el => el.text.length > 0);
        });
        
        console.log("Buttons/Links:", JSON.stringify(buttons, null, 2));
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}
run();
