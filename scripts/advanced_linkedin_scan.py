#!/usr/bin/env python3
"""
Advanced LinkedIn Job Scanner - Automated browser-based scanning
This script bypasses manual HTML saving by directly automating the browser
to navigate LinkedIn, scroll through multiple pages across all target roles,
score the results, and automatically append only high-quality matches to
your career-ops pipeline format.
"""

import sys
import os
import argparse
import json
import re
import time
from urllib.parse import quote
from playwright.sync_api import sync_playwright

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
USER_DATA_DIR = os.path.join(PROJECT_ROOT, ".playwright_profile")
COOKIES_FILE = os.path.join(PROJECT_ROOT, ".cookies.json")
PIPELINE_FILE = os.path.join(PROJECT_ROOT, "data", "pipeline.md")
PROFILE_FILE = os.path.join(PROJECT_ROOT, "config", "profile.yml")


def load_profile_keywords_and_locations():
    """Extract keywords and locations from profile.yml using generic parsing."""
    keywords = []
    locations = ["Berlin, Germany", "Munich, Germany", "Frankfurt, Germany", "Remote, Germany"]

    if os.path.exists(PROFILE_FILE):
        with open(PROFILE_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        # Regex-based extraction to avoid strict PyYAML dependency
        primary_match = re.search(r'primary:\s*\n((?:\s+-\s+".+"\s*\n)+)', content)
        if primary_match:
            roles = re.findall(r'-\s+"([^"]+)"', primary_match.group(1))
            keywords.extend(roles)

        if not keywords:
            keywords = [
                "AI ML Engineer Werkstudent",
                "Computer Vision Engineer Werkstudent",
                "ML Engineer",
                "Robotics ML Engineer",
                "AI Internship",
                "Computer Vision Internship",
                "Werkstudent AI",
                "Werkstudent Computer Vision",
                "Werkstudent Robotics ML",
                "AI Engineer Internship",
                "Computer Vision Engineer Internship",
                "Robotics ML Engineer Internship",
                "AI Engineer Werkstudent",
                "Computer Vision Engineer Werkstudent",
                "Robotics ML Engineer Werkstudent",
                "AI Intern",
                "Computer Vision Intern",
                "Robotics ML Intern",
                "AI Intern Werkstudent",
                "Computer Vision Intern Werkstudent",
                "Robotics ML Intern Werkstudent",
                "AI Intern Praktikum",
                "Computer Vision Intern Praktikum",
                "Robotics ML Intern Praktikum",
                "AI Intern Praktikum Werkstudent",
                "Computer Vision Intern Praktikum Werkstudent",
                "Robotics ML Intern Praktikum Werkstudent",
                "AI Intern Praktikum Werkstudent",
                "Computer Vision Intern Praktikum Werkstudent",
                "Robotics ML Intern Praktikum Werkstudent",
                "AI Intern Praktikum Werkstudent",
                "Computer Vision Intern Praktikum Werkstudent",
                "Robotics ML Intern Praktikum Werkstudent",
                "AI Intern Praktikum Werkstudent",
                "Computer Vision Intern Praktikum Werkstudent",
                "Robotics ML Intern Praktikum Werkstudent",
                "AI Intern Praktikum Werkstudent",
                "Computer Vision Intern Praktikum Werkstudent",
                "Robotics ML Intern Praktikum Werkstudent",
                "AI Intern Praktikum Werkstudent",
                "Computer Vision Intern Praktikum Werkstudent",
                "Robotics ML Intern Praktikum Werkstudent",
                "AI Intern Praktikum Werkstudent",
                "Computer Vision Intern Praktikum Werkstudent",
                "Robotics ML Intern Praktikum Werkstudent",
            ]

        loc_country_match = re.search(r'country:\s*"([^"]+)"', content)
        loc_city_match = re.search(r'city:\s*"([^"]+)"', content)
        if loc_city_match and loc_country_match:
            primary_loc = f"{loc_city_match.group(1)}, {loc_country_match.group(1)}"
            country_only = loc_country_match.group(1)
            locations = [primary_loc, f"Munich, {country_only}", f"Frankfurt, {country_only}", f"Remote, {country_only}"]

    return keywords, locations


def score_job(job, target_keywords):
    """Score job 1-5 based on career-ops criteria"""
    score = 0
    title = (job.get("title") or "").lower()
    location = (job.get("location") or "").lower()

    # Title match: 2 for target keywords, 1.5 for AI/ML terms
    for kw in target_keywords:
        if kw.lower() in title:
            score += 2
            break

    if score == 0:
        ai_ml_terms = [
            "ai",
            "ml",
            "machine learning",
            "computer vision",
            "deep learning",
            "robotics",
            "neural",
            "python",
            "data science",
            "nlp",
            "genai",
        ]
        if any(term in title for term in ai_ml_terms):
            score += 1.5

    # Location match: 1.5 for Berlin, 1 for Germany/remote
    if "berlin" in location:
        score += 1.5
    elif "germany" in location or "remote" in location or "hybrid" in location:
        score += 1

    # Type match: 1 for intern/student
    if any(
        t in title
        for t in ["intern", "working student", "werkstudent", "praktikum", "student"]
    ):
        score += 1

    return round(min(score, 5.0), 1)


def filter_scored_jobs(jobs, min_score=3.0):
    """Filter jobs by min_score and remove senior roles"""
    filtered = []
    skip_terms = ["senior", "lead", "principal", "director", "manager", "head of"]

    for job in jobs:
        title = job.get("title", "").lower()
        if any(term in title for term in skip_terms):
            continue
        if job.get("score", 0) >= min_score:
            filtered.append(job)
    return filtered


def load_cookies_into_context(context, cookies_file_path):
    """Loads cookies from array or Brave exported formats"""
    if not os.path.exists(cookies_file_path):
        return 0, 0

    with open(cookies_file_path) as f:
        storage = json.load(f)

    cookies_list = storage if isinstance(storage, list) else storage.get("cookies", [])

    loaded = 0
    skipped = 0
    VALID_SAME_SITE = {"Strict", "Lax", "None"}

    for cookie in cookies_list:
        try:
            pw_cookie = {
                "name": cookie["name"],
                "value": cookie["value"],
                "domain": cookie.get("domain", ""),
                "path": cookie.get("path", "/"),
            }
            if cookie.get("secure"):
                pw_cookie["secure"] = True
            if cookie.get("httpOnly"):
                pw_cookie["httpOnly"] = True
            if cookie.get("sameSite") in VALID_SAME_SITE:
                pw_cookie["sameSite"] = cookie["sameSite"]

            if not pw_cookie["domain"]:
                skipped += 1
                continue
            context.add_cookies([pw_cookie])
            loaded += 1
        except Exception:
            skipped += 1

    return loaded, skipped


def fetch_jobs_from_linkedin(roles, locations, max_pages, headless=True):
    print(
        f"Starting LinkedIn Scanner: Roles={len(roles)}, Locations={len(locations)}, Max Pages/Role/Loc={'Unlimited' if max_pages == -1 else max_pages}",
        file=sys.stderr,
    )
    all_jobs = []

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=headless,
            viewport={"width": 1280, "height": 800},
            args=["--disable-blink-features=AutomationControlled"],
        )

        loaded, skipped = load_cookies_into_context(context, COOKIES_FILE)
        print(f"Cookies: {loaded} loaded, {skipped} skipped", file=sys.stderr)

        page = context.pages[0] if context.pages else context.new_page()

        for location in locations:
            for role in roles:
                page_num = 0
                while True:
                    if max_pages != -1 and page_num >= max_pages:
                        break

                    start_offset = page_num * 25
                    enc_keyword = quote(role)
                    enc_location = quote(location)
                    search_url = f"https://www.linkedin.com/jobs/search/?keywords={enc_keyword}&location={enc_location}&start={start_offset}"

                    print(
                        f"Fetching: {role} in {location} (Page {page_num + 1}/{'Unlimited' if max_pages == -1 else max_pages})",
                        file=sys.stderr,
                    )
                    try:
                        page.goto(search_url, wait_until="domcontentloaded", timeout=45000)
                        page.wait_for_timeout(3000)

                        # Scroll down multiple times to load lazy job cards
                        for _ in range(5):
                            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                            page.evaluate(
                                """
                                var container = document.querySelector('.jobs-search-results-list');
                                if(container) container.scrollTo(0, container.scrollHeight);
                            """
                            )
                            page.wait_for_timeout(1000)

                        # Extract jobs
                        jobs_data = page.evaluate(
                            """() => {
                            let extracted = [];
                            document.querySelectorAll('.job-card-container').forEach(card => {
                                let titleEl = card.querySelector('.job-card-list__title, .artdeco-entity-lockup__title');
                                let companyEl = card.querySelector('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle');
                                let locationEl = card.querySelector('.job-card-container__metadata-item');
                                let linkEl = card.querySelector('a.job-card-container__link, a.job-card-list__title');
                                
                                if(titleEl && linkEl) {
                                    extracted.push({
                                        title: titleEl.innerText.trim(),
                                        company: companyEl ? companyEl.innerText.trim() : "Unknown",
                                        location: locationEl ? locationEl.innerText.trim() : "Unknown",
                                        url: linkEl.href
                                    });
                                }
                            });
                            return extracted;
                        }"""
                        )

                        print(f"  -> Extracted {len(jobs_data)} job cards", file=sys.stderr)
                        if not jobs_data:
                            print(
                                f"  -> No jobs found. Skipping remaining pages for '{role}' in {location}.",
                                file=sys.stderr,
                            )
                            break

                        all_jobs.extend(jobs_data)
                        page.wait_for_timeout(2000)
                        page_num += 1

                    except Exception as e:
                        print(f"Error fetching page: {e}", file=sys.stderr)
                        break

        context.close()

    # Deduplicate by jobId / clean url
    unique_jobs = {}
    for j in all_jobs:
        c_url = j["url"].split("?")[0]
        if c_url.endswith("/"):
            c_url = c_url[:-1]

        job_id_match = re.search(r"view/(\d+)", c_url)
        uid = job_id_match.group(1) if job_id_match else c_url

        j["url"] = c_url
        unique_jobs[uid] = j

    return list(unique_jobs.values())


def append_to_pipeline(jobs):
    content = ""
    if os.path.exists(PIPELINE_FILE):
        with open(PIPELINE_FILE, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        print(f"Error: Pipeline file not found at {PIPELINE_FILE}", file=sys.stderr)
        return False

    new_entries = []
    existing_urls = set(
        re.findall(r"(https://www\.linkedin\.com/jobs/view/\d+)", content)
    )

    for job in jobs:
        if job["url"] in existing_urls:
            continue

        loc_short = job["location"].split(",")[0].strip()
        new_entries.append(
            f"- [ ] {job['url']} | {job['company']} | {job['title']} | Score: {job['score']}/5 | {loc_short}"
        )
        existing_urls.add(job["url"])

    if not new_entries:
        print("No new unique jobs to add.", file=sys.stderr)
        return False

    insertion_text = "\n".join(new_entries) + "\n"

    if "## Pending\n" in content:
        content = content.replace("## Pending\n", f"## Pending\n\n{insertion_text}", 1)
    elif "## Pendientes\n" in content:
        content = content.replace(
            "## Pendientes\n", f"## Pendientes\n\n{insertion_text}", 1
        )
    else:
        content += f"\n## Pending\n\n{insertion_text}\n"

    with open(PIPELINE_FILE, "w", encoding="utf-8") as f:
        f.write(content)

    print(
        f"\nSuccessfully added {len(new_entries)} jobs to {PIPELINE_FILE}",
        file=sys.stderr,
    )
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Advanced LinkedIn Scanner with Playwright"
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=-1,
        help="Max number of pages to scrape per role (-1 for unlimited)",
    )
    parser.add_argument(
        "--visible", action="store_true", help="Show browser window while running"
    )
    args = parser.parse_args()

    roles, locations = load_profile_keywords_and_locations()

    if not roles:
        print("Error: No target roles found. Check config/profile.yml", file=sys.stderr)
        sys.exit(1)

    jobs = fetch_jobs_from_linkedin(
        roles, locations, args.max_pages, headless=not args.visible
    )

    scored_jobs = []
    for j in jobs:
        j["score"] = score_job(j, roles)
        scored_jobs.append(j)

    filtered_jobs = filter_scored_jobs(scored_jobs, min_score=3.8)
    filtered_jobs.sort(key=lambda x: x["score"], reverse=True)

    print(
        f"\nTotal scraped: {len(jobs)} | Filtered (Score >= 3.8): {len(filtered_jobs)}",
        file=sys.stderr,
    )

    if filtered_jobs:
        append_to_pipeline(filtered_jobs)
