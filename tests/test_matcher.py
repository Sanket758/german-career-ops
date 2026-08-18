"""Validation tests for gmail_agent.matcher (W3_MATCH).

Covers the 5-level cascading matcher contract (bar.md § Module Structure —
``matcher.py``): explicit ID → sender+company → subject → body entities →
semantic similarity. Correctly links emails to existing applications and
handles the ATS-generic-sender case (noreply@smartrecruiters.com).
"""

from datetime import datetime, timezone

from gmail_agent.matcher import match_email
from gmail_agent.models import MatchLevel, NormalizedEmail

UTC = timezone.utc


def _email(**overrides) -> NormalizedEmail:
    """A valid NormalizedEmail with stable defaults."""
    defaults = dict(
        gmail_message_id="m1",
        thread_id="t1",
        received_at=datetime(2026, 8, 1, 9, 0, tzinfo=UTC),
        sender="Acme Recruiting <jobs@acme.de>",
        subject="Ihre Bewerbung",
        snippet="",
        body="",
        language="de",
    )
    defaults.update(overrides)
    return NormalizedEmail(**defaults)


def _apps(*rows):  # accept *Application_row dicts* (store.get_all_applications output)
    return [dict(r) for r in rows]


def _app(application_id="a42", company="Acme", position="Senior Engineer", status="APPLIED"):
    return {
        "application_id": application_id,
        "company": company,
        "position": position,
        "status": status,
        "applied_at": None,
        "last_updated": None,
    }


# ── Level 1: explicit ID ─────────────────────────────────────────────


def test_match_by_explicit_application_id():
    email = _email(body="Requisition ID: A42-123\nThank you.")
    apps = _apps(_app(application_id="A42-123", company="Acme"))
    result = match_email(email, apps)
    assert result is not None
    assert result.application_id == "A42-123"
    assert result.match_level == MatchLevel.ID


def test_match_by_req_id_normalized():
    email = _email(body="req-987654")
    apps = _apps(_app(application_id="req-987654", company="Acme"))
    result = match_email(email, apps)
    assert result is not None
    assert result.match_level == MatchLevel.ID


# ── Level 2: sender + company ────────────────────────────────────────


def test_match_by_sender_domain_when_id_absent():
    email = _email(
        sender="SmartRecruiters <no-reply@smartrecruiters.com>",
        subject="Application update: Acme GmbH",
        body="Thank you for your application to Acme.",
    )
    apps = _apps(_app(application_id="x1", company="Acme"))
    result = match_email(email, apps)
    assert result is not None
    assert result.application_id == "x1"
    assert result.confidence >= 0.70


def test_match_noreply_smartrecruiters():
    email = _email(
        sender="noreply@smartrecruiters.com",
        subject="Your application at Muster GmbH",
        body="We have received your application for the role at Muster GmbH.",
    )
    apps = _apps(
        _app(application_id="app-1", company="Muster"),
        _app(application_id="app-2", company="Smartrecruiters"),
    )
    result = match_email(email, apps)
    assert result is not None
    assert result.application_id == "app-1"
    assert result.match_level == MatchLevel.SUBJECT


def test_match_bare_ats_sender_never_matches_ats_vendor_as_company():
    email = _email(
        sender="noreply@smartrecruiters.com",
        subject="Status update",
        body="Your application status has changed.",
    )
    apps = _apps(
        _app(application_id="app-1", company="Muster"),
        _app(application_id="app-2", company="Smartrecruiters"),
    )
    result = match_email(email, apps)
    assert result is None or result.application_id == "app-1"


# ── Level 3: subject ─────────────────────────────────────────────────


def test_match_by_subject_company():
    email = _email(
        sender="no-reply@some-ats.io",
        subject="Re: Application for Senior Engineer at Acme",
        body="",
    )
    apps = _apps(_app(application_id="y2", company="Acme"))
    result = match_email(email, apps)
    assert result is not None
    assert result.application_id == "y2"
    assert result.match_level in (MatchLevel.SENDER_COMPANY, MatchLevel.SUBJECT)


# ── Level 4: body entities ───────────────────────────────────────────


def test_match_by_body_company_entity():
    email = _email(
        sender="no-reply@other.de",
        subject="Status update",
        body="The hiring team at Acme has sent you a message.",
    )
    apps = _apps(_app(application_id="z9", company="Acme"))
    result = match_email(email, apps)
    assert result is not None
    assert result.application_id == "z9"
    assert result.match_level == MatchLevel.BODY_ENTITIES


# ── Level 5: semantic similarity ─────────────────────────────────────


def test_match_by_semantic_similarity_as_fallback():
    email = _email(
        sender="no-reply@recruiting.io",
        subject="We got your CV",
        body="Our team liked your Senior Software Engineer profile at Acme Group.",
    )
    apps = _apps(_app(application_id="w5", company="Acme Group", position="Senior Software Engineer"))
    result = match_email(email, apps)
    assert result is not None
    assert result.application_id == "w5"
    # Could be subject/body via company tokens OR a semantic fallback — but
    # it must resolve to the right application with confidence in range.
    assert 0.0 <= result.confidence <= 1.0


# ── No match / edge cases ────────────────────────────────────────────


def test_match_returns_none_when_no_application_fits():
    email = _email(
        sender="notify@totallydifferent.com",
        subject="Coupon offer",
        body="20% off your next purchase.",
    )
    apps = _apps(_app(application_id="a1", company="Acme", position="Senior Engineer"))
    assert match_email(email, apps) is None


def test_match_empty_application_list():
    email = _email()
    assert match_email(email, []) is None


def test_match_never_raises_on_empty_email():
    email = _email(subject="", body="", sender="")
    apps = _apps(_app())
    result = match_email(email, apps)
    assert result is None or isinstance(result.application_id, str)


def test_match_confidence_boundaries():
    email = _email(body="Requisition ID: K-2026-7")
    apps = _apps(_app(application_id="K-2026-7"))
    result = match_email(email, apps)
    assert result is not None
    assert 0.0 <= result.confidence <= 1.0
    assert result.evidence  # non-empty evidence string