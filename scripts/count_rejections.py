from gmail_sync import get_gmail_service, analyze_message_for_status, extract_company_and_role
import datetime

service = get_gmail_service()
date_n_days_ago = (datetime.date.today() - datetime.timedelta(days=14)).strftime("%Y/%m/%d")
query = f"((subject:application OR subject:interview OR subject:update OR subject:rejected OR subject:offer OR subject:status) after:{date_n_days_ago}) OR label:jobs-jobs-rejected"

messages = []
page_token = None
while True:
    results = service.users().messages().list(userId="me", q=query, pageToken=page_token).execute()
    messages.extend(results.get("messages", []))
    page_token = results.get("nextPageToken")
    if not page_token:
        break

labels_results = service.users().labels().list(userId="me").execute()
rejected_label_id = next((l["id"] for l in labels_results.get("labels", []) if "jobs-rejected" in l["name"].lower() or "jobs-jobs-rejected" in l["name"].lower()), None)

rejections = []
for message in messages:
    msg = service.users().messages().get(userId="me", id=message["id"], format="full").execute()
    headers = msg["payload"]["headers"]
    subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "")
    sender = next((h["value"] for h in headers if h["name"].lower() == "from"), "")
    snippet = msg.get("snippet", "")
    
    status = analyze_message_for_status(subject + " " + snippet)
    if rejected_label_id and rejected_label_id in msg.get("labelIds", []):
        status = "REJECTED"
        
    if status == "REJECTED":
        comp, role = extract_company_and_role(sender, subject)
        rejections.append(comp)

print(f"Total rejected emails: {len(rejections)}")
print(f"Unique rejected companies: {len(set(rejections))}")
