"""Validation tests for gmail_agent.parser.

Covers the W2_PARSER contract: HTML→text cleaning, de/en language
detection (keyword-heuristic fallback, langdetect-optional), and metadata
signal extraction — company, role, application id, location — that feed
W3_CLASS / W3_MATCH.
"""

from gmail_agent.parser import (
    clean_text,
    detect_language,
    extract_application_id,
    extract_company,
    extract_location,
    extract_metadata,
    extract_role,
    extract_sender_company,
    extract_subject_company,
)


# ── Module surface ───────────────────────────────────────────────────


def test_public_api_surface():
    for fn in (
        clean_text,
        detect_language,
        extract_company,
        extract_role,
        extract_application_id,
        extract_location,
        extract_metadata,
    ):
        assert callable(fn)


# ── clean_text ───────────────────────────────────────────────────────


def test_clean_text_strips_html_and_collapses_whitespace():
    raw = "<html><body><p>Hello   World</p>\n\n<p>again</p></body></html>"
    assert clean_text(raw) == "Hello World again"


def test_clean_text_removes_script_blocks_and_urls():
    raw = (
        "<html><body><script>var x = 1;</script>"
        "Check https://example.com/track?id=1&amp;utm_source=x now"
        "</body></html>"
    )
    assert clean_text(raw) == "Check now"


def test_clean_text_unescapes_html_entities():
    assert clean_text("&lt;b&gt;Hi&lt;/b&gt; &amp; bye") == "<b>Hi</b> & bye"


def test_clean_text_handles_none_and_empty():
    assert clean_text(None) == ""
    assert clean_text("") == ""
    assert clean_text("   \n\t  ") == ""


# ── detect_language ──────────────────────────────────────────────────


def test_detect_language_german():
    text = (
        "Leider müssen wir Ihnen mitteilen, dass Ihre Bewerbung "
        "nicht erfolgreich war."
    )
    assert detect_language(text) == "de"


def test_detect_language_english():
    text = (
        "Unfortunately we have to inform you that your application "
        "was not successful."
    )
    assert detect_language(text) == "en"


def test_detect_language_empty_is_unknown():
    assert detect_language("") == "unknown"
    assert detect_language(None) == "unknown"
    assert detect_language("   ") == "unknown"


def test_detect_language_short_text_never_crashes():
    assert detect_language("x") in {"unknown", "de", "en"}
    assert detect_language("abc") in {"unknown", "de", "en"}


# ── extract_company ──────────────────────────────────────────────────


def test_extract_company_from_sender_display_name():
    assert extract_company("Acme Recruiting Team <jobs@acme.de>", "") == "Acme"


def test_extract_company_strips_legal_entity_suffixes():
    assert extract_company("Muster GmbH <hr@muster.de>", "") == "Muster"
    assert extract_company("Acme, Inc. <noreply@acme.com>", "") == "Acme"


def test_extract_company_from_ats_domain_fallback_returns_none():
    assert extract_company("no-reply@smartrecruiters.com", "") is None
    assert extract_company("noreply@greenhouse.io", "") is None


def test_extract_subject_company_ignores_sender_display_name():
    assert extract_subject_company("Muster GmbH <hr@muster.de>", "") is None
    assert extract_subject_company("", "Application for Data Scientist at Acme") == "Acme"


def test_extract_company_linkedin_subject_pattern():
    sender = "LinkedIn Job Alerts <jobs-listings@linkedin.com>"
    subject = "application to Senior Engineer at Acme - LinkedIn"
    assert extract_company(sender, subject) == "Acme"


def test_extract_company_from_german_subject():
    sender = "Personalabteilung <personal@muster-gmbh.de>"
    subject = "Bewerbung als Entwickler bei Muster"
    assert extract_company(sender, subject) == "Muster"


def test_extract_company_returns_none_when_unknown():
    assert extract_company("", "") is None
    assert extract_company(None, None) is None
    assert extract_company("someone@gmail.com", "Update") is None


# ── extract_role ─────────────────────────────────────────────────────


def test_extract_role_english_subjects():
    assert extract_role("Application for Senior Data Engineer at Acme") == "Senior Data Engineer"
    assert extract_role("Re: position of Platform Engineer at Y - LinkedIn") == "Platform Engineer"


def test_extract_role_german_subjects():
    assert extract_role("Bewerbung als Senior Software Engineer bei Acme") == "Senior Software Engineer"
    assert extract_role("Bewerbung für die Position als ML Engineer bei X") == "ML Engineer"


def test_extract_role_returns_none_when_absent():
    assert extract_role("Ihre Bewerbung wurde erhalten") is None
    assert extract_role("") is None
    assert extract_role(None) is None


# ── extract_application_id ───────────────────────────────────────────


def test_extract_application_id_req_patterns():
    assert extract_application_id("Update on req-123456", "") == "req-123456"
    assert extract_application_id("", "requisition 987654 for your application") == "req-987654"


def test_extract_application_id_labeled_patterns():
    assert extract_application_id("", "applicantId: abc123") == "abc123"
    assert extract_application_id("", "Reference: XYZ-2026-123") == "XYZ-2026-123"
    assert extract_application_id("", "Referenznummer: 987654") == "987654"
    assert extract_application_id("", "Requisition ID: 5555") == "5555"
    assert extract_application_id("Job ID: JOB-2026-42", "") == "JOB-2026-42"


def test_extract_application_id_none_when_absent():
    assert extract_application_id("", "") is None
    assert extract_application_id("Application update", "Thank you for applying") is None
    assert extract_application_id(None, None) is None


# ── extract_location ─────────────────────────────────────────────────


def test_extract_location_labeled_and_remote():
    assert extract_location("", "Location: Berlin, Germany") == "Berlin, Germany"
    assert extract_location("", "Standort: München") == "München"
    assert extract_location("", "Based in Amsterdam, Netherlands") == "Amsterdam, Netherlands"
    assert extract_location("", "This role is fully remote") == "Remote"
    assert extract_location("", "") is None


# ── extract_metadata ─────────────────────────────────────────────────


def test_extract_metadata_end_to_end_english():
    meta = extract_metadata(
        "Acme Recruiting Team <jobs@acme.de>",
        "Re: Application for Senior Data Engineer at Acme",
        "Location: Berlin, Germany\nRequisition ID: 5555",
    )
    assert meta == {
        "company": "Acme",
        "role": "Senior Data Engineer",
        "application_id": "5555",
        "location": "Berlin, Germany",
    }


def test_extract_metadata_end_to_end_german():
    meta = extract_metadata(
        "Muster GmbH Personalabteilung <personal@muster-gmbh.de>",
        "Bewerbung als Senior Backend Engineer bei Muster",
        "Standort: München\nReferenznummer: 112233",
    )
    assert meta == {
        "company": "Muster",
        "role": "Senior Backend Engineer",
        "application_id": "112233",
        "location": "München",
    }


def test_extract_metadata_missing_signals_are_none():
    assert extract_metadata(None, None, None) == {
        "company": None,
        "role": None,
        "application_id": None,
        "location": None,
    }


def test_extract_metadata_never_raises_on_weird_input():
    meta = extract_metadata(42, object(), ["<b>junk</b>"])
    assert set(meta) == {"company", "role", "application_id", "location"}
