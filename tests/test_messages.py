"""Tests for gmail_agent.messages (W2_MESSAGES).

Covers the full-fetch wrapper, header extraction, the MIME body walker
(plain / html / nested / defense-in-depth), RFC-2822 date parsing, the
stopgap language heuristic, and normalization into ``NormalizedEmail``.
Gmail API interactions are mocked with realistic response dicts (payload
with parts, headers list of {"name": ..., "value": ...}).
"""

import base64
from datetime import datetime, timezone

import pytest

from gmail_agent.messages import (
    MAX_MIME_DEPTH,
    detect_language,
    extract_body,
    extract_headers,
    fetch_message,
    normalize_message,
    parse_date,
)
from gmail_agent.models import NormalizedEmail


# ── Fixtures / helpers ───────────────────────────────────────────────


def _b64(text: str) -> str:
    """urlsafe base64 WITHOUT padding — exactly as the Gmail API returns it."""
    return base64.urlsafe_b64encode(text.encode("utf-8")).decode("ascii").rstrip("=")


def _plain_part(text: str) -> dict:
    return {"mimeType": "text/plain", "body": {"data": _b64(text)}}


def _html_part(html_text: str) -> dict:
    return {"mimeType": "text/html", "body": {"data": _b64(html_text)}}


def _headers(**overrides) -> list[dict[str, str]]:
    # Overrides are keyed by lowercased header name, e.g. _headers(subject="...").
    headers = [
        {"name": "Subject", "value": "Ihre Bewerbung bei Acme GmbH"},
        {"name": "From", "value": "Recruiting <recruiting@acme.de>"},
        {"name": "Date", "value": "Mon, 03 Aug 2026 09:30:00 +0200"},
    ]
    for h in headers:
        key = h["name"].lower()
        if key in overrides:
            h["value"] = overrides[key]
    return headers


def _raw_message(**overrides) -> dict:
    raw = {
        "id": "1902abcd",
        "threadId": "1902efgh",
        "snippet": "Vielen Dank fuer Ihre Bewerbung",
        "labelIds": ["INBOX"],
        "payload": {
            "mimeType": "multipart/alternative",
            "headers": _headers(),
            "parts": [
                _plain_part("Sehr geehrte Damen und Herren,\n\nvielen Dank fuer Ihre Bewerbung."),
                _html_part("<html><body><p>Sehr geehrte <b>Damen</b> und Herren,</p><p>vielen Dank fuer Ihre Bewerbung.</p></body></html>"),
            ],
        },
    }
    raw.update(overrides)
    return raw


class _FakeMessages:
    """Mock of service.users().messages() — records get kwargs, returns/raises."""

    def __init__(self, result=None, error=None):
        self._result = result
        self._error = error
        self.kwargs = None

    def get(self, **kwargs):
        self.kwargs = kwargs
        return self

    def execute(self):
        if self._error is not None:
            raise self._error
        return self._result


class _FakeService:
    def __init__(self, messages: _FakeMessages):
        self._messages = messages

    def users(self):
        return self  # users().messages() on the same fake chain

    def messages(self):
        return self._messages


# ── fetch_message ────────────────────────────────────────────────────


def test_fetch_message_requests_full_format_and_returns_payload():
    raw = _raw_message()
    messages = _FakeMessages(result=raw)
    result = fetch_message(_FakeService(messages), "1902abcd")
    assert result is raw
    assert messages.kwargs == {"userId": "me", "id": "1902abcd", "format": "full"}


def test_fetch_message_wraps_api_errors_with_message_id():
    messages = _FakeMessages(error=RuntimeError("transport down"))
    with pytest.raises(RuntimeError, match="1902abcd"):
        fetch_message(_FakeService(messages), "1902abcd")


# ── extract_headers ──────────────────────────────────────────────────


def test_extract_headers_maps_gmail_header_list():
    headers = extract_headers(
        [
            {"name": "Subject", "value": "Ihre Bewerbung"},
            {"name": "From", "value": "Recruiting <recruiting@acme.de>"},
            {"name": "Date", "value": "Mon, 03 Aug 2026 09:30:00 +0200"},
            {"name": "Message-ID", "value": "<abc@mail.gmail.com>"},
            {"name": "To", "value": "me@example.com"},
        ]
    )
    assert headers == {
        "subject": "Ihre Bewerbung",
        "sender": "Recruiting <recruiting@acme.de>",
        "date": "Mon, 03 Aug 2026 09:30:00 +0200",
    }


def test_extract_headers_is_case_insensitive_and_first_wins():
    headers = extract_headers(
        [
            {"name": "SUBJECT", "value": "first"},
            {"name": "subject", "value": "second"},
            {"name": "from", "value": "f@x.de"},
        ]
    )
    assert headers["subject"] == "first"
    assert headers["sender"] == "f@x.de"
    assert headers["date"] == ""


def test_extract_headers_tolerates_empty_and_missing_values():
    assert extract_headers([]) == {"subject": "", "sender": "", "date": ""}
    assert extract_headers(None) == {"subject": "", "sender": "", "date": ""}


# ── extract_body ─────────────────────────────────────────────────────


def test_extract_body_prefers_text_plain_over_html():
    payload = {
        "mimeType": "multipart/alternative",
        "parts": [_plain_part("Hallo Welt\nzweite Zeile"), _html_part("<p>Hallo <b>Welt</b></p>")],
    }
    assert extract_body(payload) == "Hallo Welt\nzweite Zeile"


def test_extract_body_prefers_plain_even_when_html_listed_first():
    payload = {
        "mimeType": "multipart/alternative",
        "parts": [_html_part("<p>HTML only</p>"), _plain_part("Plain text wins")],
    }
    assert extract_body(payload) == "Plain text wins"


def test_extract_body_strips_html_when_only_html_present():
    payload = _html_part("<html><body><p>Hello <b>world</b></p>&nbsp;<!-- comment --></body></html>")
    assert extract_body(payload) == "Hello world"


def test_extract_body_walks_nested_multipart_and_skips_attachments():
    payload = {
        "mimeType": "multipart/mixed",
        "parts": [
            {
                "mimeType": "multipart/alternative",
                "parts": [_plain_part("Deep plain body"), _html_part("<p>Deep html</p>")],
            },
            {"mimeType": "application/pdf", "body": {"data": _b64("JVBERi0xLjQ="), "size": 10}},
        ],
    }
    assert extract_body(payload) == "Deep plain body"


def test_extract_body_accepts_padded_base64():
    # Explicit '=' padding — decoder must tolerate both padded and unpadded.
    payload = {"mimeType": "text/plain", "body": {"data": "SGVsbG8gd29ybGQ="}}
    assert extract_body(payload) == "Hello world"


def test_extract_body_respects_max_chars():
    payload = _plain_part("x" * 5000)
    assert len(extract_body(payload, max_chars=100)) == 100


def test_extract_body_bounds_recursion_depth():
    payload = _plain_part("too deep")
    for _ in range(MAX_MIME_DEPTH + 5):
        payload = {"mimeType": "multipart/mixed", "parts": [payload]}
    assert extract_body(payload) == ""


def test_extract_body_handles_empty_and_malformed_payloads():
    assert extract_body(None) == ""
    assert extract_body({}) == ""
    assert extract_body({"mimeType": "text/plain"}) == ""
    assert extract_body({"mimeType": "text/plain", "body": {}}) == ""


# ── parse_date ───────────────────────────────────────────────────────


def test_parse_date_handles_rfc2822_with_offset():
    assert parse_date("Mon, 03 Aug 2026 09:30:00 +0200") == datetime(2026, 8, 3, 7, 30, tzinfo=timezone.utc)


def test_parse_date_attaches_utc_to_naive_dates():
    assert parse_date("3 Aug 2026 09:30:00") == datetime(2026, 8, 3, 9, 30, tzinfo=timezone.utc)


def test_parse_date_falls_back_to_now_on_garbage():
    before = datetime.now(timezone.utc)
    parsed = parse_date("not a real date")
    after = datetime.now(timezone.utc)
    assert before <= parsed <= after


def test_parse_date_falls_back_to_now_on_empty():
    assert parse_date("").tzinfo is not None


# ── detect_language ──────────────────────────────────────────────────


def test_detect_language_heuristic():
    assert detect_language("Ihre Bewerbung", "Sehr geehrte Damen und Herren, vielen Dank fuer Ihre Anfrage") == "de"
    assert detect_language("Your application", "Thank you for applying to Acme. Best regards, The Team") == "en"
    assert detect_language("Meeting agenda", "Notes from the standup") == "unknown"


# ── normalize_message ────────────────────────────────────────────────


def test_normalize_message_builds_full_normalized_email():
    email = normalize_message(_raw_message())
    assert isinstance(email, NormalizedEmail)
    assert email.gmail_message_id == "1902abcd"
    assert email.thread_id == "1902efgh"
    assert email.received_at == datetime(2026, 8, 3, 7, 30, tzinfo=timezone.utc)
    assert email.sender == "Recruiting <recruiting@acme.de>"
    assert email.subject == "Ihre Bewerbung bei Acme GmbH"
    assert email.snippet == "Vielen Dank fuer Ihre Bewerbung"
    assert "vielen Dank fuer Ihre Bewerbung" in email.body
    assert email.language == "de"
    assert len(email.body_hash) == 64  # sha256 hex digest auto-computed


def test_normalize_message_detects_english():
    raw = _raw_message()
    raw["payload"]["headers"] = [
        {"name": "Subject", "value": "Your application at Acme"},
        {"name": "From", "value": "recruiting@acme.com"},
        {"name": "Date", "value": "Mon, 03 Aug 2026 09:30:00 +0200"},
    ]
    raw["payload"]["parts"] = [_plain_part("Thank you for applying to Acme. Best regards, The Team")]
    email = normalize_message(raw)
    assert email.language == "en"
    assert email.sender == "recruiting@acme.com"


def test_normalize_message_uses_top_level_snippet():
    raw = _raw_message(snippet="custom envelope snippet")
    assert normalize_message(raw).snippet == "custom envelope snippet"


def test_normalize_message_raises_when_identifiers_missing():
    raw = _raw_message()
    del raw["id"]
    with pytest.raises(ValueError):
        normalize_message(raw)
    raw = _raw_message()
    del raw["threadId"]
    with pytest.raises(ValueError):
        normalize_message(raw)


def test_normalize_message_raises_on_non_dict_envelope():
    with pytest.raises(ValueError):
        normalize_message(None)
    with pytest.raises(ValueError):
        normalize_message("not a message")
