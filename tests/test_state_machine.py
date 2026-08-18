"""Validation tests for gmail_agent.state_machine.

Covers the W2_STATE contract: the canonical state vocabulary, legal/illegal
transition enforcement, the manual-override escape hatch (human review
queue), terminal-state detection, and the event_type → target mapping.
"""

import pytest

from gmail_agent.state_machine import (
    EVENT_TO_STATE,
    STATUSES,
    TRANSITIONS,
    TERMINAL_STATES,
    apply_transition,
    can_transition,
    is_terminal,
)


# ── Vocabulary ───────────────────────────────────────────────────────


def test_statuses_is_the_canonical_set():
    assert set(STATUSES) == {
        "APPLIED", "ACKNOWLEDGED", "SCREENING", "INTERVIEW",
        "ASSESSMENT", "OFFER", "REJECTED", "WITHDRAWN", "HIRED",
    }


def test_transitions_cover_every_state_with_known_targets():
    # Every canonical state is a key, and every target is a canonical state.
    assert set(TRANSITIONS) == set(STATUSES)
    for targets in TRANSITIONS.values():
        assert targets <= set(STATUSES)


def test_terminal_states_match_is_terminal():
    assert TERMINAL_STATES == {"REJECTED", "WITHDRAWN", "HIRED"}


# ── Legal transitions ────────────────────────────────────────────────


def test_forward_progression_chain_is_legal():
    assert can_transition("APPLIED", "ACKNOWLEDGED")
    assert can_transition("ACKNOWLEDGED", "SCREENING")
    assert can_transition("SCREENING", "INTERVIEW")
    assert can_transition("INTERVIEW", "ASSESSMENT")
    assert can_transition("ASSESSMENT", "OFFER")


def test_forward_jumps_are_legal():
    # A first email can already be an interview invite or an offer.
    assert can_transition("APPLIED", "INTERVIEW")
    assert can_transition("APPLIED", "ASSESSMENT")
    assert can_transition("APPLIED", "OFFER")
    assert can_transition("ACKNOWLEDGED", "OFFER")
    assert can_transition("SCREENING", "ASSESSMENT")


def test_offer_accepts_hire():
    assert can_transition("OFFER", "HIRED")
    assert apply_transition("OFFER", "HIRED") == "HIRED"


def test_rejection_legal_from_any_active_state():
    for state in ("APPLIED", "ACKNOWLEDGED", "SCREENING", "INTERVIEW", "ASSESSMENT"):
        assert can_transition(state, "REJECTED"), f"{state} -> REJECTED"


def test_withdrawal_legal_from_any_active_state():
    for state in ("APPLIED", "ACKNOWLEDGED", "SCREENING", "INTERVIEW", "ASSESSMENT", "OFFER"):
        assert can_transition(state, "WITHDRAWN"), f"{state} -> WITHDRAWN"


def test_self_transition_is_legal_noop():
    # Re-confirming the current state must not error the engine.
    for state in STATUSES:
        assert can_transition(state, state), f"{state} -> {state}"
        assert apply_transition(state, state) == state


# ── Illegal transitions ──────────────────────────────────────────────


def test_rejected_cannot_leave_terminal_without_override():
    assert not can_transition("REJECTED", "INTERVIEW")
    assert not can_transition("REJECTED", "APPLIED")
    assert not can_transition("REJECTED", "HIRED")
    with pytest.raises(ValueError):
        apply_transition("REJECTED", "INTERVIEW")


def test_other_terminal_states_cannot_leave():
    for terminal in ("WITHDRAWN", "HIRED"):
        for target in STATUSES:
            if target == terminal:
                continue
            assert not can_transition(terminal, target), f"{terminal} -> {target}"


def test_backward_moves_are_illegal():
    assert not can_transition("INTERVIEW", "APPLIED")
    assert not can_transition("OFFER", "INTERVIEW")
    assert not can_transition("SCREENING", "ACKNOWLEDGED")
    with pytest.raises(ValueError):
        apply_transition("ASSESSMENT", "INTERVIEW")


def test_rescinded_offer_requires_manual_override():
    # OFFER → REJECTED is candidate-sensitive; not an automatic move.
    assert not can_transition("OFFER", "REJECTED")
    with pytest.raises(ValueError):
        apply_transition("OFFER", "REJECTED")


def test_unknown_states_are_rejected():
    assert not can_transition("SPACED_OUT", "APPLIED")
    assert not can_transition("APPLIED", "SPACED_OUT")
    with pytest.raises(ValueError):
        apply_transition("APPLIED", "SPACED_OUT")
    with pytest.raises(ValueError):
        apply_transition("SPACED_OUT", "APPLIED")


# ── Manual override ──────────────────────────────────────────────────


def test_manual_override_allows_terminal_exit():
    assert apply_transition("REJECTED", "INTERVIEW", manual_override=True) == "INTERVIEW"
    assert apply_transition("HIRED", "APPLIED", manual_override=True) == "APPLIED"
    assert apply_transition("WITHDRAWN", "OFFER", manual_override=True) == "OFFER"


def test_manual_override_allows_backward_move():
    assert apply_transition("INTERVIEW", "SCREENING", manual_override=True) == "SCREENING"


def test_manual_override_still_validates_vocabulary():
    with pytest.raises(ValueError):
        apply_transition("REJECTED", "NOT_A_STATE", manual_override=True)
    with pytest.raises(ValueError):
        apply_transition("NOT_A_STATE", "APPLIED", manual_override=True)


# ── Terminal detection ───────────────────────────────────────────────


def test_is_terminal_true_for_terminal_states():
    for state in ("REJECTED", "WITHDRAWN", "HIRED"):
        assert is_terminal(state), state


def test_is_terminal_false_for_active_states():
    for state in ("APPLIED", "ACKNOWLEDGED", "SCREENING", "INTERVIEW", "ASSESSMENT", "OFFER"):
        assert not is_terminal(state), state


def test_is_terminal_false_for_unknown_state():
    assert not is_terminal("GHOST_STATE")


# ── EVENT_TO_STATE ───────────────────────────────────────────────────


def test_event_to_state_maps_known_events():
    assert EVENT_TO_STATE["REJECTION"] == "REJECTED"
    assert EVENT_TO_STATE["INTERVIEW"] == "INTERVIEW"
    assert EVENT_TO_STATE["ASSESSMENT"] == "ASSESSMENT"
    assert EVENT_TO_STATE["OFFER"] == "OFFER"
    assert EVENT_TO_STATE["ACKNOWLEDGEMENT"] == "ACKNOWLEDGED"


def test_event_to_state_targets_are_canonical_and_reachable():
    # Every classified event must resolve to a real, reachable state so the
    # engine can apply it to a fresh application without special-casing.
    for event_type, target in EVENT_TO_STATE.items():
        assert target in STATUSES, event_type
        assert target in TRANSITIONS  # state exists in the machine
        assert can_transition("APPLIED", target), f"APPLIED -> {target}"
