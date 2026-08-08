import sys
import os
import time

USER_DATA_DIR = os.path.join(os.getcwd(), ".playwright_profile")
DEFAULT_CDP_PORT = 9222

def print_usage():
    print("Usage: python3 scripts/open_all_jobs.py [--cdp [--cdp-port PORT]] <url1> <url2> ...")
    print("   or: echo '<url>' | python3 scripts/open_all_jobs.py [--cdp]")
    print("   or: python3 scripts/open_all_jobs.py [--cdp] < urls.txt")
    print("Each URL is opened in its own Chrome tab.")
    print()
    print("Options:")
    print("  --cdp             Connect to your already-running Chrome via CDP")
    print("                    (requires Chrome launched with --remote-debugging-port=9222).")
    print("                    Opens tabs in your real browser, preserving cookies/logins.")
    print("  --cdp-port PORT   CDP port to connect to (default: 9222)")
    print("  -h, --help        Show this help message and exit")

def open_jobs(urls):
    from playwright.sync_api import sync_playwright

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


def open_jobs_cdp(urls, port=DEFAULT_CDP_PORT):
    from playwright.sync_api import sync_playwright

    cdp_endpoint = f"http://127.0.0.1:{port}"
    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.connect_over_cdp(cdp_endpoint)
        except Exception as e:
            print(f"ERROR: Could not connect to your running Chrome at {cdp_endpoint}: {e}")
            print()
            print("Chrome is not running with remote debugging enabled.")
            print("To use --cdp, launch your normal Chrome (desktop icon / usual profile)")
            print("with remote debugging enabled, e.g.:")
            print()
            print(f"  google-chrome --remote-debugging-port={port}")
            print()
            print("Then re-run this script with --cdp. Your existing tabs, cookies and")
            print("logins will be preserved.")
            sys.exit(1)

        # Use the FIRST existing browser context so cookies/logins are preserved.
        # Never create a fresh context when one already exists.
        if browser.contexts:
            context = browser.contexts[0]
        else:
            context = browser.new_context()

        opened = []
        for url in urls:
            print(f"Opening {url} in your Chrome...")
            page = context.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                opened.append(url)
            except Exception as e:
                print(f"Could not open {url}: {e}")

        if not opened:
            print("\nNone of the URLs could be opened.")
            sys.exit(1)

        print(f"\nOpened {len(opened)} job tab(s) in your real Chrome ({cdp_endpoint}):")
        for url in opened:
            print(f"  - {url}")
        print("Tabs stay open in your browser (cookies/logins preserved).")
        print("Exiting; your Chrome keeps running.")
        # No keep-open loop in CDP mode: the user's Chrome manages its own lifetime.

if __name__ == "__main__":
    # Accept URLs as command-line arguments and/or from stdin (one URL per line)
    args = sys.argv[1:]
    cdp_mode = False
    cdp_port = DEFAULT_CDP_PORT
    job_urls = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-h", "--help"):
            print_usage()
            sys.exit(0)
        elif arg == "--cdp":
            cdp_mode = True
        elif arg == "--cdp-port":
            if i + 1 >= len(args):
                print("ERROR: --cdp-port requires a port number.", file=sys.stderr)
                sys.exit(1)
            i += 1
            try:
                cdp_port = int(args[i])
            except ValueError:
                print(f"ERROR: Invalid port for --cdp-port: {args[i]}", file=sys.stderr)
                sys.exit(1)
        else:
            job_urls.append(arg)
        i += 1

    if not job_urls and not sys.stdin.isatty():
        job_urls = [line.strip() for line in sys.stdin if line.strip()]

    if not job_urls:
        print_usage()
        sys.exit(1)

    allowed_schemes = ("http://", "https://")
    valid_urls = []
    for url in job_urls:
        if url.startswith(allowed_schemes):
            valid_urls.append(url)
        else:
            print(f"WARNING: skipping non-http(s) URL (unsupported scheme): {url}", file=sys.stderr)
    job_urls = valid_urls

    if not job_urls:
        print("ERROR: no valid http/https URLs to open.", file=sys.stderr)
        sys.exit(1)

    if cdp_mode:
        open_jobs_cdp(job_urls, cdp_port)
    else:
        open_jobs(job_urls)
