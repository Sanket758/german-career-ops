#!/usr/bin/env python3
import os
import sys
import datetime
import warnings
import csv
import re
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


def analyze_message_for_status(snippet):
    snippet_lower = snippet.lower()
    # German and English rejection keywords
    if (
        "not moving forward" in snippet_lower
        or "decided to proceed with other" in snippet_lower
        or "regret" in snippet_lower
        or "unfortunately" in snippet_lower
        or "leider" in snippet_lower
        or "absage" in snippet_lower
        or "bedauern" in snippet_lower
        or "nicht berücksichtigen" in snippet_lower
        or "anderen bewerbern" in snippet_lower
        or "anderen bewerberinnen" in snippet_lower
        or "anderweitig entschieden" in snippet_lower
    ):
        return "REJECTED"
    # German and English interview keywords
    elif (
        "interview" in snippet_lower
        or "invitation" in snippet_lower
        or "availability" in snippet_lower
        or "einladung" in snippet_lower
        or "kennenlernen" in snippet_lower
        or "vorstellungsgespräch" in snippet_lower
    ):
        return "INTERVIEW"
    # German and English offer keywords
    elif (
        ("offer" in snippet_lower and "congratulations" in snippet_lower)
        or "vertragsangebot" in snippet_lower
        or "arbeitsvertrag" in snippet_lower
    ):
        return "OFFER"
    return None

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

    # Basic query for potential updates in the last 14 days, plus any emails explicitly labeled as rejected
    date_n_days_ago = (datetime.date.today() - datetime.timedelta(days=14)).strftime(
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
        
        parsed_date = email.utils.parsedate_to_datetime(date_str) if date_str else datetime.datetime.now()
        date_ymd = parsed_date.strftime("%Y-%m-%d")

        status_heuristic = analyze_message_for_status(subject + " " + snippet)

        # Override heuristic if the message explicitly has the rejected label
        if rejected_label_id and rejected_label_id in msg.get("labelIds", []):
            status_heuristic = "REJECTED"

        if status_heuristic:
            comp, role = extract_company_and_role(sender, subject)
            company_updates.append(
                {"sender": sender, "subject": subject, "status": status_heuristic, "extracted_company": comp, "extracted_role": role, "date": date_ymd}
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
                        f"Update for {app['company']}: {current_status} -> {new_status} (via '{update['subject']}')"
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
                    
                    row_data = [date, role, comp, "Germany", "Gmail", status, notes]
                    w_apps.writerow(row_data)
                    if "REJECTED" in status.upper():
                        w_rej.writerow(row_data)
                        
    print(f"Exported data to {apps_csv} and {rejections_csv}.")


if __name__ == "__main__":
    check_emails()
