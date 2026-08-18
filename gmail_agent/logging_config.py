"""Three-layer logging foundation (bar.md § Logging).

1. Operational   → ``logs/gmail-service.log``   human-readable, rotating
2. Machine       → ``logs/events.jsonl``        one JSON object per line
3. Dead-letter   → ``logs/dead-letter.jsonl``   unprocessable payloads + reason

Functions take explicit paths so the service (W4) can point them at the
Settings-derived locations; tests point them at temporary directories.
"""

from __future__ import annotations

import json
import logging
import logging.handlers
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

OPERATIONAL_LOG_NAME = "gmail-service.log"
EVENTS_LOG_NAME = "events.jsonl"
DEAD_LETTER_LOG_NAME = "dead-letter.jsonl"

_OPERATIONAL_LOGGER = "gmail.operational"
_LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def setup_logging(log_dir: Path, level: int = logging.INFO) -> logging.Logger:
    """Configure and return the operational logger for the sync service.

    Writes rotating logs to ``log_dir/gmail-service.log`` (1 MB x 5
    backups) and mirrors every record to stderr for systemd/journald
    capture. Idempotent per target file: repeated calls with the same
    ``log_dir`` do not stack duplicate handlers.
    """
    log_dir = Path(log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    target = (log_dir / OPERATIONAL_LOG_NAME).resolve()

    logger = logging.getLogger(_OPERATIONAL_LOGGER)
    if any(
        isinstance(handler, logging.FileHandler)
        and Path(handler.baseFilename).resolve() == target
        for handler in logger.handlers
    ):
        return logger

    logger.setLevel(level)
    logger.propagate = False

    formatter = logging.Formatter(_LOG_FORMAT)

    file_handler = logging.handlers.RotatingFileHandler(
        target, maxBytes=1_000_000, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    return logger


def _append_jsonl(path: Path, record: dict[str, Any]) -> None:
    """Append one JSON line, flushing before return (crash-safe enough for
    single-line records on local filesystems)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")
        fh.flush()


def log_event(path: Path, payload: dict[str, Any]) -> None:
    """Append one machine-readable event line to ``events.jsonl``.

    ``payload`` is the event/evidence dict; a ``ts`` timestamp is added.
    """
    _append_jsonl(path, {"ts": _utcnow_iso(), **payload})


def log_dead_letter(path: Path, payload: dict[str, Any]) -> None:
    """Append one dead-letter entry (unprocessable payload + reason).

    Callers are expected to include at least a ``reason`` and whatever
    identifiers allow later manual reprocessing.
    """
    _append_jsonl(path, {"ts": _utcnow_iso(), **payload})
