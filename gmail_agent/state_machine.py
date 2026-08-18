"""Application state machine — enforces legal tracker state transitions.

W2_STATE: a pure, deterministic model of how an application moves through
the pipeline (see ``.gauntlet/bar/bar.md`` § State Machine):

    APPLIED → ACKNOWLEDGED → SCREENING → INTERVIEW → ASSESSMENT → OFFER
                                                            ↘ REJECTED (terminal)

Design rules:
    * ``TRANSITIONS`` is the single source of truth; ``can_transition`` and
      ``apply_transition`` are pure lookups over it — no I/O, no settings,
      no side effects.
    * Forward-only: a state may jump ahead in the canonical order (a first
      email can already be an interview invite) but never regress. Noisy
      re-classifications of an older email therefore cannot walk a real
      INTERVIEW back to SCREENING.
    * Terminal states (REJECTED, WITHDRAWN, HIRED) have no outgoing
      transitions. Leaving one — e.g. REJECTED → INTERVIEW after a human
      review — requires ``manual_override=True`` (the human review queue).
    * OFFER → REJECTED is deliberately *not* legal: a rescinded offer is a
      candidate-sensitive decision, so it needs a manual override like any
      other terminal exit. OFFER exits only via HIRED (accept) or
      WITHDRAWN (decline).
    * Self-transitions are legal no-ops (idempotent re-confirmation), which
      mirrors the old guard in ``scripts/gmail_sync.py`` that skipped updates
      when ``current_status == new_status``.

The engine (W4_ENGINE) imports ``can_transition`` / ``apply_transition`` /
``is_terminal`` / ``EVENT_TO_STATE`` from here. States are uppercase strings
matching the tracker vocabulary (``REJECTED``, ``OFFER``, ``HIRED`` already
used by ``scripts/gmail_sync.py``); callers are responsible for normalizing
tracker values to this vocabulary before asking.
"""

from __future__ import annotations

# ── Canonical states ──────────────────────────────────────────────────
# Ordered: earlier states come before later ones in the pipeline.
STATUSES: tuple[str, ...] = (
    "APPLIED",
    "ACKNOWLEDGED",
    "SCREENING",
    "INTERVIEW",
    "ASSESSMENT",
    "OFFER",
    "REJECTED",
    "WITHDRAWN",
    "HIRED",
)

# ── Terminal states ───────────────────────────────────────────────────
# is_terminal(state) is True exactly for these. No legal outgoing edges.
TERMINAL_STATES: frozenset[str] = frozenset({"REJECTED", "WITHDRAWN", "HIRED"})

# States that participate in the active progression (non-terminal).
ACTIVE_STATES: frozenset[str] = frozenset(STATUSES) - TERMINAL_STATES

# Forward reachable stages and candidate-controlled exits, shared by edges.
_NEXT_STAGES: frozenset[str] = frozenset(
    {"ACKNOWLEDGED", "SCREENING", "INTERVIEW", "ASSESSMENT", "OFFER"}
)
_EXITS: frozenset[str] = frozenset({"REJECTED", "WITHDRAWN"})

# ── Legal transitions ─────────────────────────────────────────────────
# from_state → frozenset of to_states. Forward jumps and exits are legal;
# backward moves and terminal exits are not (except via manual_override).
TRANSITIONS: dict[str, frozenset[str]] = {
    "APPLIED": _NEXT_STAGES | _EXITS,
    "ACKNOWLEDGED": frozenset({"SCREENING", "INTERVIEW", "ASSESSMENT", "OFFER"}) | _EXITS,
    "SCREENING": frozenset({"INTERVIEW", "ASSESSMENT", "OFFER"}) | _EXITS,
    "INTERVIEW": frozenset({"ASSESSMENT", "OFFER"}) | _EXITS,
    "ASSESSMENT": frozenset({"OFFER"}) | _EXITS,
    "OFFER": frozenset({"HIRED", "WITHDRAWN"}),
    "REJECTED": frozenset(),
    "WITHDRAWN": frozenset(),
    "HIRED": frozenset(),
}

# Self-transition: every state can re-confirm itself (idempotent no-op).
for _state in STATUSES:
    TRANSITIONS[_state] = TRANSITIONS[_state] | frozenset({_state})

# ── Event → target state ──────────────────────────────────────────────
# The classifier (W3_CLASS) emits one of these event_types; the engine
# resolves the *target* here, then checks legality via can_transition.
EVENT_TO_STATE: dict[str, str] = {
    "ACKNOWLEDGEMENT": "ACKNOWLEDGED",
    "SCREENING": "SCREENING",
    "INTERVIEW": "INTERVIEW",
    "ASSESSMENT": "ASSESSMENT",
    "OFFER": "OFFER",
    "REJECTION": "REJECTED",
}


def is_terminal(state: str) -> bool:
    """Return True for the terminal states REJECTED, WITHDRAWN, HIRED.

    Unknown states are treated as non-terminal: the engine's default is to
    keep processing, and any state not in our vocabulary cannot be terminal.
    """
    return state in TERMINAL_STATES


def can_transition(from_state: str, to_state: str) -> bool:
    """Return whether ``from_state → to_state`` is a legal transition.

    False for unknown states and for backward/terminal-exit moves.
    Self-transitions are legal (idempotent no-op).
    """
    return to_state in TRANSITIONS.get(from_state, frozenset())


def apply_transition(
    from_state: str,
    to_state: str,
    manual_override: bool = False,
) -> str:
    """Return ``to_state`` if the transition is legal, else raise ValueError.

    ``manual_override=True`` bypasses legality (human review queue / manual
    tracker edit) and returns ``to_state`` directly — but still validates
    that both states are in ``STATUSES`` so typos cannot inject garbage.
    """
    if from_state not in STATUSES:
        raise ValueError(
            f"unknown state {from_state!r}; expected one of {STATUSES}"
        )
    if to_state not in STATUSES:
        raise ValueError(
            f"unknown state {to_state!r}; expected one of {STATUSES}"
        )
    if manual_override or can_transition(from_state, to_state):
        return to_state
    raise ValueError(
        f"illegal transition: {from_state} -> {to_state} "
        + f"(legal targets: {sorted(TRANSITIONS[from_state])}); "
        + "use manual_override=True to bypass"
    )
