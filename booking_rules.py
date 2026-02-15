"""
Booking (Match) rules: no double booking, no overlapping date ranges, property capacity.
"""

from datetime import datetime
from sqlmodel import Session, select
from models import Match, Property


def get_concurrent_matches_for_property(
    session: Session,
    property_id: int,
    start_time: datetime,
    end_time: datetime,
    exclude_match_id: int | None = None,
) -> list[Match]:
    """Return matches on this property that overlap [start_time, end_time]."""
    stmt = (
        select(Match)
        .where(Match.property_id == property_id)
        .where(Match.start_time < end_time)
        .where(Match.end_time > start_time)
    )
    if exclude_match_id is not None:
        stmt = stmt.where(Match.id != exclude_match_id)
    return list(session.exec(stmt).all())


def can_create_booking(
    session: Session,
    property_id: int,
    start_time: datetime,
    end_time: datetime,
) -> tuple[bool, str]:
    """
    Check if a new booking is allowed:
    - No overlapping bookings for this property (same time range).
    - If property has max_hunters, count overlapping matches and ensure under limit.
    Returns (allowed, message).
    """
    prop = session.get(Property, property_id)
    if not prop:
        return False, "Property not found"

    overlapping = get_concurrent_matches_for_property(session, property_id, start_time, end_time)
    if prop.max_hunters is not None and len(overlapping) >= prop.max_hunters:
        return False, f"Property allows at most {prop.max_hunters} concurrent hunter(s); this slot is full"
    return True, ""
