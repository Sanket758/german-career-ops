import sys
import os
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

        if not pages:
            print("\nNone of the URLs could be opened.")
            context.close()
            return

        print("\nAll jobs opened in separate tabs. Please proceed with applications.")
        print("Keeping browser open. Close the browser window to finish.")

        while True:
            # Check if all pages are closed
            if all(p.is_closed() for p in pages) and pages:
                break
            time.sleep(5)

        context.close()

if __name__ == "__main__":
    # Accept URLs as command-line arguments and/or from stdin (one URL per line)
    job_urls = list(sys.argv[1:])

    if not job_urls and not sys.stdin.isatty():
        job_urls = [line.strip() for line in sys.stdin if line.strip()]

    if not job_urls:
        print("Usage: python3 scripts/open_all_jobs.py <url1> <url2> ...")
        print("   or: echo '<url>' | python3 scripts/open_all_jobs.py")
        print("   or: python3 scripts/open_all_jobs.py < urls.txt")
        print("Each URL is opened in its own Chrome tab.")
        sys.exit(1)

    open_jobs(job_urls)
