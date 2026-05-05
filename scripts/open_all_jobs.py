import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

USER_DATA_DIR = os.path.join(os.getcwd(), ".playwright_profile")

def open_jobs(urls):
    with sync_playwright() as playwright:
        # Launch in visible mode
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=False,
            viewport={"width": 1280, "height": 800},
        )

        pages = []
        for url in urls:
            print(f"Opening {url}...")
            page = context.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                pages.append(page)
            except Exception as e:
                print(f"Could not open {url}: {e}")

        print("\nAll jobs opened in separate tabs. Please proceed with applications.")
        print("Keeping browser open. Close the browser window to finish.")
        
        while True:
            # Check if all pages are closed
            if all(p.is_closed() for p in pages) and pages:
                break
            time.sleep(5)
            
        context.close()

if __name__ == "__main__":
    job_urls = [
        "https://www.linkedin.com/jobs/view/4398358538/",
        "https://www.linkedin.com/jobs/view/4402867473/",
        "https://www.linkedin.com/jobs/view/4379860816/"
    ]
    open_jobs(job_urls)
