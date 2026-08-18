"""Validation tests for gmail_agent.classifier (W3_CLASS).

Covers the multi-signal classifier contract (bar.md § Classification
Confidence Thresholds): rule-score + sender-evidence fusion into a 0..1
confidence, event-type detection with de + en keyword signals, the three
LRU threshold tiers (>=0.90 auto, 0.70-0.90 review, <0.70 ignore), and
the optional LLM-score fusion path (never required, never blocking).
"""

from datetime import datetime, timezone

import pytest

from gmail_agent.classifier import (
    confidence_tier,
    fuse_confidence,
    classify_email,
    llm_fusion,
    sender_evidence,
)
from gmail_agent.models import ClassificationResult, NormalizedEmail

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


# ── Module surface ───────────────────────────────────────────────────


def test_public_api_surface():
    for fn in (confidence_tier, fuse_confidence, classify_email, llm_fusion, sender_evidence):
        assert callable(fn)


# ── sender_evidence ──────────────────────────────────────────────────


def test_sender_evidence_high_for_ats_domains():
    assert sender_evidence("no-reply@smartrecruiters.com") >= 0.9
    assert sender_evidence("noreply@greenhouse.io") >= 0.9
    assert sender_evidence("jobs@lever.co") >= 0.9


def test_sender_evidence_recruiting_display_name():
    assert sender_evidence("Acme Recruiting Team <jobs@acme.de>") >= 0.7


def test_sender_evidence_low_for_personal_gmail():
    assert sender_evidence("someone@gmail.com") < 0.4


def test_sender_evidence_none_safe():
    assert sender_evidence(None) < 0.5
    assert sender_evidence("") < 0.5


# ── fuse_confidence ──────────────────────────────────────────────────


def test_fuse_confidence_weights_rule_over_sender():
    low = fuse_confidence(rule_score=0.5, sender_score=0.95)
    strong = fuse_confidence(rule_score=0.85, sender_score=0.2)
    assert 0.0 <= low <= strong <= 1.0


def test_fuse_confidence_bounds():
    assert 0.0 <= fuse_confidence(0.0, 0.0) <= 1.0
    assert 0.0 <= fuse_confidence(1.0, 1.0) <= 1.0


# ── llm_fusion ───────────────────────────────────────────────────────


def test_llm_fusion_requires_llm_score():
    assert llm_fusion(None, 0.9) is None


def test_llm_fusion_low_llm_downgrades_confidence():
    base = fuse_confidence(rule_score=0.9, sender_score=0.9)
    fused = llm_fusion(0.1, base)
    assert fused is not None
    assert fused < base


def test_llm_fusion_high_llm_raises_confidence():
    base = fuse_confidence(rule_score=0.5, sender_score=0.5)
    fused = llm_fusion(0.95, base)
    assert fused is not None
    assert fused > base


# ── confidence_tier ──────────────────────────────────────────────────


def test_confidence_tier_thresholds():
    assert confidence_tier(0.95) == "auto"
    assert confidence_tier(0.90) == "auto"
    assert confidence_tier(0.80) == "review"
    assert confidence_tier(0.70) == "review"
    assert confidence_tier(0.60) == "ignore"
    assert confidence_tier(0.0) == "ignore"


# ── classify_email ───────────────────────────────────────────────────


def test_classify_rejection_english():
    email = _email(
        sender="Acme Talent <no-reply@acme.com>",
        subject="Update on your application",
        body=(
            "Unfortunately we have to inform you that we will not be "
            "proceeding with your application for the Senior Engineer "
            "position. We wish you the best in your search."
        ),
        language="en",
    )
    result = classify_email(email)
    assert isinstance(result, ClassificationResult)
    assert result.event_type == "REJECTION"
    assert result.confidence >= 0.90


def test_classify_rejection_german():
    email = _email(
        sender="Muster GmbH <no-reply@muster-gmbh.de>",
        subject="Ihre Bewerbung bei Muster GmbH",
        body=(
            "Leider müssen wir Ihnen mitteilen, dass Ihre Bewerbung "
            "nicht erfolgreich war. Wir bedauern, Ihnen keine positive "
            "Nachricht übermitteln zu können."
        ),
        language="de",
    )
    result = classify_email(email)
    assert result.event_type == "REJECTION"
    assert result.confidence >= 0.90


def test_classify_offer_german_with_mwd_job_suffix():
    email = _email(
        sender="Muster GmbH <jobs@muster-gmbh.de>",
        subject="Vertrag — Data Scientist (w/m/d)",
        body=(
            "Wir freuen uns, Ihnen mitteilen zu können, dass wir Ihnen die "
            "Stelle als Data Scientist (w/m/d) anbieten. Demnächst erhalten "
            "Sie Ihren Arbeitsvertrag von unserer HR-Abteilung."
        ),
        language="de",
    )
    result = classify_email(email)
    assert result.event_type == "OFFER"


def test_classify_interview_english():
    email = _email(
        subject="Interview invitation",
        body=(
            "We are pleased to invite you to an interview with our "
            "hiring team. Please pick a time from the available slots."
        ),
        language="en",
    )
    result = classify_email(email)
    assert result.event_type == "INTERVIEW"
    assert result.confidence >= 0.70


def test_classify_interview_german():
    email = _email(
        subject="Einladung zum Vorstellungsgespräch",
        body=(
            "Wir freuen uns, Sie zu einem Vorstellungsgespräch einzuladen. "
            "Bitte wählen Sie einen Zeitpunkt für das Gespräch."
        ),
        language="de",
    )
    result = classify_email(email)
    assert result.event_type == "INTERVIEW"
    assert result.confidence >= 0.70


def test_classify_offer_confidence_high():
    email = _email(
        subject="Offer — Software Engineer",
        body=(
            "We are very pleased to offer you the position of Senior "
            "Engineer. The attached contract details your salary and "
            "start date."
        ),
        language="en",
    )
    result = classify_email(email)
    assert result.event_type == "OFFER"
    assert result.confidence >= 0.90


def test_classify_acknowledgement():
    email = _email(
        subject="Thank you for applying",
        body=(
            "We confirm receipt of your application. Our team will "
            "review it and get back to you soon."
        ),
        language="en",
    )
    result = classify_email(email)
    assert result.event_type == "ACKNOWLEDGEMENT"


def test_classify_irrelevant_email_low_confidence():
    email = _email(
        sender="Newsletter <news@company.com>",
        subject="Our quarterly results are out",
        body=(
            "Read about our latest product launch and quarterly numbers. "
            "Check out the attached press release."
        ),
    )
    result = classify_email(email)
    assert result.confidence < 0.70


def test_classify_short_german_rejection_auto_tier():
    email = _email(
        sender="noreply@smartrecruiters.com",
        subject="Update on your application",
        body=(
            "Leider müssen wir Ihnen mitteilen, dass Ihre Bewerbung "
            "nicht erfolgreich war."
        ),
        language="de",
    )
    result = classify_email(email)
    assert result.event_type == "REJECTION"
    assert result.confidence >= 0.90


def test_classify_never_raises_on_barren_email():
    email = _email(subject="", body="", sender="", snippet="")
    result = classify_email(email)
    assert isinstance(result, ClassificationResult)
    assert 0.0 <= result.confidence <= 1.0