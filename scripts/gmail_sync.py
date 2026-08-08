#!/usr/bin/env python3
import os
import sys
import argparse
import datetime
import warnings
import csv
import re
import base64
import email
import html
import quopri
import email.utils

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(iterable, **kwargs):
        return iterable

# Suppress python version FutureWarnings from google API core
warnings.filterwarnings("ignore", category=FutureWarning)

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# ── Path resolution ──
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)  # scripts/ is one level below project root

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
GMAIL_CREDS_PATH = os.environ.get("GMAIL_CREDS_PATH", os.path.join(PROJECT_ROOT, "credentials.json"))
if not os.path.isabs(GMAIL_CREDS_PATH):
    GMAIL_CREDS_PATH = os.path.join(PROJECT_ROOT, GMAIL_CREDS_PATH)
APPLICATIONS_FILE = os.path.join(PROJECT_ROOT, "data", "applications.md")
TOKEN_PATH = os.path.join(PROJECT_ROOT, "token.json")


def get_gmail_service():
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(GMAIL_CREDS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, "w") as token:
            token.write(creds.to_json())
        os.chmod(TOKEN_PATH, 0o600)
    return build("gmail", "v1", credentials=creds)


def parse_tracker():
    if not os.path.exists(APPLICATIONS_FILE):
        return [], []
    with open(APPLICATIONS_FILE, "r") as f:
        lines = f.readlines()

    apps = []
    for line in lines:
        if line.strip().startswith("|") and "Company" not in line and "---" not in line:
            parts = line.split("|")
            if len(parts) >= 8:
                company = parts[3].strip()
                status = parts[6].strip()
                apps.append(
                    {
                        "line": line,
                        "company": company,
                        "status": status,
                        "index": lines.index(line),
                    }
                )
    return apps, lines


def extract_message_body(payload, max_chars=4000, _depth=0):
    """Recursively walk a Gmail payload and return the richest plain-text body.

    Prefers a text/plain part; falls back to text/html (tags stripped).
    Caps the returned text at max_chars, and bounds recursion depth to
    defend against arbitrarily deep MIME nesting (crafted emails).
    """
    if _depth > 20:
        return ""
    data = payload.get("body", {}).get("data")
    mime = payload.get("mimeType", "")
    text = ""
    if data:
        try:
            raw = base64.urlsafe_b64decode(data.encode("ascii"))
        except Exception:
            raw = data.encode("utf-8", "replace")
        if mime == "text/html":
            text = re.sub(r"<[^>]+>", " ", raw.decode("utf-8", "replace"))
            text = html.unescape(text)
            text = re.sub(r"\s+", " ", text).strip()
        elif mime == "text/plain":
            text = raw.decode("utf-8", "replace").strip()
        if text:
            return text[:max_chars]

    parts = payload.get("parts") or []
    for part in parts:
        candidate = extract_message_body(part, max_chars=max_chars, _depth=_depth + 1)
        if candidate:
            return candidate

    return ""


# Phrases that only signal a decision when they appear alongside application
# context. "unfortunately"/"leider" alone is NOT a rejection ("unfortunately we
# are experiencing delays..."). We require an explicit application token nearby.
_APPLICATION_CONTEXT_TOKENS = [
    "application",
    "bewerbung",
    "your role",
    "ihre bewerbung",
    "interview",
    "position",
    "stelle",
    "recruiting",
    "hiring",
    "candidate",
    "vacancy",
]

_DELAY_MARKERS = [
    "experiencing delays",
    "processing delays",
    "delay in our",
    "delay in our review",
    "will update you",
    "keep you informed",
    "as soon as possible",
    "we are still reviewing",
    "still under review",
    "we will get back to you",
    "verzögerung",
    "verzögert sich",
    "werden wir uns melden",
    "sind weiterhin am prüfen",
    "informieren wir sie bald",
    "unterbrechung",
    "zu einem späteren zeitpunkt",
]

# (status, keyword list, requires_app_context)
_STATUS_RULES = (
    (
        "REJECTED",
        [
            "we have decided to move forward with other",
            "we have decided to move forward with another",
            "decision to proceed with other candidates",
            "decided to proceed with other",
            "will not be moving forward",
            "we will not be moving forward",
            "not moving forward",
            "no longer under consideration",
            "pursue other candidates",
            "pursue other applicants",
            "won't be moving forward",
            "will not be moving forward",
            "your application has been rejected",
            "application has been rejected",
            "not to move forward",
            "cannot offer you the position",
            "unable to offer you the position",
            "due to the large number of qualified candidates",
            "unsere absage",
            "unsere absage",
            "eine absage",
            "leider müssen wir ihnen mitteilen",
            "mitteilen, dass wir",
            "ihre bewerbung wurde abgelehnt",
            "bewerbung wurde abgelehnt",
            "nachteilig entschieden",
            "anderweitig entschieden",
            "anderen bewerber",
            "anderen kandidaten",
            "konnten wir uns nicht für sie entscheiden",
            "können wir ihre bewerbung nicht berücksichtigen",
            "nicht berücksichtigen",
            "bedauern",
            "absage",
            "abgelehnt",
        ],
        False,
    ),
    (
        "REJECTED",
        [
            "unfortunately",
            "leider",
            "regret",
            "regret to inform you",
            "to inform you that we",
        ],
        True,
    ),
    (
        "INTERVIEW",
        [
            "we would like to invite you to an interview",
            "invited to an interview",
            "interview invitation",
            "next step in the process",
            "we would like to get to know you",
            "telefonisches interview",
            "telefoninterview",
            "virtual interview",
            "video call",
            "first interview",
            "we have scheduled",
            "interview",
            "invitation",
            "einladung",
            "kennenlernen",
            "vorstellungsgespräch",
        ],
        False,
    ),
    (
        "OFFER",
        [
            "congratulations ... offer",
            "we are pleased to offer you",
            "we would like to offer you",
            "extend you an offer",
            "herzlichen glückwunsch",
            "wir freuen uns, ihnen",
            "vertragsangebot",
            "arbeitsvertrag",
            "salary offer",
            "job offer",
            "formal offer",
        ],
        False,
    ),
)


def analyze_message_for_status(subject, snippet, body):
    """Return (status, reason_keyword, matched_keyword) or (None, None, None)."""
    text = " ".join([subject, snippet, body]).lower()
    for status, keywords, requires_context in _STATUS_RULES:
        for kw in keywords:
            if kw in text:
                if requires_context:
                    if not any(tok in text for tok in _APPLICATION_CONTEXT_TOKENS):
                        continue
                    if status == "REJECTED" and any(
                        d in text for d in _DELAY_MARKERS
                    ):
                        continue
                return status, kw, kw
    return None, None, None

def extract_company_and_role(sender, subject):
    company = "Unknown Company"
    role = "Unknown Role"

    match_sender = re.match(r'^"?([^"<]+)', sender)
    if match_sender:
        sender_name = match_sender.group(1).strip()
        suffixes = [" Recruiting Team", " Recruiting", " Talent Acquisition", " HR", " Careers", " Team", " Group Hiring"]
        for suffix in suffixes:
            if sender_name.lower().endswith(suffix.lower()):
                sender_name = sender_name[:-len(suffix)].strip()
        if sender_name and "no-reply" not in sender_name.lower() and "noreply" not in sender_name.lower() and "@" not in sender_name:
            company = sender_name

    if "LinkedIn" in sender or "LinkedIn" in company:
        m = re.search(r'application to (.*?) at (.*?)(?: - |$)', subject, re.IGNORECASE)
        if m:
            return m.group(2).strip(), m.group(1).strip()

    role_patterns = [
        r'application (?:for|as) (.*?)(?: at | - |$)',
        r'Bewerbung (?:als|für) (.*?)(?: bei | - |$)',
        r'position (?:of|as) (.*?)(?: at | - |$)'
    ]
    for pattern in role_patterns:
        m = re.search(pattern, subject, re.IGNORECASE)
        if m:
            role = m.group(1).strip()
            break
            
    company_patterns = [
        r'application (?:at|to) (.*?)(?: - |$)',
        r'Bewerbung bei[m]? (.*?)(?: - |$)',
    ]
    if company == "Unknown Company" or "LinkedIn" in company:
        for pattern in company_patterns:
            m = re.search(pattern, subject, re.IGNORECASE)
            if m:
                company = m.group(1).strip()
                break

    if company == "Unknown Company":
        domain_match = re.search(r'@([a-zA-Z0-9.-]+)', sender)
        if domain_match:
            domain = domain_match.group(1).lower()
            if "gmail.com" not in domain and "yahoo" not in domain and "join.com" not in domain and "successfactors" not in domain:
                company = domain.split('.')[0].capitalize()

    company = re.sub(r'(?i)\b(gmbh|inc\.?|llc|corp|group|ag|ltd\.?)\b', '', company).strip()
    company = re.sub(r'[,. ]+$', '', company).strip()
    if not company:
        company = "Unknown Company"

    return company, role


def check_emails():
    try:
        service = get_gmail_service()
    except Exception as e:
        print(f"Failed to connect to Gmail: {e}")
        return

    lookback_days = int(
        os.environ.get("GMAIL_LOOKBACK_DAYS", "30")
    )
    date_n_days_ago = (datetime.date.today() - datetime.timedelta(days=lookback_days)).strftime(
        "%Y/%m/%d"
    )
    query = f"((subject:application OR subject:interview OR subject:update OR subject:rejected OR subject:offer OR subject:status) after:{date_n_days_ago}) OR label:jobs-jobs-rejected"

    print(f"Querying Gmail with: {query}")
    messages = []
    page_token = None
    while True:
        try:
            results = service.users().messages().list(userId="me", q=query, pageToken=page_token).execute()
            messages.extend(results.get("messages", []))
            page_token = results.get("nextPageToken")
            if not page_token:
                break
        except Exception as e:
            print(f"Error querying Gmail: {e}")
            break

    if not messages:
        print("No relevant messages found.")
        return

    print(f"Found {len(messages)} messages. Analyzing against tracked jobs...")
    
    # Try to find the label ID for jobs-jobs-rejected to force REJECTED status
    rejected_label_id = None
    try:
        labels_results = service.users().labels().list(userId="me").execute()
        for label in labels_results.get("labels", []):
            label_name_lower = label["name"].lower()
            if "jobs-rejected" in label_name_lower or "jobs-jobs-rejected" in label_name_lower:
                rejected_label_id = label["id"]
                break
    except Exception as e:
        print(f"Warning: Could not fetch labels to find rejected label ID: {e}")

    company_updates = []

    for message in tqdm(messages, desc="Analyzing Emails"):
        try:
            msg = (
                service.users()
                .messages()
                .get(userId="me", id=message["id"], format="full")
                .execute()
            )
        except Exception as e:
            print(f"Error fetching message {message['id']}: {e}")
            continue
            
        headers = msg["payload"]["headers"]
        subject = next(
            (h["value"] for h in headers if h["name"].lower() == "subject"), ""
        )
        sender = next((h["value"] for h in headers if h["name"].lower() == "from"), "")
        date_str = next((h["value"] for h in headers if h["name"].lower() == "date"), "")
        snippet = msg.get("snippet", "")
        body = extract_message_body(msg["payload"])
        
        parsed_date = email.utils.parsedate_to_datetime(date_str) if date_str else datetime.datetime.now()
        date_ymd = parsed_date.strftime("%Y-%m-%d")

        status_heuristic, reason, matched_kw = analyze_message_for_status(subject, snippet, body)

        # Override heuristic if the message explicitly has the rejected label
        if rejected_label_id and rejected_label_id in msg.get("labelIds", []):
            status_heuristic = "REJECTED"

        if status_heuristic:
            comp, role = extract_company_and_role(sender, subject)
            company_updates.append(
                {"sender": sender, "subject": subject, "status": status_heuristic, "extracted_company": comp, "extracted_role": role, "date": date_ymd, "reason": reason}
            )

    apps, lines = parse_tracker()
    
    max_id = 0
    for app in apps:
        parts = app["line"].split("|")
        if len(parts) > 2:
            try:
                id_val = int(parts[1].strip())
                if id_val > max_id:
                    max_id = id_val
            except ValueError:
                pass

    updated = False
    added_companies = set()

    for update in company_updates:
        matched = False
        for app in apps:
            company_name = app["company"].lower()
            company_name_clean = re.sub(r'(?i)\b(gmbh|inc\.?|llc|corp|group|ag|ltd\.?)\b', '', company_name).strip()
            company_name_clean = re.split(r'[,)(\-]', company_name_clean)[0].strip()
            
            extracted_company_clean = update["extracted_company"].lower()
            extracted_company_clean = re.sub(r'(?i)\b(gmbh|inc\.?|llc|corp|group|ag|ltd\.?)\b', '', extracted_company_clean).strip()
            
            if len(company_name_clean) > 2 and (
                company_name_clean in update["sender"].lower()
                or company_name_clean in update["subject"].lower()
                or company_name_clean in extracted_company_clean
                or (len(extracted_company_clean) > 2 and extracted_company_clean in company_name_clean)
            ):
                current_status = app["status"]
                new_status = update["status"]

                # Only update if the status is actually a progression.
                if current_status != new_status and current_status not in [
                    "REJECTED",
                    "OFFER",
                    "HIRED",
                ]:
                    print(
                        f"[{new_status} via '{update.get('reason')}'] {app['company']}: {current_status} -> {new_status} (via '{update['subject']}')"
                    )
                    parts = app["line"].split("|")
                    parts[6] = f" {new_status} "
                    lines[app["index"]] = "|".join(parts)
                    app["status"] = new_status  # update local representation
                    updated = True
                matched = True
                break

        if not matched:
            comp = update["extracted_company"]
            if comp not in added_companies and comp != "Unknown Company" and comp.strip():
                max_id += 1
                new_id = max_id
                date_str = update["date"]
                role = update["extracted_role"]
                new_status = update["status"]
                
                new_line = f"| {new_id} | {date_str} | {comp} | {role} | 0.0/5 | {new_status} | ❌ | N/A | Auto-synced from Gmail |\n"
                
                # Try to append right after the last tracked row, or at the end if none
                if apps:
                    last_app_idx = apps[-1]["index"]
                    lines.insert(last_app_idx + 1, new_line)
                    # update indices of following apps
                    for app in apps:
                        if app["index"] > last_app_idx:
                            app["index"] += 1
                else:
                    lines.append(new_line)
                    
                apps.append({
                    "line": new_line,
                    "company": comp,
                    "status": new_status,
                    "index": apps[-1]["index"] + 1 if apps else len(lines) - 1
                })
                added_companies.add(comp)
                updated = True
                print(f"Added missing application: {comp} - {role} ({new_status})")

    if updated:
        with open(APPLICATIONS_FILE, "w") as f:
            f.writelines(lines)
        print(f"Successfully updated {APPLICATIONS_FILE}.")
    else:
        print("No job status updates found in recent emails.")

    # Export to CSVs
    apps_csv = os.path.join(PROJECT_ROOT, "data", "applications.csv")
    rejections_csv = os.path.join(PROJECT_ROOT, "data", "rejections.csv")
    
    with open(apps_csv, "w", newline='') as f_apps, open(rejections_csv, "w", newline='') as f_rej:
        w_apps = csv.writer(f_apps)
        w_rej = csv.writer(f_rej)

        def _csv_safe(value):
            s = str(value) if value is not None else ""
            if s.startswith(("=", "+", "-", "@")):
                return "'" + s
            return s

        headers = ["Date", "Role", "Company", "Location", "Source", "Status", "Notes"]
        w_apps.writerow(headers)
        w_rej.writerow(headers)

        for line in lines:
            if line.strip().startswith("|") and "Company" not in line and "---" not in line:
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 8:
                    # Markdown: | num | date | company | role | score | status | pdf | report | notes |
                    # parts: [0]empty, [1]num, [2]date, [3]company, [4]role, [5]score, [6]status, [7]pdf, [8]report, [9]notes
                    date = parts[2]
                    comp = parts[3]
                    role = parts[4]
                    score = parts[5]
                    status = parts[6]
                    notes = parts[9] if len(parts) > 9 else ""

                    row_data = [_csv_safe(x) for x in [date, role, comp, "Germany", "Gmail", status, notes]]
                    w_apps.writerow(row_data)
                    if "REJECTED" in status.upper():
                        w_rej.writerow(row_data)
                        
    print(f"Exported data to {apps_csv} and {rejections_csv}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync Gmail application status into the tracker.")
    parser.add_argument("--days", type=int, default=None, help="Override lookback window in days (default: GMAIL_LOOKBACK_DAYS env or 30).")
    args = parser.parse_args()
    if args.days is not None:
        os.environ["GMAIL_LOOKBACK_DAYS"] = str(args.days)
    check_emails()
