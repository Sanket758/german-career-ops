import { chromium } from 'playwright';

async function extract() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const regUrl = "https://career5.successfactors.eu/career?company=fraunhofer&site=&lang=de_DE&login_ns=register&career_ns=job_application&career_job_req_id=84000&jobPipeline=Direct&clientId=jobs2web";
    
    await page.goto(regUrl);
    await page.waitForLoadState('networkidle');
    
    const fields = await page.evaluate(() => {
        const result = [];
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const label = document.querySelector(`label[for="${input.id}"]`)?.innerText || 
                          input.closest('div')?.querySelector('label')?.innerText ||
                          input.placeholder ||
                          input.name ||
                          "Unknown";
            if (input.type !== 'hidden') {
                result.push({
                    id: input.id,
                    name: input.name,
                    type: input.type,
                    label: label.trim(),
                    tagName: input.tagName
                });
            }
        });
        return result;
    });
    console.log(JSON.stringify(fields, null, 2));
    await browser.close();
}
extract();
