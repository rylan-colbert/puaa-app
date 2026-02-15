"""Clear all sightings and related data. Stop the backend server first if it's running."""
from sqlmodel import Session, select
from db import engine
from models import Sighting, AccessRequest, Message, Match

with Session(engine) as session:
    msgs = list(session.exec(select(Message)))
    reqs = list(session.exec(select(AccessRequest)))
    matches = list(session.exec(select(Match)))
    sightings = list(session.exec(select(Sighting)))

    for m in msgs:
        session.delete(m)
    for r in reqs:
        session.delete(r)
    for m in matches:
        session.delete(m)
    for s in sightings:
        session.delete(s)

    session.commit()
    print(f"Cleared: {len(sightings)} sightings, {len(reqs)} access requests, {len(msgs)} messages, {len(matches)} matches")
