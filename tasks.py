"""
Background tasks: run after booking created (mock email, analytics log).
FastAPI BackgroundTasks are used from main.py.
"""

import logging
from datetime import datetime

logger = logging.getLogger("puaa.tasks")


def send_booking_confirmation_mock(match_id: int, hunter_email: str, property_name: str, start_time: str, end_time: str):
    """Mock: in production replace with real email (SendGrid, SES, etc.)."""
    logger.info(
        "event=booking_confirmation_mock match_id=%s hunter_email=%s property=%s start=%s end=%s",
        match_id, hunter_email, property_name, start_time, end_time,
    )
    # In production: email.send(to=hunter_email, template="booking_confirmation", ...)


def log_booking_analytics(match_id: int, property_id: int, landowner_id: int, hunter_id: int):
    """Log analytics event for booking (for dashboards, investors)."""
    logger.info(
        "event=booking_analytics match_id=%s property_id=%s landowner_id=%s hunter_id=%s at=%s",
        match_id, property_id, landowner_id, hunter_id, datetime.utcnow().isoformat() + "Z",
    )
