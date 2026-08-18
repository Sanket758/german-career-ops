"""Gmail message fetch and normalization (W2_MESSAGES).

Scope (bar.md § Module Structure — ``messages.py``):
    fetch_message     → full Gmail message dict from the Messages API
    extract_headers   → subject / sender (From) / date from the header list
    extract_body      → richest plain-text body via a bounded MIME walker
    normalize_message → assemble a ``NormalizedEmail`` (the W1 contract)

Deliberately NOT here (later waves own these):
    - history/checkpoint logic (W2_HISTORY) — this module is stateless
    - classification / confidence scoring (W3_CLASS)
    - LLM-based language detection (W2_PARSER) — ``detect_language`` is a
      small stopgap heuristic until the parser lands.

The MIME walker is a reuse-and-improve of ``extract_message_body`` from
``scripts/gmail_sync.py``: it prefers text/plain, falls back to text/html
with tag stripping, caps at ``max_chars``, and bounds recursion depth to
defend against crafted MIME. Improvements: base64 padding is tolerated
(Gmail omits it), and text/plain is preferred even when a text/html part
is listed first in a multipart/alternative.
"""

from __future__ import annotations

import base64
import html
import logging
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

from gmail_agent.models import NormalizedEmail

logger = logging.getLogger(__name__)

DEFAULT_MAX_BODY_CHARS = 4000
MAX_MIME_DEPTH = 20

# Stopgap language tokens until W2_PARSER lands (see module docstring).
_DE_TOKENS = (
    "bewerbung", "sehr geehrte", "vielen dank", "mit freundlichen",
    "freundliche grüße", "freundliche gruesse", "anschreiben", "lebenslauf",
    "stellenangebot", "gespräch", "gespraech", "einladung", "absage",
    "zusage", "berufserfahrung",
)
_EN_TOKENS = (
    "your application", "thank you", "best regards", "kind regards",
    "looking forward", "application", "interview", "candidate",
    "opportunity", "hiring", "recruiting", "we are pleased",
)

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WS_COLLAPSE_RE = re.compile(r"\s+")


def fetch_message(service: Any, message_id: str) -> dict[str, Any]:
    """Fetch a full Gmail message for ``message_id``.

    Issues ``users().messages().get(userId='me', id=message_id,
    format='full')`` and returns the raw API response dict. Any API error
    is wrapped in a ``RuntimeError`` carrying the message id so the sync
    loop can attribute failures without swallowing them.
    """
    try:
        return (
            service.users()
            .messages()
            .get(userId="me", id=message_id, format="full")
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 — surface any transport/API error
        raise RuntimeError(f"failed to fetch Gmail message {message_id!r}: {exc}") from exc


def list_message_ids(
    service: Any,
    query: str = "",
    *,
    max_results: int = 500,
    max_pages: int | None = None,
) -> list[str]:
    """List message ids matching a Gmail search ``query``, across all pages.

    Issues ``users().messages().list(userId='me', q=query)`` and follows
    ``nextPageToken`` via ``list_next`` until exhausted. Returns ids only —
    the caller fetches full messages via ``fetch_message``. Backs the
    engine's bootstrap (``newer_than:Nd``) and ``gmail replay --since``.

    ``max_pages`` caps API pages (defensive; a pathological API cannot hang
    the service). Any transport/API error is wrapped in a ``RuntimeError``
    so the sync loop attributes the failure to the window, not a page.
    """
    try:
        request = service.users().messages().list(
            userId="me", q=query, maxResults=max_results
        )
        page = 0
        ids: list[str] = []
        while request is not None:
            page += 1
            if max_pages is not None and page > max_pages:
                logger.warning("list_message_ids: page cap %d reached (truncated)", max_pages)
                break
            response = request.execute()
            ids.extend(
                str(item["id"]) for item in response.get("messages") or [] if item.get("id")
            )
            request = (
                service.users().messages().list_next(request, response)
                if response.get("nextPageToken")
                else None
            )
        return ids
    except Exception as exc:  # noqa: BLE001 — surface any transport/API error
        raise RuntimeError(f"failed to list Gmail messages (q={query!r}): {exc}") from exc



def extract_headers(payload_headers: list[dict[str, Any]] | None) -> dict[str, str]:
    """Pull subject, sender (From), and date out of a Gmail header list.

    Header names are case-insensitive; the first occurrence wins (headers
    are repeated rarely, and first is what mail clients show). Unknown or
    missing headers come back as empty strings.

    ``snippet`` is deliberately NOT here — it is a top-level message field
    in the Gmail API, not an RFC header; ``normalize_message`` attaches it
    from the message envelope.
    """
    found: dict[str, str] = {}
    for header in payload_headers or []:
        name = str(header.get("name", "")).lower()
        if name in ("subject", "from", "date") and name not in found:
            found[name] = str(header.get("value", ""))
    return {
        "subject": found.get("subject", ""),
        "sender": found.get("from", ""),
        "date": found.get("date", ""),
    }


def _decode_body_data(data: Any) -> str:
    """Decode a Gmail body ``data`` field (urlsafe base64, padding optional)."""
    if not data:
        return ""
    encoded = str(data)
    # Gmail omits '=' padding; urlsafe_b64decode needs a multiple of 4.
    padded = encoded + "=" * (-len(encoded) % 4)
    try:
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
    except (ValueError, TypeError):
        raw = encoded.encode("utf-8", "replace")
    return raw.decode("utf-8", "replace")


def _strip_html(raw_html: str) -> str:
    """Strip tags, unescape entities, and collapse whitespace."""
    text = _HTML_TAG_RE.sub(" ", raw_html)
    text = html.unescape(text)
    return _WS_COLLAPSE_RE.sub(" ", text).strip()


def extract_body(payload: dict[str, Any] | None, max_chars: int = DEFAULT_MAX_BODY_CHARS, _depth: int = 0) -> str:
    """Recursively walk a Gmail payload and return the richest plain-text body.

    Prefers a text/plain part anywhere in the tree; falls back to a
    text/html part (tags stripped, entities unescaped, whitespace
    collapsed). Returns the first non-empty match — plain text wins even
    when HTML is listed first — capped at ``max_chars``. Recursion is
    bounded at ``MAX_MIME_DEPTH`` so crafted deeply-nested MIME cannot
    blow the stack; non-message parts (attachments) are skipped by MIME
    type and never produce body text.
    """
    if _depth > MAX_MIME_DEPTH or not isinstance(payload, dict):
        return ""

    mime = str(payload.get("mimeType", ""))
    body_part = payload.get("body")
    data = body_part.get("data") if isinstance(body_part, dict) else None
    if data:
        text = _decode_body_data(data)
        if mime == "text/html":
            text = _strip_html(text)
        else:
            text = text.strip()
        if text:
            return text[:max_chars]

    plain = ""
    html_fallback = ""
    for part in payload.get("parts") or []:
        candidate = extract_body(part, max_chars=max_chars, _depth=_depth + 1)
        if not candidate:
            continue
        if str(part.get("mimeType", "")) == "text/plain":
            plain = candidate
            break  # a plain part anywhere beats every HTML fallback
        if not html_fallback:
            html_fallback = candidate
    return (plain or html_fallback)[:max_chars]


def parse_date(date_str: str) -> datetime:
    """Parse an RFC-2822 ``Date`` header into a UTC-aware datetime.

    Falls back to ``datetime.now(timezone.utc)`` when the value is empty
    or unparseable (defensive: never crash the pipeline on a bad header).
    Naive dates (no timezone in the header) are treated as UTC.
    """
    if not date_str:
        return datetime.now(timezone.utc)
    try:
        parsed = parsedate_to_datetime(date_str)
    except (TypeError, ValueError):
        parsed = None
    if parsed is None:
        return datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def detect_language(subject: str = "", body: str = "") -> str:
    """Stopgap 'de'/'en'/'unknown' guess until W2_PARSER provides detection.

    Counts distinctive German vs English tokens in subject + body; the
    side with more hits wins, ties are 'unknown'. Deliberately uses
    unambiguous tokens only (job-application vocabulary), so generic mail
    stays 'unknown' rather than being mislabeled.
    """
    text = f"{subject}\n{body}".lower()
    de_hits = sum(1 for token in _DE_TOKENS if token in text)
    en_hits = sum(1 for token in _EN_TOKENS if token in text)
    if de_hits > en_hits:
        return "de"
    if en_hits > de_hits:
        return "en"
    return "unknown"


def normalize_message(raw_message: dict[str, Any]) -> NormalizedEmail:
    """Normalize a raw Gmail message dict into a ``NormalizedEmail``.

    Extracts headers + body, parses the Date header, and attaches the
    top-level ``snippet``. Raises ``ValueError`` when the envelope is not
    a dict or lacks the required ``id``/``threadId`` identifiers — the
    model enforces those as mandatory, so a malformed API response must
    fail loudly rather than produce an unpersistable row.
    """
    if not isinstance(raw_message, dict):
        raise ValueError(f"expected a Gmail message dict, got {type(raw_message).__name__}")
    message_id = raw_message.get("id", "")
    thread_id = raw_message.get("threadId", "")
    if not message_id or not thread_id:
        raise ValueError(f"message {message_id!r} is missing id/threadId")

    payload = raw_message.get("payload") or {}
    headers = extract_headers(payload.get("headers"))
    subject = headers["subject"]
    sender = headers["sender"]
    body = extract_body(payload)
    language = detect_language(subject, body)

    return NormalizedEmail(
        gmail_message_id=message_id,
        thread_id=thread_id,
        received_at=parse_date(headers["date"]),
        sender=sender,
        subject=subject,
        snippet=raw_message.get("snippet", ""),
        body=body,
        language=language,
    )
