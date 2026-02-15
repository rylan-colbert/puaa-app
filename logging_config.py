"""
Structured logging: who booked what, when property created, failed logins.
Uses standard logging; format is structured (key=value) for easy parsing.
"""

import logging
import sys
import time
from datetime import datetime

# One-time setup
def setup_logging(level: str = "INFO"):
    """Configure root logger with structured-style format (UTC)."""
    log_level = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
        stream=sys.stdout,
    )
    logging.Formatter.converter = time.gmtime


def _ts() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


logger = logging.getLogger("puaa")


def log_property_created(property_id: int, owner_user_id: int, name: str):
    """When a property is created."""
    logger.info(
        "event=property_created property_id=%s owner_user_id=%s name=%s at=%s",
        property_id, owner_user_id, name, _ts(),
    )


def log_booking_created(match_id: int, property_id: int, landowner_user_id: int, hunter_user_id: int, start_time: str, end_time: str):
    """Who booked what and when."""
    logger.info(
        "event=booking_created match_id=%s property_id=%s landowner_user_id=%s hunter_user_id=%s start_time=%s end_time=%s at=%s",
        match_id, property_id, landowner_user_id, hunter_user_id, start_time, end_time, _ts(),
    )


def log_booking_cancelled(match_id: int, cancelled_by_user_id: int, reason: str = ""):
    """Booking was cancelled."""
    logger.info(
        "event=booking_cancelled match_id=%s cancelled_by_user_id=%s reason=%s at=%s",
        match_id, cancelled_by_user_id, reason or "user_cancelled", _ts(),
    )


def log_login_failed(email: str, reason: str = "invalid_credentials"):
    """Failed login attempt (do not log password)."""
    logger.warning(
        "event=login_failed email=%s reason=%s at=%s",
        email, reason, _ts(),
    )


def log_login_success(user_id: int, email: str):
    """Successful login."""
    logger.info("event=login_success user_id=%s email=%s at=%s", user_id, email, _ts())
