#!/usr/bin/env python3
"""
LinkedIn Job Scanner - Autonomous job search and extraction
"""

import os
import sys
import re
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
COOKIES_FILE = os.path.join(PROJECT_ROOT, ".cookies.json")
PIPELINE_FILE = os.path.join(PROJECT_ROOT, "data", "pipeline.md")
EXAMPLES_DIR = os.path.join(PROJECT_ROOT, "examples")


def load_keywords():
    return [
        "AI ML Engineer Werkstudent Berlin",
        "Computer Vision Engineer Werkstudent Germany",
        "ML Engineer Working Student Berlin",
        "Robotics ML Engineer Intern Germany",
        "Python AI Developer Werkstudent",
        "Computer Vision Intern Berlin",
        "Machine Learning Working Student Germany",
        "AI Research Assistant Berlin",
    ]


def score_job(job, target_keywords):
    """Score job 1-5 based on career-ops criteria"""
    score = 0
    title = (job.get("title") or "").lower()
    location = (job.get("location") or "").lower()

    # Title match: 2 for target keywords, 1.5 for AI/ML terms
    matched_kw = None
    for kw in target_keywords:
        kw_lower = kw.lower()
        if kw_lower in title:
            score += 2
            matched_kw = kw
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
        for term in ai_ml_terms:
            if term in title:
                score += 1.5
                break

    # Location match: 1.5 for Berlin, 1 for Germany/remote
    if "berlin" in location:
        score += 1.5
    elif "germany" in location or "remote" in location or "hybrid" in location:
        score += 1

    # Type match: 1 for intern/student
    if any(
        t in title for t in ["intern", "working student", "werkstudent", "praktikum"]
    ):
        score += 1

    # Cap at 5
    score = min(score, 5.0)

    return round(score, 1)


def build_search_url(keyword, geo_id="91000000", location="Berlin"):
    encoded = keyword.replace(" ", "%20")
    loc_encoded = location.replace(" ", "%2C%20")
    return f"https://www.linkedin.com/jobs/search/?keywords={encoded}&geoId={geo_id}&location={loc_encoded}"


def parse_jobs(html_content):
    """Parse job cards from HTML"""
    jobs = []

    # Find job URLs
    url_pattern = r'href="(https://www\.linkedin\.com/jobs/view/(\d+)/[^"]+)"'
    all_urls = re.findall(url_pattern, html_content)

    # For each unique URL, extract info
    seen_urls = set()
    for url, job_id in all_urls:
        if url in seen_urls:
            continue
        seen_urls.add(url)

        # Find the title near this URL
        title_match = re.search(
            rf'href="{re.escape(url)}"[^>]*aria-label="([^"]+)"', html_content
        )

        # Find company near the URL
        company_match = re.search(
            rf'href="{re.escape(url)}".*?artdeco-entity-lockup__subtitle[^>]*>.*?<span[^>]*>([^<]+)<',
            html_content,
            re.DOTALL,
        )

        # Find location
        location_match = re.search(
            rf'href="{re.escape(url)}".*?job-card-container__metadata[^>]*>.*?<span[^>]*>([^<]+)<',
            html_content,
            re.DOTALL,
        )

        job = {
            "job_id": job_id,
            "url": url,
            "title": title_match.group(1).replace(" with verification", "").strip()
            if title_match
            else f"Job {job_id}",
            "company": company_match.group(1).strip() if company_match else "Unknown",
            "location": location_match.group(1).strip()
            if location_match
            else "Unknown",
        }
        jobs.append(job)

    print(f"Parsed: {len(jobs)} unique jobs from {len(all_urls)} URLs", file=sys.stderr)

    return jobs


def filter_jobs(jobs, target_keywords):
    """Filter jobs by relevance"""
    filtered = []

    for job in jobs:
        title = job["title"].lower()
        location = job["location"].lower()

        # Check for target keywords
        matched = any(kw.lower() in title for kw in target_keywords)

        # Check AI/ML terms if no keyword match
        if not matched:
            ai_ml_terms = [
                "ai",
                "ml",
                "machine learning",
                "computer vision",
                "deep learning",
                "robotics",
                "neural",
                "python",
                "data",
                "nlp",
                "genai",
            ]
            matched = any(term in title for term in ai_ml_terms)

        # Skip senior roles
        skip_terms = ["senior", "lead", "principal", "director", "manager", "head of"]
        if any(term in title for term in skip_terms):
            continue

        # Must be in Germany, Berlin, or remote
        if (
            location
            and "germany" not in location
            and "remote" not in location
            and "berlin" not in location
            and "hybrid" not in location
        ):
            continue

        if matched:
            filtered.append(job)

    return filtered


def main():
    print("=== LinkedIn Job Scanner ===", file=sys.stderr)

    # List example files
    examples = (
        [f for f in os.listdir(EXAMPLES_DIR) if f.endswith(".html")]
        if os.path.exists(EXAMPLES_DIR)
        else []
    )

    if examples:
        all_jobs = []

        for example_file in examples[:2]:
            example_path = os.path.join(EXAMPLES_DIR, example_file)
            with open(example_path) as f:
                html = f.read()
            jobs = parse_jobs(html)
            all_jobs.extend(jobs)

        # Dedupe
        seen = set()
        unique_jobs = []
        for job in all_jobs:
            if job["url"] not in seen:
                seen.add(job["url"])
                unique_jobs.append(job)

        keywords = load_keywords()

        # Score and filter
        scored_jobs = []
        for job in unique_jobs:
            score = score_job(job, keywords)
            job["score"] = score
            # Filter: skip senior roles, require Germany/Berlin
            title = job["title"].lower()
            skip = any(
                t in title
                for t in ["senior", "lead", "principal", "director", "manager"]
            )
            loc = job["location"].lower()
            valid_loc = (
                "germany" in loc
                or "berlin" in loc
                or "remote" in loc
                or "hybrid" in loc
            )
            if not skip and valid_loc and score >= 3.0:
                scored_jobs.append(job)

        scored_jobs.sort(key=lambda x: x["score"], reverse=True)

        print(
            f"Found: {len(unique_jobs)} unique | {len(scored_jobs)} scored ≥3.0\n",
            file=sys.stderr,
        )

        # Output in career-ops format
        print("## LinkedIn Matches\n")
        for job in scored_jobs[:10]:
            short_url = job["url"].split("?")[0]
            loc_short = job["location"].split(",")[0].strip()
            print(
                f"- [ ] {short_url} | {job['company']} | {job['title']} | Score: {job['score']}/5 | {loc_short}"
            )

        # Print summary
        print(
            f"\n--- {len(scored_jobs)} jobs added to pipeline (score ≥3.0) ---",
            file=sys.stderr,
        )
    else:
        print("No example files found", file=sys.stderr)


if __name__ == "__main__":
    main()
