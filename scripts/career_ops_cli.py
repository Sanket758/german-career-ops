#!/usr/bin/env python3
"""career-ops CLI — Run career-ops commands directly from the terminal.

Bypasses OpenCode/Claude Code entirely. Orchestration logic lives here;
Ollama is only called for the parts that actually need reasoning
(evaluation, cover letters). Everything else runs deterministically.

Usage:
    python career_ops_cli.py scan               # Scan portals (no LLM needed)
    python career_ops_cli.py evaluate <url>     # Evaluate a single job posting
    python career_ops_cli.py pipeline           # Process all pending URLs
    python career_ops_cli.py patterns           # Analyze rejection patterns
    python career_ops_cli.py tracker            # Show application status
    python career_ops_cli.py cover-letter <md>  # Convert cover letter to PDF
    python career_ops_cli.py help               # Show all commands

Requires:
    - Node.js (for scan.mjs, analyze-patterns.mjs, generate-pdf.mjs)
    - Ollama running locally (for evaluate/pipeline)
    - playwright (pip) for JD fetching from authenticated portals
"""

import argparse
import json
import os
import re
import subprocess
import sys
import textwrap
import urllib.request
import urllib.error
from datetime import date
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).parent.resolve().parent
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma4:e2b-it-q4_K_M")

# Key project files
CV_PATH = PROJECT_ROOT / "cv.md"
PROFILE_PATH = PROJECT_ROOT / "config" / "profile.yml"
PROFILE_MD_PATH = PROJECT_ROOT / "modes" / "_profile.md"
PIPELINE_PATH = PROJECT_ROOT / "data" / "pipeline.md"
TRACKER_PATH = PROJECT_ROOT / "data" / "applications.md"
REPORTS_DIR = PROJECT_ROOT / "reports"
OUTPUT_DIR = PROJECT_ROOT / "output"
TRACKER_ADDITIONS_DIR = PROJECT_ROOT / "batch" / "tracker-additions"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def color(text: str, code: str) -> str:
    """Wrap text in ANSI color codes for terminal output.

    Args:
        text: The string to colorize.
        code: ANSI color code (e.g., '32' for green).

    Returns:
        ANSI-escaped colored string.
    """
    return f"\033[{code}m{text}\033[0m"


def green(text: str) -> str:
    """Return text in green."""
    return color(text, "32")


def yellow(text: str) -> str:
    """Return text in yellow."""
    return color(text, "33")


def red(text: str) -> str:
    """Return text in red."""
    return color(text, "31")


def cyan(text: str) -> str:
    """Return text in cyan."""
    return color(text, "36")


def bold(text: str) -> str:
    """Return text in bold."""
    return color(text, "1")


def run_node(script: str, *args: str) -> subprocess.CompletedProcess:
    """Run a Node.js script from project root.

    Args:
        script: Filename of the .mjs script.
        *args: Additional CLI arguments.

    Returns:
        CompletedProcess with stdout/stderr captured.
    """
    cmd = ["node", script, *args]
    return subprocess.run(
        cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True
    )


def get_next_report_num() -> int:
    """Determine the next sequential report number.

    Scans the reports/ directory for existing numbered reports.

    Returns:
        Next available report number (max existing + 1).
    """
    existing = []
    if REPORTS_DIR.exists():
        for f in REPORTS_DIR.iterdir():
            match = re.match(r"^(\d+)-", f.name)
            if match:
                existing.append(int(match.group(1)))
    return max(existing, default=0) + 1


def read_file_safe(path: Path, max_chars: int = 0) -> str:
    """Read file contents, returning empty string if missing.

    Args:
        path: File path to read.
        max_chars: If >0, truncate to this many characters.

    Returns:
        File contents as string, or empty string on error.
    """
    try:
        content = path.read_text(encoding="utf-8")
        if max_chars > 0:
            return content[:max_chars]
        return content
    except FileNotFoundError:
        return ""


def extract_score(evaluation: str) -> float:
    """Extract an X.X/5 score from common report formats."""
    patterns = [
        r"^\s*SCORE\s*[:\-]\s*(\d+(?:\.\d+)?)\s*/\s*5\b",
        r"^\s*#+\s*\d+\.?\s*SCORE\s*\(\s*(\d+(?:\.\d+)?)\s*/\s*5\s*\)",
        r"\bScore\s*[:\-]\s*(\d+(?:\.\d+)?)\s*/\s*5\b",
        r"\bSCORE\s*\(\s*(\d+(?:\.\d+)?)\s*/\s*5\s*\)",
    ]
    for pattern in patterns:
        match = re.search(pattern, evaluation, re.IGNORECASE | re.MULTILINE)
        if match:
            return float(match.group(1))
    return 0.0


def extract_field(evaluation: str, field_names: list[str]) -> Optional[str]:
    """Extract a simple metadata field from model output."""
    for field in field_names:
        pattern = rf"^\s*(?:\*\*)?{re.escape(field)}(?:\*\*)?\s*[:\-]\s*(.+?)\s*$"
        match = re.search(pattern, evaluation, re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1).strip().strip("*")
    return None


def extract_recommendation(evaluation: str, score: float) -> str:
    """Extract APPLY/CONSIDER/SKIP, falling back to score thresholds."""
    match = re.search(
        r"^\s*(?:\*\*)?RECOMMENDATION(?:\*\*)?\s*[:\-]\s*(APPLY|CONSIDER|SKIP)\b",
        evaluation,
        re.IGNORECASE | re.MULTILINE,
    )
    if match:
        return match.group(1).upper()

    section = re.search(
        r"#+\s*\d+\.?\s*RECOMMENDATION\b([\s\S]*?)(?:\n\s*---|\n\s*#+\s*\d+\.|\Z)",
        evaluation,
        re.IGNORECASE,
    )
    if section:
        rec_match = re.search(r"\b(APPLY|CONSIDER|SKIP)\b", section.group(1), re.IGNORECASE)
        if rec_match:
            return rec_match.group(1).upper()

    if score >= 4.0:
        return "APPLY"
    if score >= 3.5:
        return "CONSIDER"
    return "SKIP"


# ---------------------------------------------------------------------------
# Ollama Client
# ---------------------------------------------------------------------------

def call_ollama(
    system_prompt: str,
    user_prompt: str,
    model: Optional[str] = None,
    temperature: float = 0.3,
) -> str:
    """Call Ollama API with a system + user prompt.

    Args:
        system_prompt: System context instructions.
        user_prompt: The user query/JD text.
        model: Ollama model name (defaults to OLLAMA_MODEL).
        temperature: Sampling temperature.

    Returns:
        The model's response text.

    Raises:
        ConnectionError: If Ollama is not reachable.
        RuntimeError: If the API returns an error.
    """
    model = model or OLLAMA_MODEL

    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_ctx": 8192,
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("message", {}).get("content", "")
    except urllib.error.URLError as e:
        raise ConnectionError(
            f"Cannot connect to Ollama at {OLLAMA_URL}. "
            f"Is it running? Error: {e}"
        ) from e


# ---------------------------------------------------------------------------
# JD Fetcher (uses playwright_fetch.py or direct HTTP)
# ---------------------------------------------------------------------------

def fetch_jd(url: str) -> str:
    """Fetch job description text from a URL.

    Tries playwright_fetch.py first (handles authenticated portals),
    falls back to direct HTTP fetch for simple Greenhouse/Lever pages.

    Args:
        url: The job posting URL.

    Returns:
        Plain text content of the job description.
    """
    # For Greenhouse/Lever API URLs, try direct JSON first
    greenhouse_match = re.search(
        r"greenhouse\.io/(\w+)/jobs/(\d+)", url
    )
    if greenhouse_match:
        company = greenhouse_match.group(1)
        job_id = greenhouse_match.group(2)
        api_url = (
            f"https://boards-api.greenhouse.io/v1/boards/"
            f"{company}/jobs/{job_id}"
        )
        try:
            req = urllib.request.Request(
                api_url,
                headers={"User-Agent": "career-ops-cli/1.0"},
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                title = data.get("title", "Unknown")
                content = data.get("content", "")
                location = data.get("location", {}).get("name", "")
                # Strip HTML tags from content
                content = re.sub(r"<[^>]+>", " ", content)
                content = re.sub(r"\s+", " ", content).strip()
                return (
                    f"Title: {title}\nLocation: {location}\n\n{content}"
                )
        except Exception:
            pass  # Fall through to Playwright

    # Try playwright_fetch.py
    fetch_script = PROJECT_ROOT / "playwright_fetch.py"
    if fetch_script.exists():
        try:
            result = subprocess.run(
                [
                    sys.executable, str(fetch_script), url,
                ],
                capture_output=True,
                text=True,
                timeout=45,
                cwd=str(PROJECT_ROOT),
            )
            if result.returncode == 0 and len(result.stdout.strip()) > 100:
                return result.stdout.strip()
        except subprocess.TimeoutExpired:
            print(yellow("  ⚠ Playwright timed out, trying HTTP..."))

    # Direct HTTP fallback
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "career-ops-cli/1.0"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
            text = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", html)
            text = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", text)
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"\s+", " ", text).strip()
            return text[:8000]  # Cap for context window
    except Exception as e:
        return f"ERROR: Could not fetch URL: {e}"


# ---------------------------------------------------------------------------
# Build evaluation prompt (condensed for small models)
# ---------------------------------------------------------------------------

def build_eval_system_prompt() -> str:
    """Build a condensed system prompt for job evaluation.

    Reads cv.md and profile.yml, strips them to essential content,
    and constructs a prompt that fits within small model context windows.

    Returns:
        System prompt string optimized for Gemma 4.
    """
    cv = read_file_safe(CV_PATH, max_chars=3000)
    profile = read_file_safe(PROFILE_PATH, max_chars=1500)
    profile_md = read_file_safe(PROFILE_MD_PATH, max_chars=2000)

    return textwrap.dedent(f"""\
    You are a job evaluation assistant. Evaluate the job description against the candidate's CV.

    ## Candidate Profile
    - Location: Berlin, Germany
    - Visa: §16b student permit (20h/week Werkstudent or full-time internship)
    - German: B1 (conversational), English: C1
    - Graduating: August 2026 (MSc in AI)

    ## CV Summary (abbreviated)
    {cv[:2000]}

    ## Target Roles
    {profile[:1000]}

    ## Instructions
    Start with these exact metadata lines:
    Company: <company>
    Role: <role>
    SCORE: <X.X>/5
    RECOMMENDATION: <APPLY|CONSIDER|SKIP>

    Then output a structured evaluation with these sections:

    ### 1. SUMMARY
    Company, Role, Location, Remote Policy, Seniority level, one-line TL;DR

    ### 2. SCORE (X.X/5)
    Score 1-5 based on: skill match, location compatibility, visa eligibility, archetype fit.
    - 4.5+ = strong match, apply immediately
    - 4.0-4.4 = good match, worth applying
    - 3.5-3.9 = decent, apply only with reason
    - Below 3.5 = recommend against

    ### 3. MATCH
    List top 5 matching skills/experiences with specific CV evidence.

    ### 4. GAPS
    List missing requirements. For each: is it a hard blocker or nice-to-have?

    ### 5. BLOCKERS
    Geographic restrictions, visa issues, language requirements, seniority mismatch.
    If location is outside Germany: HARD BLOCKER, score 1.0/5.

    ### 6. RECOMMENDATION
    One of: APPLY, CONSIDER, SKIP. With 1-2 sentence reasoning.

    ### 7. KEYWORDS
    10-15 ATS keywords from the JD for CV optimization.

    Be concise. No fluff. Use bullet points.
    """)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_scan() -> None:
    """Run the portal scanner (node scan.mjs).

    This is zero-LLM — it hits Greenhouse/Ashby/Lever APIs directly.
    """
    print(bold("🔍 Scanning portals..."))
    print("   (This uses scan.mjs — no LLM needed)\n")

    result = run_node("scan.mjs")
    if result.returncode == 0:
        print(result.stdout)
    else:
        print(red("❌ Scan failed:"))
        print(result.stderr)
        # Suggest the user check portals.yml
        if "Cannot find module" in result.stderr:
            print(yellow("\n💡 Try: npm install"))


def cmd_evaluate(url: str, report_num: Optional[int] = None) -> dict:
    """Evaluate a single job posting.

    Fetches the JD, sends it to Ollama for evaluation, writes a report
    and tracker addition.

    Args:
        url: The job posting URL.
        report_num: Override for the report number.

    Returns:
        Dict with keys: company, role, score, recommendation, report_path.
    """
    if report_num is None:
        report_num = get_next_report_num()

    print(f"\n{bold(f'📋 Evaluating #{report_num:03d}')}: {url}")

    # Step 1: Fetch JD
    print("  📥 Fetching job description...")
    jd_text = fetch_jd(url)

    if jd_text.startswith("ERROR:"):
        print(red(f"  {jd_text}"))
        return {"error": jd_text}

    if len(jd_text) < 100:
        print(red("  ❌ JD text too short — page may require login"))
        return {"error": "JD text too short"}

    print(f"  📄 Got {len(jd_text)} chars of JD text")

    # Step 2: Call Ollama
    print(f"  🤖 Evaluating with {OLLAMA_MODEL}...")
    system_prompt = build_eval_system_prompt()
    user_prompt = f"Evaluate this job posting:\n\nURL: {url}\n\n{jd_text[:5000]}"

    try:
        evaluation = call_ollama(system_prompt, user_prompt)
    except ConnectionError as e:
        print(red(f"  ❌ {e}"))
        return {"error": str(e)}

    # Step 3: Extract score and metadata from response
    score = extract_score(evaluation)

    # Try to extract company name
    company_match = re.search(r"^\s*(?:\*\*)?Company(?:\*\*)?\s*[:\-]\s*(.+?)\s*$", evaluation, re.IGNORECASE | re.MULTILINE)
    company = "Unknown"
    if company_match:
        company = company_match.group(1).strip().strip("*")
    else:
        # Try from URL
        domain_match = re.search(r"//(?:.*?)([a-z]+)\.(?:greenhouse|ashby|lever)", url)
        if domain_match:
            company = domain_match.group(1).title()

    # Try to extract role
    role_match = re.search(r"^\s*(?:\*\*)?(?:Role|Title|Position)(?:\*\*)?\s*[:\-]\s*(.+?)\s*$", evaluation, re.IGNORECASE | re.MULTILINE)
    role = role_match.group(1).strip().strip("*") if role_match else "Unknown Role"

    # Try to extract recommendation
    recommendation = extract_recommendation(evaluation, score)

    # Step 4: Write report
    today = date.today().isoformat()
    company_slug = re.sub(r"[^a-z0-9]+", "-", company.lower()).strip("-")
    report_filename = f"{report_num:03d}-{company_slug}-{today}.md"
    report_path = REPORTS_DIR / report_filename

    report_content = textwrap.dedent(f"""\
    # Evaluation: {company} — {role}

    **Date:** {today}
    **Score:** {score}/5
    **URL:** {url}
    **Recommendation:** {recommendation}
    **PDF:** ❌

    ---

    {evaluation}
    """)

    report_path.write_text(report_content, encoding="utf-8")
    print(f"  📝 Report: {report_filename}")

    # Step 5: Write tracker addition TSV
    TRACKER_ADDITIONS_DIR.mkdir(parents=True, exist_ok=True)
    status = "Evaluated" if recommendation != "SKIP" else "SKIP"
    tsv_line = (
        f"{report_num}\t{today}\t{company}\t{role}\t"
        f"{status}\t{score}/5\t❌\t"
        f"[{report_num:03d}](reports/{report_filename})\t"
        f"{recommendation}"
    )
    tsv_path = TRACKER_ADDITIONS_DIR / f"{report_num:03d}-{company_slug}.tsv"
    tsv_path.write_text(tsv_line + "\n", encoding="utf-8")

    # Step 6: Print summary
    score_color = green if score >= 3.8 else (yellow if score >= 3.0 else red)
    print(f"  {score_color(f'⭐ {score}/5')} | {recommendation} | {company} — {role}")

    return {
        "company": company,
        "role": role,
        "score": score,
        "recommendation": recommendation,
        "report_path": str(report_path),
        "report_num": report_num,
    }


def cmd_pipeline() -> None:
    """Process all pending URLs from data/pipeline.md.

    Reads the Pendientes section, evaluates each URL sequentially
    via Ollama, then moves them to Procesadas.
    """
    print(bold("📦 Processing pipeline...\n"))

    pipeline_text = read_file_safe(PIPELINE_PATH)
    if not pipeline_text:
        print(red("❌ data/pipeline.md not found"))
        return

    # Extract pending URLs
    pending = []
    for line in pipeline_text.split("\n"):
        match = re.match(
            r"^- \[ \]\s+(https?://\S+)\s*(?:\|(.*))?$", line.strip()
        )
        if match:
            url = match.group(1)
            meta = match.group(2).strip() if match.group(2) else ""
            pending.append((url, meta, line.strip()))

    if not pending:
        print(yellow("📭 No pending URLs in pipeline.md"))
        return

    print(f"Found {bold(str(len(pending)))} pending URL(s)\n")

    results = []
    next_num = get_next_report_num()

    for i, (url, meta, original_line) in enumerate(pending, 1):
        print(f"\n{'━' * 60}")
        print(f"  [{i}/{len(pending)}] {url}")
        if meta:
            print(f"  Meta: {meta}")

        result = cmd_evaluate(url, report_num=next_num)
        result["original_line"] = original_line
        result["url"] = url
        results.append(result)
        next_num += 1

        # Checkpoint after each URL so long local runs can be resumed safely.
        updated = PIPELINE_PATH.read_text(encoding="utf-8")
        if "error" not in result:
            score = result.get("score", 0)
            company = result.get("company", "Unknown")
            role = result.get("role", "Unknown")
            new_line = (
                f"- [x] {url} | {company} | {role} | "
                f"Score: {score}/5 | "
                f"[Report](reports/{Path(result['report_path']).name})"
            )
            updated = updated.replace(original_line, "")
            if "## Procesadas" in updated:
                updated = updated.replace(
                    "## Procesadas",
                    f"## Procesadas\n\n{new_line}",
                    1,
                )
            else:
                updated += f"\n## Procesadas\n\n{new_line}\n"
        else:
            err = result.get("error", "Unknown error")
            updated = updated.replace(original_line, f"- [!] {url} — Error: {err}")
        PIPELINE_PATH.write_text(updated, encoding="utf-8")

    # Merge tracker
    print(f"\n{'━' * 60}")
    print("\n📊 Merging tracker additions...")
    merge_result = run_node("merge-tracker.mjs")
    if merge_result.returncode == 0:
        print(merge_result.stdout)
    else:
        print(yellow(f"  ⚠ Merge: {merge_result.stderr[:200]}"))

    # Sync emails to update statuses
    print(f"\n{'━' * 60}")
    cmd_sync_emails()

    # Summary table
    print(f"\n{bold('📊 Pipeline Summary')}")
    print(f"{'─' * 60}")
    print(f"{'#':>4} | {'Company':<20} | {'Role':<20} | {'Score':>6} | Rec")
    print(f"{'─' * 60}")
    for r in results:
        if "error" not in r:
            sc = r["score"]
            sc_str = f"{sc}/5"
            sc_color = green if sc >= 3.8 else (yellow if sc >= 3.0 else red)
            print(
                f"{r.get('report_num', 0):>4} | "
                f"{r['company']:<20.20} | "
                f"{r['role']:<20.20} | "
                f"{sc_color(sc_str):>6} | "
                f"{r['recommendation']}"
            )
        else:
            print(f"{'?':>4} | {'ERROR':<20} | {r.get('url', '?'):<20.20} |")


def cmd_patterns() -> None:
    """Analyze rejection patterns (node analyze-patterns.mjs).

    No LLM needed — the script outputs JSON, which we format.
    """
    print(bold("📊 Analyzing patterns...\n"))

    result = run_node("analyze-patterns.mjs")
    if result.returncode != 0:
        print(red(f"❌ {result.stderr}"))
        return

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        print(red("❌ Could not parse analysis output"))
        print(result.stdout[:500])
        return

    meta = data.get("metadata", {})
    funnel = data.get("funnel", {})
    scores = data.get("scoreComparison", {})
    threshold = data.get("scoreThreshold", {})
    recs = data.get("recommendations", [])

    total = meta.get("total", 0)
    outcomes = meta.get("byOutcome", {})

    print(f"  Applications: {bold(str(total))}")
    print(
        f"  Outcomes: {green(str(outcomes.get('positive', 0)))} positive, "
        f"{red(str(outcomes.get('negative', 0)))} negative, "
        f"{yellow(str(outcomes.get('self_filtered', 0)))} self-filtered"
    )

    # Funnel
    print(f"\n{bold('Funnel')}:")
    for stage, count in funnel.items():
        pct = (count / total * 100) if total else 0
        bar = "█" * int(pct / 2)
        print(f"  {stage:<15} {count:>3}  {bar} {pct:.0f}%")

    # Score comparison
    print(f"\n{bold('Score vs Outcome')}:")
    for outcome, stats in scores.items():
        if stats.get("count", 0) > 0:
            print(
                f"  {outcome:<15} "
                f"avg={stats['avg']:.1f}/5  "
                f"range=[{stats['min']:.1f}-{stats['max']:.1f}]  "
                f"n={stats['count']}"
            )

    # Threshold
    if threshold.get("recommended"):
        print(
            f"\n{bold('Recommended score floor')}: "
            f"{green(str(threshold['recommended']) + '/5')}"
        )
        print(f"  {threshold.get('reasoning', '')}")

    # Recommendations
    if recs:
        print(f"\n{bold('Recommendations')}:")
        for i, rec in enumerate(recs, 1):
            impact = rec.get("impact", "").upper()
            impact_color = (
                red if impact == "HIGH" else
                yellow if impact == "MEDIUM" else
                cyan
            )
            print(f"  {i}. [{impact_color(impact)}] {rec['action']}")
            print(f"     {rec.get('reasoning', '')}")


def cmd_sync_emails() -> None:
    """Sync job application statuses from Gmail."""
    print(bold("📧 Syncing Gmail for application updates..."))
    try:
        from gmail_sync import check_emails
        check_emails()
    except ImportError:
        print(yellow("  ⚠ gmail_sync.py not found. Skipping email sync."))
    except Exception as e:
        print(red(f"❌ Failed to sync emails: {e}"))

def cmd_tracker() -> None:
    """Display the application tracker."""
    cmd_sync_emails()
    print()

    print(bold("📋 Application Tracker\n"))

    content = read_file_safe(TRACKER_PATH)
    if not content:
        print(yellow("No applications tracked yet."))
        return

    # Parse and pretty-print the table
    lines = content.strip().split("\n")
    for line in lines:
        if "APPLIED" in line or "Applied" in line:
            print(green(line))
        elif "SKIP" in line:
            print(yellow(line))
        elif "Rejected" in line:
            print(red(line))
        elif "Interview" in line or "Offer" in line:
            print(cyan(line))
        else:
            print(line)

    # Stats
    applied = content.count("APPLIED") + content.count("Applied")
    skip = content.count("SKIP")
    total = applied + skip
    print(f"\n{bold('Stats')}: {total} total | "
          f"{green(f'{applied} applied')} | "
          f"{yellow(f'{skip} skipped')}")


def cmd_cover_letter_pdf(md_path: str) -> None:
    """Convert a cover letter .md to PDF.

    Args:
        md_path: Path to the markdown cover letter file.
    """
    print(bold(f"📄 Converting {md_path} to PDF...\n"))

    result = run_node("generate-cover-letter-pdf.mjs", md_path)
    if result.returncode == 0:
        print(result.stdout)
    else:
        print(red(f"❌ {result.stderr}"))


def cmd_cover_letters_all() -> None:
    """Convert all cover letter .md files in output/ to PDF."""
    print(bold("📄 Converting all cover letters to PDF...\n"))

    result = run_node("generate-cover-letter-pdf.mjs", "--all")
    print(result.stdout)
    if result.returncode != 0:
        print(red(result.stderr))


def cmd_help() -> None:
    """Show available commands."""
    print(f"""
{bold('career-ops CLI')} — Terminal-native job search pipeline
{'━' * 55}

{cyan('Scan & Discover')} (no LLM needed):
  {bold('scan')}                 Scan portals for new offers
  {bold('patterns')}             Analyze rejection patterns
  {bold('tracker')}              Show application status
  {bold('sync')}                 Sync application statuses from Gmail

{cyan('Evaluate')} (uses Ollama: {OLLAMA_MODEL}):
  {bold('evaluate <url>')}       Evaluate a single job posting
  {bold('pipeline')}             Process all pending URLs

{cyan('Generate')} (no LLM needed):
  {bold('cover-letter <.md>')}   Convert cover letter to PDF
  {bold('cover-letters')}        Convert ALL .md in output/ to PDF

{cyan('Config')}:
  OLLAMA_MODEL={OLLAMA_MODEL}
  OLLAMA_URL={OLLAMA_URL}

  Override: OLLAMA_MODEL=qwen2.5-coder:7b python career_ops_cli.py evaluate <url>
""")


# ---------------------------------------------------------------------------
# Main CLI
# ---------------------------------------------------------------------------

def main() -> None:
    """Parse CLI arguments and dispatch to the appropriate command."""
    parser = argparse.ArgumentParser(
        description="career-ops CLI — Run career-ops from your terminal",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # scan
    subparsers.add_parser("scan", help="Scan portals for new offers")

    # evaluate
    eval_parser = subparsers.add_parser(
        "evaluate", help="Evaluate a single job posting"
    )
    eval_parser.add_argument("url", help="Job posting URL")

    # pipeline
    subparsers.add_parser(
        "pipeline", help="Process all pending URLs from pipeline.md"
    )

    # patterns
    subparsers.add_parser("patterns", help="Analyze rejection patterns")

    # tracker
    subparsers.add_parser("tracker", help="Show application tracker")

    # sync
    subparsers.add_parser("sync", help="Sync job application statuses from Gmail")

    # cover-letter
    cl_parser = subparsers.add_parser(
        "cover-letter", help="Convert cover letter .md to PDF"
    )
    cl_parser.add_argument("md_path", help="Path to .md file")

    # cover-letters (batch)
    subparsers.add_parser(
        "cover-letters", help="Convert all .md in output/ to PDF"
    )

    # help
    subparsers.add_parser("help", help="Show all commands")

    args = parser.parse_args()

    if args.command == "scan":
        cmd_scan()
    elif args.command == "evaluate":
        cmd_evaluate(args.url)
    elif args.command == "pipeline":
        cmd_pipeline()
    elif args.command == "patterns":
        cmd_patterns()
    elif args.command == "tracker":
        cmd_tracker()
    elif args.command == "sync":
        cmd_sync_emails()
    elif args.command == "cover-letter":
        cmd_cover_letter_pdf(args.md_path)
    elif args.command == "cover-letters":
        cmd_cover_letters_all()
    elif args.command == "help":
        cmd_help()
    else:
        cmd_help()


if __name__ == "__main__":
    main()
