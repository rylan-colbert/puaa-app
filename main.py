from fastapi import FastAPI, Depends, HTTPException, Header
from sqlmodel import Session, select
from datetime import datetime
from typing import Optional, List

from db import create_db_and_tables, get_session
from models import User, Property, Sighting, Subscription, AccessRequest, Match
from auth import hash_password, verify_password, create_access_token, decode_token
from matching import haversine_km, analyze_sighting

app = FastAPI(title="PigMatch Backend")

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# ---------- Auth helpers ----------
def get_current_user(
    session: Session = Depends(get_session),
    authorization: Optional[str] = Header(default=None)
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1]
    sub = decode_token(token)
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")

    # sub is user_id as string
    user = session.get(User, int(sub))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_role(user: User, role: str):
    if user.role != role:
        raise HTTPException(status_code=403, detail=f"Requires role: {role}")

# ---------- Auth routes ----------
@app.post("/auth/register")
def register(payload: dict, session: Session = Depends(get_session)):
    name = payload.get("name")
    email = payload.get("email")
    role = payload.get("role")
    password = payload.get("password")

    if role not in ["landowner", "hunter"]:
        raise HTTPException(400, "role must be landowner or hunter")
    if not all([name, email, password]):
        raise HTTPException(400, "name, email, password required")

    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        raise HTTPException(400, "email already registered")

    user = User(
        name=name,
        email=email,
        role=role,
        password_hash=hash_password(password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(str(user.id))
    return {"user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}, "token": token}

@app.post("/auth/login")
def login(payload: dict, session: Session = Depends(get_session)):
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        raise HTTPException(400, "email and password required")

    user = session.exec(select(User).where(User.email == email)).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(401, "invalid credentials")

    token = create_access_token(str(user.id))
    return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}}

# ---------- Properties ----------
@app.post("/properties")
def create_property(
    payload: dict,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "landowner")
    name = payload.get("name")
    lat = payload.get("lat")
    lng = payload.get("lng")
    notes = payload.get("notes")

    if name is None or lat is None or lng is None:
        raise HTTPException(400, "name, lat, lng required")

    prop = Property(owner_user_id=user.id, name=name, lat=float(lat), lng=float(lng), notes=notes)
    session.add(prop)
    session.commit()
    session.refresh(prop)
    return prop

@app.get("/properties/mine")
def list_my_properties(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "landowner")
    props = session.exec(select(Property).where(Property.owner_user_id == user.id)).all()
    return props

# ---------- Subscriptions ----------
@app.post("/subscriptions")
def create_subscription(
    payload: dict,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "hunter")
    center_lat = payload.get("center_lat")
    center_lng = payload.get("center_lng")
    radius_km = payload.get("radius_km")

    if center_lat is None or center_lng is None or radius_km is None:
        raise HTTPException(400, "center_lat, center_lng, radius_km required")

    sub = Subscription(
        hunter_user_id=user.id,
        center_lat=float(center_lat),
        center_lng=float(center_lng),
        radius_km=float(radius_km),
        active=True
    )
    session.add(sub)
    session.commit()
    session.refresh(sub)
    return sub

@app.get("/subscriptions/mine")
def list_my_subscriptions(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "hunter")
    subs = session.exec(select(Subscription).where(Subscription.hunter_user_id == user.id)).all()
    return subs

# ---------- Sightings + matching ----------
@app.post("/sightings")
def create_sighting(
    payload: dict,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "landowner")

    property_id = payload.get("property_id")
    seen_at = payload.get("seen_at")  # ISO string, e.g. "2026-02-14T18:30:00"
    lat = payload.get("lat")
    lng = payload.get("lng")
    count_estimate = payload.get("count_estimate")
    notes = payload.get("notes")

    if property_id is None or seen_at is None:
        raise HTTPException(400, "property_id and seen_at required")

    prop = session.get(Property, int(property_id))
    if not prop or prop.owner_user_id != user.id:
        raise HTTPException(403, "property not found or not yours")

    seen_dt = datetime.fromisoformat(seen_at)

    # default lat/lng to property center if not provided
    lat_val = float(lat) if lat is not None else prop.lat
    lng_val = float(lng) if lng is not None else prop.lng

    ai = analyze_sighting(notes)

    sighting = Sighting(
        property_id=prop.id,
        reported_by_user_id=user.id,
        lat=lat_val,
        lng=lng_val,
        seen_at=seen_dt,
        count_estimate=int(count_estimate) if count_estimate is not None else None,
        notes=notes,
        credibility_score=ai["credibility_score"],
        tags_csv=",".join(ai["tags"]),
        summary=ai["summary"],
    )
    session.add(sighting)
    session.commit()
    session.refresh(sighting)

    # Match to hunters with subscriptions within radius
    subs = session.exec(select(Subscription).where(Subscription.active == True)).all()
    matches = []
    for sub in subs:
        d = haversine_km(sighting.lat, sighting.lng, sub.center_lat, sub.center_lng)
        if d <= sub.radius_km:
            hunter = session.get(User, sub.hunter_user_id)
            if hunter and hunter.role == "hunter":
                matches.append({
                    "hunter_user_id": hunter.id,
                    "hunter_name": hunter.name,
                    "distance_km": round(d, 2),
                })

    return {"sighting": sighting, "matched_hunters": matches}

@app.get("/sightings/{sighting_id}")
def get_sighting(
    sighting_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    s = session.get(Sighting, sighting_id)
    if not s:
        raise HTTPException(404, "not found")
    return s

# ---------- Access requests ----------
@app.post("/sightings/{sighting_id}/request-access")
def request_access(
    sighting_id: int,
    payload: dict,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "hunter")
    message = payload.get("message")

    sighting = session.get(Sighting, sighting_id)
    if not sighting:
        raise HTTPException(404, "sighting not found")

    req = AccessRequest(sighting_id=sighting_id, hunter_user_id=user.id, message=message, status="pending")
    session.add(req)
    session.commit()
    session.refresh(req)
    return req

@app.get("/requests/incoming")
def incoming_requests(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "landowner")

    # incoming requests are for sightings on YOUR properties
    my_props = session.exec(select(Property.id).where(Property.owner_user_id == user.id)).all()
    my_prop_ids = [pid for (pid,) in my_props] if my_props and isinstance(my_props[0], tuple) else [p for p in my_props]

    my_sightings = session.exec(select(Sighting.id).where(Sighting.property_id.in_(my_prop_ids))).all()
    my_sighting_ids = [sid for (sid,) in my_sightings] if my_sightings and isinstance(my_sightings[0], tuple) else [s for s in my_sightings]

    reqs = session.exec(select(AccessRequest).where(AccessRequest.sighting_id.in_(my_sighting_ids))).all()
    return reqs

@app.post("/requests/{request_id}/approve")
def approve_request(
    request_id: int,
    payload: dict,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "landowner")
    start_time = payload.get("start_time")
    end_time = payload.get("end_time")
    instructions = payload.get("instructions")

    if not start_time or not end_time:
        raise HTTPException(400, "start_time and end_time required (ISO format)")

    req = session.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(404, "request not found")

    sighting = session.get(Sighting, req.sighting_id)
    prop = session.get(Property, sighting.property_id) if sighting else None
    if not sighting or not prop or prop.owner_user_id != user.id:
        raise HTTPException(403, "not authorized")

    req.status = "approved"

    m = Match(
        sighting_id=sighting.id,
        property_id=prop.id,
        landowner_user_id=user.id,
        hunter_user_id=req.hunter_user_id,
        start_time=datetime.fromisoformat(start_time),
        end_time=datetime.fromisoformat(end_time),
        instructions=instructions
    )
    session.add(req)
    session.add(m)
    session.commit()
    session.refresh(m)
    return {"request": req, "match": m}

@app.post("/requests/{request_id}/reject")
def reject_request(
    request_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "landowner")

    req = session.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(404, "request not found")

    sighting = session.get(Sighting, req.sighting_id)
    prop = session.get(Property, sighting.property_id) if sighting else None
    if not sighting or not prop or prop.owner_user_id != user.id:
        raise HTTPException(403, "not authorized")

    req.status = "rejected"
    session.add(req)
    session.commit()
    return req

# ---------- Matches ----------
@app.get("/matches/mine")
def list_my_matches(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if user.role == "landowner":
        ms = session.exec(select(Match).where(Match.landowner_user_id == user.id)).all()
    else:
        ms = session.exec(select(Match).where(Match.hunter_user_id == user.id)).all()
    return ms