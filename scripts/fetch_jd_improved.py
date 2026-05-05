import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

USER_DATA_DIR = os.path.join(os.getcwd(), ".playwright_profile")
COOKIES_FILE = os.path.join(os.getcwd(), ".cookies.json")

def fetch_jd(url, headless=True):
    if not os.path.exists(COOKIES_FILE):
        print(f"Error: No cookies file found at {COOKIES_FILE}", file=sys.stderr)
        return None

    with open(COOKIES_FILE) as f:
        storage = json.load(f)

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=headless,
            viewport={"width": 1280, "height": 800}
        )

        page = context.pages[0] if context.pages else context.new_page()

        try:
            print(f"Navigating to {url}...", file=sys.stderr)
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            time.sleep(2)

            # Accept cookies if needed
            try:
                accept_btn = page.locator("button:has-text('Accept')").first
                if accept_btn.is_visible():
                    print("Clicking Accept cookies button", file=sys.stderr)
                    accept_btn.click()
                    time.sleep(1)
            except Exception:
                pass

            page.wait_for_load_state("networkidle")
            time.sleep(3)

            # Try to expand description
            expand_selectors = [
                "button.show-more-less-html__button",
                "button.jobs-description__footer-button",
                "button.jobs-description-content__button"
            ]
            for selector in expand_selectors:
                try:
                    btn = page.locator(selector).first
                    if btn.is_visible():
                        print(f"Clicking expand button: {selector}", file=sys.stderr)
                        btn.click()
                        time.sleep(2)
                except Exception:
                    pass

            # Try common description containers
            description_selectors = [
                ".jobs-description__container",
                ".jobs-box__html-content",
                ".description__text",
                ".job-description",
                "article",
                "main"
            ]
            
            jd_text = ""
            for selector in description_selectors:
                try:
                    element = page.locator(selector).first
                    if element.is_visible():
                        content = element.inner_text()
                        if len(content) > 500:
                            print(f"Found JD content in selector: {selector}", file=sys.stderr)
                            jd_text = content
                            break
                except Exception:
                    pass

            if not jd_text:
                print("Falling back to body text...", file=sys.stderr)
                jd_text = page.locator("body").inner_text()

            return jd_text

        except Exception as e:
            print(f"Error during fetch: {e}", file=sys.stderr)
            return None
        finally:
            context.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 fetch_jd_improved.py <url>")
        sys.exit(1)
    url = sys.argv[1]
    text = fetch_jd(url)
    if text:
        print(text)
    else:
        sys.exit(1)
