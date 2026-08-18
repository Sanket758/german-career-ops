"""Tests for gmail_agent.logging_config (3-layer logging foundation)."""

import json

from gmail_agent.logging_config import log_dead_letter, log_event, setup_logging


def test_setup_logging_writes_operational_log(tmp_path):
    logger = setup_logging(tmp_path)
    logger.info("hello operational log")
    for handler in logger.handlers:
        handler.flush()
    log_file = tmp_path / "gmail-service.log"
    assert log_file.exists()
    assert "hello operational log" in log_file.read_text()


def test_setup_logging_creates_nested_log_dir(tmp_path):
    log_dir = tmp_path / "nested" / "logs"
    logger = setup_logging(log_dir)
    logger.warning("warn message")
    for handler in logger.handlers:
        handler.flush()
    assert (log_dir / "gmail-service.log").exists()


def test_log_event_appends_machine_readable_line(tmp_path):
    events_path = tmp_path / "events.jsonl"
    log_event(events_path, {"event_type": "REJECTION", "gmail_message_id": "m1"})
    lines = events_path.read_text().strip().splitlines()
    assert len(lines) == 1
    record = json.loads(lines[0])
    assert record["event_type"] == "REJECTION"
    assert record["gmail_message_id"] == "m1"
    assert "ts" in record


def test_log_event_appends_multiple_lines(tmp_path):
    events_path = tmp_path / "events.jsonl"
    log_event(events_path, {"event_type": "A"})
    log_event(events_path, {"event_type": "B"})
    lines = events_path.read_text().strip().splitlines()
    assert len(lines) == 2
    assert json.loads(lines[0])["event_type"] == "A"
    assert json.loads(lines[1])["event_type"] == "B"


def test_log_dead_letter_records_reason(tmp_path):
    dead_letter_path = tmp_path / "dead-letter.jsonl"
    log_dead_letter(dead_letter_path, {"gmail_message_id": "m1", "reason": "parse_error"})
    lines = dead_letter_path.read_text().strip().splitlines()
    assert len(lines) == 1
    record = json.loads(lines[0])
    assert record["reason"] == "parse_error"
    assert record["gmail_message_id"] == "m1"
