"""Multi-signal job-email classifier (W3_CLASS).

Given a ``NormalizedEmail`` (W2_MESSAGES/W2_PARSER output), this stage
decides: is this email a job-application event, and if so, which one?
It produces a ``ClassificationResult`` carrying the event type the state
machine keys on (``EVENT_TO_STATE`` vocabulary from ``state_machine.py``)
and a fused 0..1 confidence that drives the three tiers below.

Signals (bar.md § Multi-signal classification):
    * rule score   — keyword evidence for each event type. Reuses the
      de/en language cover already built in ``parser`` via the language
      field, with independent English + German keyword catalogs so a
      German rejection and an English rejection both score high.
    * sender score — ``sender_evidence()``: well-known ATS/recruiting
      senders and recruiting-team display names raise confidence.
    * llm score    — optional (never required, never blocks): fused in
      only when provided, so the pipeline runs deterministically without
      an LLM and improves when one is available.

Threshold tiers (bar.md § Classification Confidence Thresholds):
    >= 0.90 auto (automatic state transition)
    0.70-0.90 review (human review queue)
    <  0.70 ignore / archive

Design rules:
    * Pure functions: no I/O, no settings, no network. ``confidence_tier``
      takes thresholds explicitly so tests and the engine control them.
    * Defensive: never raises on empty/barren emails; unknown event types
      still produce a valid ``ClassificationResult``.
"""

from __future__ import annotations

import re

from gmail_agent.models import ClassificationResult, NormalizedEmail
from gmail_agent.state_machine import EVENT_TO_STATE

# Event types this classifier can emit — must be a subset of the state
# machine's vocabulary (EVENT_TO_STATE keys), so the engine can always
# resolve the target state. Ordered most-specific first.
EVENT_TYPES: tuple[str, ...] = (
    "REJECTION",
    "OFFER",
    "INTERVIEW",
    "ASSESSMENT",
    "ACKNOWLEDGEMENT",
    "SCREENING",
    "NONE",
)

# ── Rule score: per-event keyword catalogs ───────────────────────────
# German keywords mirror the application emails this system was built on
# (leider/ablehnen/bedauern for rejection, Gespräch/Einladung for
# interview, Zusage/Angebot for offer). English covers the same slots.
# The tuple form lets us count distinct hits — richer evidence, less
# over-counting of a single repeated word.

_RULE_CATALOG: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    # event -> (english words, german words)
    "REJECTION": (
        (
            "unfortunately", "unfortunately we", "we regret", "regret to",
            "not proceeding", "not able to", "unsuccessful", "other candidate",
            "your application has been unsuccessful", "we will not be",
        ),
        (
            "leider", "bedauern", "abgelehnt", "nicht erfolgreich",
            "keine positive nachricht", "absage", "bedauern wir",
            "wir müssen ihnen mitteilen", "müssen wir ihnen mitteilen",
            "ihre bewerbung nicht erfolgreich", "bewerbung war nicht erfolgreich",
        ),
    ),
    "OFFER": (
        (
            "pleased to offer", "extremely excited to offer", "offer letter",
            "pleased to offer", "offer you", "offered the position",
            "offer letter", "employment offer", "we are pleased to offer",
            "offer of employment", "congratulations", "welcome to the team",
            "we would like to offer", "contract", "salary", "start date",
        ),
        (
            "freuen uns, ihnen mitteilen", "zusage", "angebot", "vertrag",
            "wir freuen uns, sie begrüßen", "einstellungsangebot",
            "arbeitsvertrag", "willkommen im team", "zusage erhalten",
        ),
    ),
    "INTERVIEW": (
        (
            "interview", "interview invitation", "invite you to an interview",
            "interview with our", "interviewing", "first round", "call with our",
            "virtual interview", "schedule an interview", "recruiter call",
            "phone screen",
        ),
        (
            "vorstellungsgespräch", "vorstellungsgespraech", "gespräch",
            "gespraech", "einladung zum", "interview", "kennenlerngespräch",
            "einzuladen", "pd-telefongespräch", "videogespräch",
        ),
    ),
    "ASSESSMENT": (
        (
            "assessment", "take-home", "technical test", "coding challenge",
            "skills assessment", "online test", "test assignment",
            "personality test", "case study",
        ),
        (
            "assessment", "hausaufgabe", "aufgabe", "test", "einstellungstest",
            "online-test", "fallstudie", "code challenge",
        ),
    ),
    "ACKNOWLEDGEMENT": (
        (
            "thank you for applying", "thanks for applying", "we received your",
            "we have received your application", "confirm receipt",
            "application received", "on behalf of", "we acknowledged",
            "received your application",
        ),
        (
            "vielen dank für ihre bewerbung", "danke für ihre bewerbung",
            "ihre bewerbung ist bei uns eingegangen", "haben ihre bewerbung",
            "bewerbung ist bei uns", "wir haben ihre bewerbung erhalten",
            "eingang ihrer bewerbung", "erhalten von ihrer bewerbung",
        ),
    ),
    "SCREENING": (
        (
            "screening", "screening question", "quick screen", "application update",
            "we are reviewing", "reviewing your application", "shortlist",
            "shortlisted",
        ),
        (
            "screening", "sichtung", "wir prüfen", "prüfen ihre bewerbung",
            "prüfung ihrer unterlagen", "auswahlverfahren", "shortlist",
        ),
    ),
}

_WORD_RE = re.compile(r"[a-zäöüß\-']+|\d+")


def _count_signal_hits(text: str, words: tuple[str, ...]) -> int:
    """Count distinct catalog phrases/words present in the text.

    Exact phrase ("we are pleased to offer") and bare-word signals both
    count once each; a phrase containing a bare word counts only the
    phrase, so "pleased to offer" does not double-count with "offer".
    """
    lowered = text.lower()
    hits = 0
    for phrase in words:
        if phrase.strip() in lowered:
            hits += 1
    return hits


def rule_score(email: NormalizedEmail) -> tuple[str, float, str]:
    """Score every event type against the email; return (event, raw, text).

    ``raw`` is a 0..1 confidence purely from keyword evidence. The event
    with the most distinct keyword hits wins; ties resolve to the earlier
    (more specific) entry in ``EVENT_TYPES``. Emails with no hits score 0
    and resolve to ``NONE``.
    """
    corpus = " ".join(
        str(part) for part in (email.subject, email.snippet, email.body) if part
    )
    if not corpus.strip():
        return "NONE", 0.0, "empty body/subject"

    best: tuple[str, int, float] = ("NONE", 0, 0.0)
    for event, (en_words, de_words) in _RULE_CATALOG.items():
        hits = _count_signal_hits(corpus, en_words + de_words)
        if hits > best[1]:
            # Confidence scales to 0.97 with 4+ distinct hits, holding
            # ceiling below 1.0 so the fused value stays well-formed.
            score = min(0.97, 0.50 + hits * 0.14)
            best = (event, hits, score)

    event, hits, score = best
    return event, score, f"{hits} keyword hit(s) for {event}"


# ── Sender evidence ──────────────────────────────────────────────────

_ATS_DOMAIN_RE = re.compile(
    r"(?:smartrecruiters|greenhouse|lever|ashby|workday|workable|"
    + r"join\.com|recruitee|teamtailor|personio|ustwo|grnh|dover|"
    + r"bamboohr|jobvite|icims|sap\.successfactors|comeet|puzzle)\.?",
    re.IGNORECASE,
)
_RECRUITING_WORDS = (
    "recruiting", "recruiter", "talent", "people", "hr", "careers",
    "career", "jobs", "job", "bewerbungen", "personal", "talent_acquisition",
)
_NO_REPLY_RE = re.compile(r"no[\s._-]?reply|donotreply|noreply", re.IGNORECASE)


def sender_evidence(sender: str | None) -> float:
    """Return a 0..1 sender signal: how likely is this a job-application sender.

    Strong evidence: ATS domains (smartrecruiters.com, greenhouse.io, …)
    and recruiting-team display names ("Acme Recruiting Team"). Weak:
    personal mail (gmail/web.de/etc.) and generic senders with no recruiting
    signal.
    """
    s = str(sender or "").strip()
    if not s:
        return 0.3

    lower = s.lower()
    is_ats = _ATS_DOMAIN_RE.search(lower) is not None
    has_recruiting_word = any(w in lower for w in _RECRUITING_WORDS)
    if is_ats:
        return 0.95
    if has_recruiting_word:
        return 0.8
    if _NO_REPLY_RE.search(lower):
        if "gmail" in lower or "web.de" in lower or "gmx" in lower:
            return 0.3
        return 0.6
    # Domain fallback: a corporate-looking domain is mild evidence.
    domain = lower.rsplit("@", 1)[-1] if "@" in lower else None
    if domain and ".com" in domain and domain.split(".")[0] not in {
        "gmail", "yahoo", "hotmail", "outlook", "web", "gmx", "icloud", "aol",
    }:
        return 0.65
    return 0.3


# ── Fusion ───────────────────────────────────────────────────────────

_SENDER_NUDGE = 0.20
_LLM_WEIGHT = 0.20


def fuse_confidence(rule_score: float, sender_score: float) -> float:
    """Blend rule + sender signals into a single 0..1 confidence.

    Rule evidence is decisive: a rejection *sounds* like a rejection even
    from a generic sender, so a high rule score must stay high regardless
    of sender noise. The sender acts as a small nudge around neutral
    (0.5): an ATS/recruiting sender raises confidence, a personal inbox
    lowers it. Clamped to [0, 1].
    """
    fused = rule_score + (sender_score - 0.5) * _SENDER_NUDGE
    if fused > 1.0:
        fused = 1.0
    if fused < 0.0:
        fused = 0.0
    return round(fused, 4)


def llm_fusion(llm_score: float | None, base: float) -> float | None:
    """Optionally blend an LLM signal into the fused confidence.

    Returns ``None`` when no LLM score is provided (the skeptic path: the
    pipeline must not depend on a network call to make progress). When
    present, the LLM moves confidence by ``_LLM_WEIGHT`` toward its value.
    """
    if llm_score is None:
        return None
    return round(max(0.0, min(1.0, base * (1 - _LLM_WEIGHT) + llm_score * _LLM_WEIGHT)), 4)


def confidence_tier(
    confidence: float, auto_threshold: float = 0.90, review_threshold: float = 0.70
) -> str:
    """Map a confidence to 'auto' | 'review' | 'ignore' per bar thresholds.

    Explicit thresholds keep this pure and callable from the engine and
    tests without importing settings.
    """
    if confidence >= auto_threshold:
        return "auto"
    if confidence >= review_threshold:
        return "review"
    return "ignore"


# ── Entry point ──────────────────────────────────────────────────────

def classify_email(
    email: NormalizedEmail, llm_score: float | None = None
) -> ClassificationResult:
    """Classify one normalized email into a (event_type, confidence).

    Runs rule → sender → optional LLM fusion and packages everything into
    a ``ClassificationResult`` with human-readable evidence. Never raises;
    a barren email yields ``NONE`` with low confidence and an evidence
    string the engine can log.
    """
    event, rule, rule_evidence = rule_score(email)
    sender = sender_evidence(email.sender)
    base = fuse_confidence(rule, sender)

    if llm_score is not None:
        market = llm_fusion(llm_score, base)
        assert market is not None
        base = market
        evidence = (
            f"{rule_evidence}; sender_score={sender:.2f}; "
            f"llm_score={llm_score:.2f}"
        )
    else:
        evidence = f"{rule_evidence}; sender_score={sender:.2f}"

    if event == "NONE":
        # A non-job email is "NONE" with genuinely low confidence.
        base = min(base, 0.5)

    return ClassificationResult(
        event_type=event,
        confidence=base,
        evidence=evidence,
        rule_score=rule,
        sender_score=sender,
        llm_score=llm_score,
    )


__all__ = [
    "EVENT_TYPES",
    "classify_email",
    "confidence_tier",
    "fuse_confidence",
    "llm_fusion",
    "rule_score",
    "sender_evidence",
    "EVENT_TO_STATE",
]