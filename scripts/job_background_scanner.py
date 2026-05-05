#!/usr/bin/env python3
"""
Background Job Scanner - Autonomous job search and metadata extraction.
Maintains a CSV of all scanned jobs and integrates with the career-ops pipeline.
"""

import os
import sys
import csv
import json
import re
import time
from datetime import datetime
from urllib.parse import quote
from playwright.sync_api import sync_playwright

# Add root to path to potentially import from other scripts
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(PROJECT_ROOT)

USER_DATA_DIR = os.path.join(PROJECT_ROOT, ".playwright_profile")
COOKIES_FILE = os.path.join(PROJECT_ROOT, ".cookies.json")
PIPELINE_FILE = os.path.join(PROJECT_ROOT, "data", "pipeline.md")
APPLICATIONS_FILE = os.path.join(PROJECT_ROOT, "data", "applications.md")
SCANNED_JOBS_CSV = os.path.join(PROJECT_ROOT, "data", "scanned_jobs.csv")
PROFILE_FILE = os.path.join(PROJECT_ROOT, "config", "profile.yml")

def load_config():
    """Extract keywords and locations from profile.yml."""
    keywords = []
    locations = ["Germany", "Remote"]
    
    if os.path.exists(PROFILE_FILE):
        with open(PROFILE_FILE, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Simple regex extraction for roles
        primary_match = re.search(r'primary:\s*\n((?:\s+-\s+".+"\s*\n)+)', content)
        if primary_match:
            roles = re.findall(r'-\s+"([^"]+)"', primary_match.group(1))
            keywords.extend(roles)
            
    if not keywords:
        keywords = ["AI ML Engineer", "Computer Vision Engineer", "Robotics ML Engineer", "Machine Learning Engineer"]
        
    return keywords, locations

def score_job(job, target_keywords):
    """Score job 1-5 based on career-ops criteria."""
    score = 0
    title = (job.get("title") or "").lower()
    location = (job.get("location") or "").lower()

    # Skip Werkstudent/Student/Intern roles as per user request
    if any(t in title for t in ["werkstudent", "working student", "intern", "praktikum", "student", "thesis"]):
        return 0

    # Title match: 2.5 for target keywords
    for kw in target_keywords:
        if kw.lower() in title:
            score += 2.5
            break

    if score == 0:
        ai_ml_terms = ["ai", "ml", "machine learning", "computer vision", "deep learning", "robotics", "python", "nlp"]
        if any(term in title for term in ai_ml_terms):
            score += 2.0

    # Location match: 1.5 for Germany/remote
    if "germany" in location or "remote" in location or "hybrid" in location:
        score += 1.5
    
    # Bonus for specific high-interest cities but still in Germany
    if any(city in location for city in ["berlin", "munich", "münchen", "hamburg", "frankfurt"]):
        score += 1.0

    return round(min(score, 5.0), 1)

def get_existing_urls():
    """Get URLs already in pipeline or applications."""
    urls = set()
    
    # From pipeline.md
    if os.path.exists(PIPELINE_FILE):
        with open(PIPELINE_FILE, "r") as f:
            content = f.read()
            urls.update(re.findall(r'https://[^\s|]+', content))
            
    # From applications.md (extracting from table)
    if os.path.exists(APPLICATIONS_FILE):
        with open(APPLICATIONS_FILE, "r") as f:
            content = f.read()
            urls.update(re.findall(r'https://[^\s|]+', content))
            
    # From scanned_jobs.csv
    if os.path.exists(SCANNED_JOBS_CSV):
        with open(SCANNED_JOBS_CSV, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                urls.add(row['url'])
                
    # Clean URLs (remove query params)
    cleaned_urls = {u.split('?')[0].rstrip('/') for u in urls if 'linkedin.com/jobs/view' in u or 'linkedin.com/jobs/search' not in u}
    return cleaned_urls

def save_to_csv(jobs):
    """Save jobs to metadata CSV."""
    fieldnames = ['date_scanned', 'job_id', 'title', 'company', 'location', 'url', 'score', 'status']
    file_exists = os.path.exists(SCANNED_JOBS_CSV)
    
    if not file_exists:
        with open(SCANNED_JOBS_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
    
    if not jobs:
        return
        
    with open(SCANNED_JOBS_CSV, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        for job in jobs:
            writer.writerow({
                'date_scanned': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'job_id': job.get('job_id', ''),
                'title': job.get('title', ''),
                'company': job.get('company', ''),
                'location': job.get('location', ''),
                'url': job.get('url', ''),
                'score': job.get('score', 0),
                'status': 'scanned'
            })

def append_to_pipeline(jobs):
    """Append high-score jobs to pipeline.md."""
    if not jobs:
        return
        
    content = ""
    if os.path.exists(PIPELINE_FILE):
        with open(PIPELINE_FILE, "r", encoding="utf-8") as f:
            content = f.read()
            
    new_entries = []
    for job in jobs:
        # Only add very relevant jobs automatically
        if job['score'] >= 4.0:
            loc_short = job["location"].split(",")[0].strip()
            new_entries.append(
                f"- [ ] {job['url']} | {job['company']} | {job['title']} | Score: {job['score']}/5 | {loc_short}"
            )

    if not new_entries:
        return

    insertion_text = "\n".join(new_entries) + "\n"
    if "## Pending\n" in content:
        content = content.replace("## Pending\n", f"## Pending\n\n{insertion_text}", 1)
    else:
        content += f"\n## Pending\n\n{insertion_text}\n"

    with open(PIPELINE_FILE, "w", encoding="utf-8") as f:
        f.write(content)

def load_cookies(context):
    if not os.path.exists(COOKIES_FILE):
        return
    with open(COOKIES_FILE) as f:
        storage = json.load(f)
    
    cookies_list = storage if isinstance(storage, list) else storage.get("cookies", [])
    
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
                continue
            context.add_cookies([pw_cookie])
        except Exception:
            continue

def run_scan():
    roles, locations = load_config()
    existing_urls = get_existing_urls()
    all_new_jobs = []
    
    # Initialize CSV header if not exists
    save_to_csv([])
    
    print(f"[{datetime.now()}] Starting background scan for {len(roles)} roles...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )
        load_cookies(browser)
        page = browser.pages[0]
        
        for loc in locations:
            for role in roles:
                search_url = f"https://www.linkedin.com/jobs/search/?keywords={quote(role)}&location={quote(loc)}"
                try:
                    page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
                    page.wait_for_timeout(5000)
                    
                    # Scroll to load
                    for _ in range(3):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(1000)
                    
                    jobs = page.evaluate("""() => {
                        const results = [];
                        const cards = document.querySelectorAll('.job-card-container');
                        for (const card of cards) {
                            const titleEl = card.querySelector('.job-card-list__title, .artdeco-entity-lockup__title');
                            const companyEl = card.querySelector('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle, .job-card-container__company-name');
                            const locationEl = card.querySelector('.job-card-container__metadata-item, .job-card-container__metadata-wrapper');
                            const linkEl = card.querySelector('a.job-card-container__link, a.job-card-list__title');
                            
                            if (titleEl && linkEl) {
                                const title = titleEl.innerText.split('\\n')[0].replace(' with verification', '').trim();
                                const company = companyEl ? companyEl.innerText.trim() : '';
                                const location = locationEl ? locationEl.innerText.trim() : '';
                                const url = linkEl.href.split('?')[0];
                                results.push({title, company, location, url});
                            }
                        }
                        return results;
                    }""")
                    
                    for job in jobs:
                        clean_url = job['url'].rstrip('/')
                        if clean_url not in existing_urls:
                            job['score'] = score_job(job, roles)
                            job['job_id'] = re.search(r'view/(\d+)', clean_url).group(1) if 'view/' in clean_url else ''
                            all_new_jobs.append(job)
                            existing_urls.add(clean_url)
                            
                except Exception as e:
                    print(f"Error scanning {role} in {loc}: {e}")
                    
        browser.close()
    
    if all_new_jobs:
        print(f"Found {len(all_new_jobs)} new jobs.")
        save_to_csv(all_new_jobs)
        append_to_pipeline(all_new_jobs)
    else:
        print("No new jobs found.")

if __name__ == "__main__":
    run_scan()
