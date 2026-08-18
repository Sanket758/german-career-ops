"""Email text cleaning, language detection, and metadata extraction.

W2_PARSER: the first stage of the Gmail sync engine (see ``.gauntlet/bar/bar.md``
§ Module Structure). Given the raw message parts that W2_MESSAGES fetches, this
module produces the clean text, the natural language (``de``/``en``), and the
metadata signals — company, role, application id, location — that W3_CLASS and
W3_MATCH key on.

Design rules:
- Pure functions: no I/O, no Gmail API access, no settings dependency.
- Defensive: never raises on missing/malformed input; returns ``None`` when a
  signal cannot be determined.
- Reuses and improves the extraction logic from ``scripts/gmail_sync.py``
  (sender-suffix stripping, domain fallback, LinkedIn subject patterns, German
  subject patterns, legal-entity cleanup) without importing it.
"""

from __future__ import annotations

import html
import importlib
import re
from collections.abc import Callable
from typing import cast

# ── Language detection (langdetect optional) ─────────────────────────
# langdetect may not be installed — dynamic import, keyword-heuristic
# fallback for de/en. Heuristic runs first so results are deterministic
# regardless of environment.

def _load_langdetect_detect() -> Callable[[str], str] | None:
    try:
        module = importlib.import_module("langdetect")
    except ImportError:  # pragma: no cover - environment-dependent
        return None
    detect = getattr(module, "detect", None)
    if not callable(detect):
        return None
    return cast(Callable[[str], str], detect)


_langdetect_detect: Callable[[str], str] | None = _load_langdetect_detect()


_DE_SIGNALS = (
    "leider", "bewerbung", "bewerbungen", "bewerber", "sie haben",
    "wir bedauern", "vielen dank", "vielen", "danke", "sehr geehrte",
    "mit freundlichen", "freundliche grüße", "freundlichen grüßen",
    "grüße", "grüssen", "standort", "stellenangebot", "einladung",
    "vorstellungsgespräch", "vorstellungsgespraech", "zusage", "absage",
    "vollzeit", "teilzeit", "bitte", "gehalt", "unterlagen",
    "referenznummer", "ihre", "ihrer", "ihnen", "ihr", "sie", "wir",
    "uns", "dass", "bei", "für", "fuer", "und", "der", "die", "das",
    "nicht", "mit", "über", "ueber",
)

_EN_SIGNALS = (
    "unfortunately", "we regret", "thank you", "thanks", "dear",
    "regards", "sincerely", "application", "applicant", "position",
    "interview", "offer", "candidate", "recruiter", "hiring",
    "opportunity", "resume", "update", "the", "and", "with", "for",
    "you", "your", "we", "this", "that", "have", "has", "not", "our",
    "from", "will", "would", "please", "team", "job",
)

_DE_SIGNAL_RE = re.compile(
    r"\b(?:%s)\b" % "|".join(re.escape(s) for s in _DE_SIGNALS),
    re.IGNORECASE,
)
_EN_SIGNAL_RE = re.compile(
    r"\b(?:%s)\b" % "|".join(re.escape(s) for s in _EN_SIGNALS),
    re.IGNORECASE,
)


def detect_language(text: str | None) -> str:
    """Detect the language of email text: ``'de'``, ``'en'``, or ``'unknown'``.

    Keyword-heuristic first (deterministic, job-email-specific), then
    langdetect when installed. Never raises, never crashes on short or
    empty input.
    """
    if text is None:
        return "unknown"
    t = str(text).strip()
    if len(t) < 5:
        return "unknown"
    de = len(_DE_SIGNAL_RE.findall(t))
    en = len(_EN_SIGNAL_RE.findall(t))
    if de != en:
        return "de" if de > en else "en"
    # Tie/zero signals — ask langdetect if available.
    if _langdetect_detect is not None:
        try:
            lang = _langdetect_detect(t)
            if lang in ("de", "en"):
                return lang
        except Exception:
            pass
    return "unknown"


# ── Text cleaning ────────────────────────────────────────────────────

_URL_RE = re.compile(r"\b(?:https?://|www\.)\S+", re.IGNORECASE)
_STYLE_SCRIPT_RE = re.compile(r"<(style|script)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_TAG_RE = re.compile(r"<[^>]+>")
_IMAGE_CID_RE = re.compile(r"\[(?:image|cid)[^\]]*\]", re.IGNORECASE)
_WS_RE = re.compile(r"\s+")


def clean_text(raw_text: str | None) -> str:
    """Strip HTML artifacts and normalize whitespace in raw email text.

    Removes ``<style>``/``<script>`` blocks, HTML comments and tags, inline
    image/cid markers, decodes HTML entities, removes URLs (tracking links),
    then collapses all whitespace runs to single spaces. Returns ``""`` for
    ``None``/empty input.
    """
    if raw_text is None:
        return ""
    text = str(raw_text)
    text = _STYLE_SCRIPT_RE.sub(" ", text)
    text = _HTML_COMMENT_RE.sub(" ", text)
    text = _TAG_RE.sub(" ", text)
    text = html.unescape(text)
    text = _URL_RE.sub(" ", text)
    text = _IMAGE_CID_RE.sub(" ", text)
    return _WS_RE.sub(" ", text).strip()


# ── Metadata extraction ──────────────────────────────────────────────
# Improvements over scripts/gmail_sync.py::extract_company_and_role:
# quoted display names, German sender suffixes, bare-email detection,
# "application for the position of X" forms, req-id extraction, location.

_ENTITY_RE = re.compile(r"(?i)\b(?:gmbh|inc\.?|llc|corp(?:oration)?|group|ag|ltd\.?|kg|plc|sarl|bv|nv)\b")
_CO_PREFIX_RE = re.compile(r"(?i)\s*(?:&|und|and)\s*co\.?\s*$")
_TRAILING_JUNK_RE = re.compile(r"[\s,&.\-]+$")
_LEADING_JUNK_RE = re.compile(r"^[\s,&.\-]+")


def _clean_company(name: str | None) -> str | None:
    """Strip legal-form suffixes (GmbH/Inc/LLC/…) and stray punctuation."""
    if name is None:
        return None
    s = str(name).strip()
    s = _ENTITY_RE.sub(" ", s)
    s = _CO_PREFIX_RE.sub("", s)
    s = _TRAILING_JUNK_RE.sub("", s)
    s = _LEADING_JUNK_RE.sub("", s).strip()
    return s or None


_SENDER_SUFFIXES = (
    "recruiting team", "talent acquisition", "people team", "group hiring",
    "personalabteilung", "personalteam", "personal", "recruiting", "talent",
    "careers", "career", "bewerbungen", "hr", "jobs", "job", "team",
)
_SENDER_SUFFIX_RE = re.compile(
    r"(?i)\s*(?:%s)\s*[,.;:!?]*$" % "|".join(_SENDER_SUFFIXES)
)


def _strip_sender_suffixes(name: str) -> str:
    """Remove recruiting-team suffixes from a sender display name."""
    s = name
    for _ in range(4):
        stripped = _SENDER_SUFFIX_RE.sub("", s)
        if stripped == s:
            break
        s = stripped
    return s.strip().rstrip(" ,.;:!?-")


_NO_REPLY_RE = re.compile(r"(?i)(?:no[\s._-]?reply|donotreply|do[\s._-]?not[\s._-]?reply|noreply)")
_GENERIC_SENDER_WORDS = frozenset({
    "jobs", "job", "careers", "career", "hr", "info", "contact", "recruiting",
    "recruiter", "apply", "team", "admin", "mail", "email", "hello", "support",
    "notification", "notifications", "updates", "talent", "talentacquisition",
    "talent-acquisition", "gmail", "google", "linkedin", "noreply", "no-reply",
    "donotreply", "hiring", "ats", "automail", "autonotify", "personal",
    "personalabteilung", "personalteam", "karriere", "bewerbungen",
    "smartrecruiters", "greenhouse", "lever", "workday", "icims", "jobvite",
    "taleo", "ashby", "teamtailor", "workable", "recruitee", "bamboohr",
    "bullhorn",
})


def _is_generic_sender(name: str | None) -> bool:
    """True when a display name is an ATS/portal address, not a company."""
    if not name:
        return True
    n = name.strip().lower()
    if _NO_REPLY_RE.search(n):
        return True
    if "@" in n:
        return True
    return n in _GENERIC_SENDER_WORDS


def _sender_display_name(sender: str | None) -> str | None:
    """Extract the display name from a ``From`` header; None if none exists."""
    s = str(sender).strip()
    if not s:
        return None
    quoted = re.search(r'"([^"]*)"', s)
    if quoted and quoted.group(1).strip():
        return quoted.group(1).strip()
    match = re.match(r"([^<@,]+)", s)
    if match:
        name = match.group(1).strip()
        # A bare email address (no angle brackets) has no display name.
        if "@" in s and "<" not in s:
            return None
        return name or None
    return None


_GENERIC_SUBDOMAINS = frozenset({
    "www", "mail", "email", "info", "contact", "careers", "jobs", "hr",
    "recruiting", "team", "apply", "boards", "noreply", "career",
})
_SKIP_DOMAIN_HINTS = (
    "gmail", "yahoo", "hotmail", "outlook", "web.de", "gmx", "t-online",
    "icloud", "aol", "live", "posteo", "protonmail", "proton.me",
    "googlemail", "join.com", "successfactors", "linkedin", "me.com", "mac.com",
    "smartrecruiters", "greenhouse", "lever", "workday", "icims", "jobvite",
    "taleo", "ashby", "teamtailor", "workable", "recruitee", "bamboohr",
    "bullhorn",
)


def _domain_fallback(sender: str | None) -> str | None:
    """Derive a company from the sender's email domain (ATS-style fallback)."""
    match = re.search(r"@([A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)", str(sender or ""))
    if not match:
        return None
    domain = match.group(1).lower().lstrip(".")
    if domain in {"gmail.com", "yahoo.com", "web.de", "gmx.de", "gmx.net",
                  "outlook.com", "hotmail.com", "t-online.de", "icloud.com",
                  "aol.com", "protonmail.com", "proton.me", "posteo.de",
                  "posteo.net", "googlemail.com", "me.com", "mac.com"}:
        return None
    if any(hint in domain for hint in _SKIP_DOMAIN_HINTS):
        return None
    parts = [p for p in domain.split(".") if p]
    while parts and parts[0] in _GENERIC_SUBDOMAINS:
        _ = parts.pop(0)
    if not parts:
        return None
    return _clean_company(parts[0].capitalize())


_LINKEDIN_COMPANY_RE = re.compile(r"application to (.*?) at (.*?)(?: - |$)", re.IGNORECASE)
_SUBJECT_COMPANY_PATTERNS = [
    re.compile(r"application (?:for|as) .*? at (.+?)(?: - |$)", re.IGNORECASE),
    re.compile(r"application (?:at|to) (.+?)(?: - |$)", re.IGNORECASE),
    re.compile(r"bewerbung (?:als|für|fuer) .*? bei (.+?)(?: - |$)", re.IGNORECASE),
    re.compile(r"bewerbung bei (.+?)(?: - |$)", re.IGNORECASE),
    re.compile(r"position (?:of|as) .*? at (.+?)(?: - |$)", re.IGNORECASE),
]


def extract_company(sender: str | None, subject: str | None) -> str | None:
    """Extract the company name from sender/subject signals.

    Evidence order: sender display name (suffixes stripped) → LinkedIn/subject
    patterns → email-domain fallback. Returns ``None`` when no reliable company
    can be determined.
    """
    sender = "" if sender is None else str(sender)
    subject = "" if subject is None else str(subject)

    if "linkedin" in sender.lower() or "linkedin" in subject.lower():
        m = _LINKEDIN_COMPANY_RE.search(subject)
        if m:
            company = _clean_company(m.group(2))
            if company:
                return company

    company = None
    name = _sender_display_name(sender)
    if name and not _is_generic_sender(name):
        company = _clean_company(_strip_sender_suffixes(name))

    if not company:
        for pattern in _SUBJECT_COMPANY_PATTERNS:
            m = pattern.search(subject)
            if m:
                company = _clean_company(m.group(1))
                if company:
                    break

    if not company:
        company = _domain_fallback(sender)

    return company


def extract_sender_company(sender: str | None) -> str | None:
    """Company evidence from the *sender* alone (display name → domain).

    Never consults the subject — the matcher uses this for its distinct
    ``SENDER_COMPANY`` cascade level. ATS/vendor domains are skipped, so
    ``noreply@smartrecruiters.com`` yields ``None`` instead of "Smartrecruiters".
    """
    sender = "" if sender is None else str(sender)
    name = _sender_display_name(sender)
    if name and not _is_generic_sender(name):
        company = _clean_company(_strip_sender_suffixes(name))
        if company:
            return company
    return _domain_fallback(sender)


def extract_subject_company(sender: str | None, subject: str | None) -> str | None:
    """Company evidence from the *subject* alone (LinkedIn + AT patterns).

    Never consults the sender display name — the matcher uses this for its
    distinct ``SUBJECT`` cascade level.
    """
    sender = "" if sender is None else str(sender)
    subject = "" if subject is None else str(subject)
    if "linkedin" in sender.lower() or "linkedin" in subject.lower():
        m = _LINKEDIN_COMPANY_RE.search(subject)
        if m:
            company = _clean_company(m.group(2))
            if company:
                return company
    for pattern in _SUBJECT_COMPANY_PATTERNS:
        m = pattern.search(subject)
        if m:
            company = _clean_company(m.group(1))
            if company:
                return company
    return None


_DIVERSITY_TAG_RE = re.compile(r"(?i)\s*\((?:m/w/d|m/f/d|w/m/d|all genders|diverse)\)\s*$")
_ROLE_PATTERNS = [
    re.compile(
        r"application (?:for|as) (?:the (?:position|role) (?:of|as) )?"
        + r"(.+?)(?: at | - |$)",
        re.IGNORECASE,
    ),
    re.compile(
        r"bewerbung (?:als|für|fuer) (?:die (?:position|stelle) (?:als )?)?"
        + r"(.+?)(?: bei | - |$)",
        re.IGNORECASE,
    ),
    re.compile(r"position (?:of|as) (.+?)(?: at | - |$)", re.IGNORECASE),
]


def _clean_role(role: str | None) -> str | None:
    """Strip diversity tags and trailing punctuation from a role title."""
    if role is None:
        return None
    s = str(role).strip()
    s = _DIVERSITY_TAG_RE.sub("", s)
    s = re.sub(r"[\s,;]+$", "", s).strip()
    return s or None


def extract_role(subject: str | None) -> str | None:
    """Extract the role title from a subject line.

    Matches English ("application for/as X", "position of X") and German
    ("Bewerbung als/für X") forms. Returns ``None`` when no role is found.
    """
    subject = "" if subject is None else str(subject)
    for pattern in _ROLE_PATTERNS:
        m = pattern.search(subject)
        if m:
            role = _clean_role(m.group(1))
            if role:
                return role
    return None


_REQ_ID_RE = re.compile(r"\b(?:requisition|req)[-_. ]?(\d{4,})\b", re.IGNORECASE)
_LABELED_ID_PATTERNS = [
    re.compile(r"\bapplicant\s*id\s*:\s*([A-Za-z0-9][A-Za-z0-9._/\-]*)", re.IGNORECASE),
    re.compile(r"\b(?:reference|referenznummer|referenz)\s*:\s*([A-Za-z0-9][A-Za-z0-9._/\-]*)", re.IGNORECASE),
    re.compile(r"\breq(?:uisition)?\s*id\s*:\s*([A-Za-z0-9][A-Za-z0-9._/\-]*)", re.IGNORECASE),
    re.compile(r"\bjob\s*id\s*:\s*([A-Za-z0-9][A-Za-z0-9._/\-]*)", re.IGNORECASE),
]


def extract_application_id(subject: str | None, body: str | None) -> str | None:
    """Find an explicit ATS application id (``req-123456``, ``applicantId``,
    ``Reference``/``Referenznummer``/``Requisition ID``/``Job ID``).

    Unlabeled requisition ids normalize to ``req-<digits>``; labeled values are
    returned as written. Returns ``None`` when no id is present.
    """
    text = " ".join(str(part) for part in (subject, body) if part)
    if not text.strip():
        return None

    m = _REQ_ID_RE.search(text)
    if m:
        return f"req-{m.group(1)}"

    for pattern in _LABELED_ID_PATTERNS:
        m = pattern.search(text)
        if m:
            value = m.group(1).strip().strip("\"'.,;:)")
            # A real id virtually always contains a digit — guards against
            # prose like "Reference: for your reference we…".
            if value and re.search(r"\d", value):
                return value
    return None


_LOCATION_LABEL_RE = re.compile(
    r"\b(?:location|standort|arbeitsort|ort)\s*:\s*"
    + r"([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .,\-]{0,39}?)(?=[\r\n.!;]|$)",
    re.IGNORECASE,
)
_BASED_IN_RE = re.compile(
    r"\b(?:based in|located in|ansässig in)\s+"
    + r"([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .,\-]{0,39}?)(?=[\r\n.!;]|$)",
    re.IGNORECASE,
)
_REMOTE_WORD_RE = re.compile(r"\b(?:remote|hybrid|on[- ]site|vor ort|work from home|home office)\b", re.IGNORECASE)
_REMOTE_LABELS = {
    "remote": "Remote", "hybrid": "Hybrid", "on-site": "On-site",
    "on site": "On-site", "onsite": "On-site", "vor ort": "Vor Ort",
    "work from home": "Remote", "home office": "Remote",
}


def extract_location(subject: str | None, body: str | None) -> str | None:
    """Extract a location signal ("Location: Berlin", "Based in Munich",
    or a bare Remote/Hybrid word). Returns ``None`` when absent."""
    text = " ".join(str(part) for part in (subject, body) if part)
    if not text.strip():
        return None
    for pattern in (_LOCATION_LABEL_RE, _BASED_IN_RE):
        m = pattern.search(text)
        if m:
            loc = m.group(1).strip()
            if loc:
                return loc
    m = _REMOTE_WORD_RE.search(text)
    if m:
        return _REMOTE_LABELS.get(m.group(0).lower(), m.group(0).strip())
    return None


def extract_metadata(
    sender: str | None, subject: str | None, body: str | None
) -> dict[str, str | None]:
    """Compose the full metadata signal dict from sender/subject/body.

    Returns ``{"company", "role", "application_id", "location"}`` — each value
    is a ``str`` when the signal was found, else ``None``.
    """
    sender = "" if sender is None else str(sender)
    subject = "" if subject is None else str(subject)
    body = "" if body is None else str(body)
    return {
        "company": extract_company(sender, subject),
        "role": extract_role(subject),
        "application_id": extract_application_id(subject, body),
        "location": extract_location(subject, body),
    }


__all__ = [
    "clean_text",
    "detect_language",
    "extract_company",
    "extract_sender_company",
    "extract_subject_company",
    "extract_role",
    "extract_application_id",
    "extract_location",
    "extract_metadata",
]
