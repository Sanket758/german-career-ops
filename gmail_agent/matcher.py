"""5-level cascading application matcher (W3_MATCH).

Given a classified email (W2 output + W2_PARSER metadata) and the tracker's
known applications (``store.get_all_applications()``), this stage answers:
which existing application does this email belong to? Or None when it
belongs to none (a new application, or not an application at all).

Cascade (bar.md § Module Structure — ``matcher.py``), strongest evidence
first; ``MatchLevel`` in ``models.py`` mirrors this order:

    L1 ID             explicit application id in body/subject
    L2 SENDER+COMPANY email sender/display-name company matches
    L3 SUBJECT        subject-parsed company/role matches
    L4 BODY_ENTITIES  company/role entities found in the body
    L5 SEMANTIC       token-similarity fallback on (company, role)

The cascade stops at the first level that yields a unique best candidate;
each level carries a confidence that reflects its strength. ATS-generic
senders (``noreply@smartrecruiters.com``) are handled by falling through
to subject/body company evidence — never by trusting the sender name.

Design rules:
    * Pure function + reuses ``parser.extract_metadata`` — no Gmail API,
      no settings, no store writes. The engine owns persistence.
    * Deterministic: same email + same applications → same MatchResult.
    * Defensive: never raises on empty input; returns None early.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

from gmail_agent.models import MatchLevel, MatchResult, NormalizedEmail
from gmail_agent.parser import (
    extract_metadata,
    extract_sender_company,
    extract_subject_company,
)

# ── Normalization helpers ────────────────────────────────────────────
_LOWER_ALNUM_RE = re.compile(r"[^a-z0-9äöüß]+")


def _norm(value: str | None) -> str:
    """Normalize a name for comparison: lowercase, alnum-only, single space."""
    if not value:
        return ""
    return _LOWER_ALNUM_RE.sub(" ", str(value).lower()).strip()


def _company_tokens(value: object) -> set[str]:
    """The token set of a company name (used for Jaccard similarity)."""
    return {t for t in _norm(str(value)).split(" ") if t}


def _token_similarity(a: object, b: object) -> float:
    """Jaccard similarity over company-token sets (0..1)."""
    sa, sb = _company_tokens(a), _company_tokens(b)
    if not sa or not sb:
        return 0.0
    if not sa or not sb:
        return 0.0
    inter = len(sa & sb)
    return inter / (len(sa) + len(sb) - inter)


def _seq_similarity(a: object, b: object) -> float:
    """SequenceMatcher ratio over normalized strings (0..1)."""
    return SequenceMatcher(None, _norm(str(a)), _norm(str(b))).ratio()


# ── Candidate scoring helpers ────────────────────────────────────────

_ID_MATCH_CONFIDENCE = 0.98
_COMPANY_MATCH_CONFIDENCE = 0.90
_SUBJECT_MATCH_CONFIDENCE = 0.82
_BODY_MATCH_CONFIDENCE = 0.75
_SEMANTIC_MATCH_CONFIDENCE = 0.62
# Company-name similarity below this floor is coincidence, not a match.
_MIN_COMPANY_SIM = 0.55


def _best_by_company(
    apps: list[dict[str, Any]],
    company: str | None,
    match_level: MatchLevel,
    base_confidence: float,
) -> MatchResult | None:
    """L2/L3: pick the application whose company matches the parsed company.

    Compares normalized company names with a confidence that reflects
    exact-equality vs token-overlap. A similarity floor (``_MIN_COMPANY_SIM``)
    keeps unrelated senders — e.g. a "Totallydifferent"-domain coupon blast —
    from matching a "Acme" application on spurious character overlap.
    """
    if not company:
        return None
    target = _norm(company)
    best: MatchResult | None = None
    best_sim = 0.0
    for app in apps:
        app_company = _norm(str(app.get("company", "")))
        if not app_company:
            continue
        sim = max(_seq_similarity(target, app_company), _token_similarity(company, app.get("company")))
        if sim > best_sim and sim >= _MIN_COMPANY_SIM:
            best_sim = sim
            best = MatchResult(
                application_id=str(app["application_id"]),
                confidence=base_confidence * sim,
                match_level=match_level,
                evidence=(
                    f"company '{company}' matched '{app.get('company')}' "
                    f"(sim={sim:.2f})"
                ),
            )
    return best


def _best_by_body_entities(
    apps: list[dict[str, Any]], body: str | None
) -> MatchResult | None:
    """L4: company/role mentions found in the body."""
    if not body:
        return None
    body_norm = _norm(body)
    best: MatchResult | None = None
    for app in apps:
        app_company = _norm(str(app.get("company", "")))
        app_position = _norm(str(app.get("position", "")))
        if not app_company and not app_position:
            continue
        if app_company and app_company in body_norm:
            conf = _BODY_MATCH_CONFIDENCE
            if app_position and app_position in body_norm:
                conf = _BODY_MATCH_CONFIDENCE + 0.05
            if best is None or conf > best.confidence:
                best = MatchResult(
                    application_id=str(app["application_id"]),
                    confidence=min(conf, 1.0),
                    match_level=MatchLevel.BODY_ENTITIES,
                    evidence=(
                        f"body mentions '{app.get('company')}'"
                        + (f" and '{app.get('position')}'" if app_position and app_position in body_norm else "")
                    ),
                )
    return best


def _best_by_semantic(
    apps: list[dict[str, Any]], company: str | None, role: str | None, body: str | None
) -> MatchResult | None:
    """L5: token-similarity fallback when all stronger evidence missed."""
    # Reuse the full text corpus for a loose (company, role) fingerprint.
    corpus = " ".join(
        str(x) for x in (company, role, (body or "")[:400]) if x
    )
    if not _norm(corpus):
        return None
    best: MatchResult | None = None
    best_sim = 0.0
    for app in apps:
        app_company = str(app.get("company", ""))
        app_position = str(app.get("position", ""))
        sim_company = _token_similarity(company, app_company)
        sim_role = _token_similarity(role, app_position)
        # Combine: company tokens weight more than role tokens.
        sim = 0.6 * sim_company + 0.4 * sim_role
        if best_sim < sim:
            best_sim = sim
            if sim >= 0.25:
                best = MatchResult(
                    application_id=str(app["application_id"]),
                    confidence=min(_SEMANTIC_MATCH_CONFIDENCE * sim, 0.7),
                    match_level=MatchLevel.SEMANTIC,
                    evidence=(
                        f"semantic sim={sim:.2f} vs '{app_company}' / "
                        f"'{app_position}'"
                    ),
                )
    return best


# ── Entry point ──────────────────────────────────────────────────────

def match_email(
    email: NormalizedEmail,
    applications: list[dict[str, Any]],
) -> MatchResult | None:
    """Match an email against known applications (5-level cascade).

    Returns a ``MatchResult`` with the best evidence found, or ``None``
    when no application plausibly corresponds. Never raises.
    """
    if not applications:
        return None

    subject = str(email.subject or "")
    body = str(email.body or "")
    meta = extract_metadata(email.sender, subject, body)
    app_id = meta["application_id"]
    company = meta["company"]
    role = meta["role"]

    # L1: explicit application id.
    if app_id:
        target = _norm(app_id)
        for app in applications:
            if target and _norm(str(app.get("application_id", ""))) == target:
                return MatchResult(
                    application_id=str(app["application_id"]),
                    confidence=_ID_MATCH_CONFIDENCE,
                    match_level=MatchLevel.ID,
                    evidence=f"explicit application id '{app_id}' matched",
                )

    # L2: sender-derived company (display name → domain).
    sender_company = extract_sender_company(email.sender)
    result = _best_by_company(
        applications,
        sender_company,
        MatchLevel.SENDER_COMPANY,
        _COMPANY_MATCH_CONFIDENCE,
    )
    if result:
        return result

    # L3: subject-derived company (LinkedIn + subject patterns).
    subject_company = extract_subject_company(email.sender, subject)
    result = _best_by_company(
        applications,
        subject_company,
        MatchLevel.SUBJECT,
        _SUBJECT_MATCH_CONFIDENCE,
    )
    if result:
        return result

    # L4: body entities.
    result = _best_by_body_entities(applications, body)
    if result:
        return result

    # L5: semantic fallback.
    result = _best_by_semantic(applications, company, role, body)
    if result:
        return result

    return None


__all__ = ["match_email"]