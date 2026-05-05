import os
import json
from playwright.sync_api import sync_playwright

USER_DATA_DIR = os.path.join(os.getcwd(), ".playwright_profile")

def detect():
    with sync_playwright() as playwright:
        try:
            # Try to connect to the persistent context
            # Note: This might fail if the browser is already open with this profile
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=USER_DATA_DIR,
                headless=True,
            )
            pages = context.pages
            if not pages:
                print("No active pages found in the context.")
                context.close()
                return

            # If there are pages, the last one is likely the "active" or most recent one
            page = pages[-1]
            print(json.dumps({
                "url": page.url,
                "title": page.title(),
                "content": page.locator("body").inner_text()[:2000] # Cap content
            }, indent=2))
            context.close()
        except Exception as e:
            print(f"Error detecting active tab: {e}")

if __name__ == "__main__":
    detect()
