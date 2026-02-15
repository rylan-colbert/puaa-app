import base64
import io
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Header, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlmodel import Session, select, func
from sqlalchemy import desc
from datetime import datetime
from typing import Optional, List
import qrcode

from db import create_db_and_tables, get_session
from models import User, Property, Sighting, Subscription, AccessRequest, Match, Message
from config import config
from logging_config import setup_logging, log_property_created, log_booking_created, log_booking_cancelled, log_login_failed, log_login_success
from cache import get as cache_get, set_ as cache_set, invalidate_pattern as cache_invalidate
from tasks import send_booking_confirmation_mock, log_booking_analytics
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    create_totp_secret,
    get_totp_uri,
    verify_totp,
    create_pending_2fa_token,
    decode_pending_2fa_token,
)
from matching import haversine_km, analyze_sighting
from schemas import (
    RegisterRequest,
    LoginRequest,
    Verify2FALoginRequest,
    Confirm2FASetupRequest,
    Disable2FARequest,
    UserResponse,
    PropertyCreate,
    PropertyUpdate,
    PropertyResponse,
    SubscriptionCreate,
    SightingCreate,
    RequestAccessBody,
    ApproveRequestBody,
    SendMessageBody,
    ErrorDetail,
)
from booking_rules import can_create_booking


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(config.LOG_LEVEL)
    try:
        import pyotp  # noqa: F401
    except ImportError:
        raise RuntimeError(
            "2FA requires pyotp. Run: pip install pyotp qrcode[pil] (or pip install -r requirements.txt)"
        )
    create_db_and_tables()
    yield


app = FastAPI(
    title="Pua'a Backend",
    description="API for landowners to list properties and report pig sightings, and hunters to subscribe to areas and book access. Uses JWT auth and role-based access (landowner vs hunter).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """Return 422 with clean detail for validation errors (Pydantic)."""
    errors = exc.errors()
    detail = "; ".join(
        f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in errors
    ) if errors else "Validation error"
    return JSONResponse(
        status_code=422,
        content={"detail": detail},
    )


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


def _to_user_response(user: User):
    """Pydantic v1 uses from_orm, v2 uses model_validate."""
    if hasattr(UserResponse, "model_validate"):
        return UserResponse.model_validate(user)
    return UserResponse.from_orm(user)


# ---------- Auth routes ----------
@app.post(
    "/auth/register",
    response_model=None,
    summary="Sign up",
    description="Register a new user (landowner or hunter). Returns user and JWT token.",
    responses={400: {"description": "Invalid role or email already registered"}},
)
def register(payload: RegisterRequest, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        role=payload.role,
        password_hash=hash_password(payload.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    token = create_access_token(str(user.id))
    return {"user": _to_user_response(user), "token": token}


@app.post(
    "/auth/login",
    summary="Login",
    description="Login with email and password. If 2FA is enabled, returns requires_2fa and pending_token instead of token.",
    responses={401: {"description": "Invalid credentials"}},
)
def login(payload: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        log_login_failed(payload.email)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    log_login_success(user.id, user.email)
    if user.totp_secret:
        pending_token = create_pending_2fa_token(user.id)
        return {
            "requires_2fa": True,
            "pending_token": pending_token,
            "message": "Enter the 6-digit code from your authenticator app",
        }
    token = create_access_token(str(user.id))
    return {"token": token, "user": _to_user_response(user)}

@app.post(
    "/auth/2fa/verify-login",
    summary="Complete 2FA login",
    description="After login returned requires_2fa, send pending_token and 6-digit code to get full token.",
    responses={401: {"description": "Invalid or expired 2FA token or wrong code"}},
)
def verify_2fa_login(payload: Verify2FALoginRequest, session: Session = Depends(get_session)):
    user_id = decode_pending_2fa_token(payload.pending_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired 2FA token. Please log in again.")

    user = session.get(User, int(user_id))
    if not user or not user.totp_secret:
        raise HTTPException(status_code=401, detail="2FA not enabled or user not found")

    if not verify_totp(user.totp_secret, payload.code):
        raise HTTPException(status_code=401, detail="Invalid verification code")

    token = create_access_token(str(user.id))
    return {"token": token, "user": _to_user_response(user)}

@app.get("/auth/2fa/status")
def get_2fa_status(user: User = Depends(get_current_user)):
    """Check if the current user has 2FA enabled."""
    return {"enabled": bool(user.totp_secret)}

def _qr_code_data_url(uri: str) -> str:
    """Generate a data URL for the TOTP provisioning QR code."""
    qr = qrcode.QRCode(version=1, box_size=4, border=4)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

@app.post("/auth/2fa/setup")
def setup_2fa(user: User = Depends(get_current_user)):
    """Start 2FA setup: returns secret, URI, and QR image. Call confirm-setup after scanning."""
    if user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA is already enabled")
    secret = create_totp_secret()
    uri = get_totp_uri(secret, user.email)
    qr_data_url = _qr_code_data_url(uri)
    return {
        "secret": secret,
        "uri": uri,
        "qr_image": qr_data_url,
        "message": "Scan the QR code with your authenticator app, then call POST /auth/2fa/confirm-setup with code and secret",
    }

@app.post(
    "/auth/2fa/confirm-setup",
    summary="Confirm 2FA setup",
    description="Verify the 6-digit code from your app and the secret from setup to enable 2FA.",
)
def confirm_2fa_setup(payload: Confirm2FASetupRequest, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    if user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA is already enabled")
    if not verify_totp(payload.secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid code. Make sure the code from your app is correct.")
    user.totp_secret = payload.secret
    session.add(user)
    session.commit()
    return {"message": "2FA is now enabled"}

@app.post(
    "/auth/2fa/disable",
    summary="Disable 2FA",
    description="Turn off 2FA. Requires current password.",
    responses={401: {"description": "Invalid password"}},
)
def disable_2fa(payload: Disable2FARequest, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")
    user.totp_secret = None
    session.add(user)
    session.commit()
    return {"message": "2FA has been disabled"}

# ---------- Properties ----------
@app.post(
    "/properties",
    response_model=PropertyResponse,
    summary="Create property",
    description="Landowner only. Create a new property with name, location, optional island, daily_rate, max_hunters.",
    status_code=201,
    responses={403: {"description": "Requires landowner role"}},
)
def create_property(
    payload: PropertyCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "landowner")
    prop = Property(
        owner_user_id=user.id,
        name=payload.name,
        lat=payload.lat,
        lng=payload.lng,
        notes=payload.notes,
        island=payload.island,
        daily_rate=payload.daily_rate,
        max_hunters=payload.max_hunters,
        size_acres=payload.size_acres,
    )
    session.add(prop)
    session.commit()
    session.refresh(prop)
    log_property_created(prop.id, user.id, prop.name)
    cache_invalidate("properties:")
    return prop


@app.get(
    "/properties",
    response_model=List[PropertyResponse],
    summary="List properties (with filters + pagination)",
    description="List properties. Optional: island, min_price, max_price, name, min_lat, max_lat, min_lng, max_lng, page, page_size. Cached when TTL set.",
)
def list_properties(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    island: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None, gt=0),
    max_price: Optional[float] = Query(None, gt=0),
    name: Optional[str] = Query(None),
    min_lat: Optional[float] = Query(None, ge=-90, le=90),
    max_lat: Optional[float] = Query(None, ge=-90, le=90),
    min_lng: Optional[float] = Query(None, ge=-180, le=180),
    max_lng: Optional[float] = Query(None, ge=-180, le=180),
    page: int = Query(1, ge=1),
    page_size: int = Query(None, ge=1, le=config.MAX_PAGE_SIZE),
):
    page_size = page_size or config.DEFAULT_PAGE_SIZE
    cache_key = f"properties:{island}:{min_price}:{max_price}:{name}:{min_lat}:{max_lat}:{min_lng}:{max_lng}:{page}:{page_size}"
    if config.CACHE_PROPERTIES_TTL > 0:
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
    stmt = select(Property)
    if island is not None:
        stmt = stmt.where(Property.island == island)
    if min_price is not None:
        stmt = stmt.where(Property.daily_rate >= min_price)
    if max_price is not None:
        stmt = stmt.where(Property.daily_rate <= max_price)
    if name is not None and name.strip():
        stmt = stmt.where(Property.name.contains(name.strip()))
    if min_lat is not None:
        stmt = stmt.where(Property.lat >= min_lat)
    if max_lat is not None:
        stmt = stmt.where(Property.lat <= max_lat)
    if min_lng is not None:
        stmt = stmt.where(Property.lng >= min_lng)
    if max_lng is not None:
        stmt = stmt.where(Property.lng <= max_lng)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    props = session.exec(stmt).all()
    result = list(props)
    if config.CACHE_PROPERTIES_TTL > 0:
        cache_set(cache_key, result, config.CACHE_PROPERTIES_TTL)
    return result


@app.get(
    "/properties/mine",
    response_model=List[PropertyResponse],
    summary="List my properties",
    description="Landowner only. Pagination: page, page_size.",
    responses={403: {"description": "Requires landowner role"}},
)
def list_my_properties(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(None, ge=1, le=config.MAX_PAGE_SIZE),
):
    require_role(user, "landowner")
    page_size = page_size or config.DEFAULT_PAGE_SIZE
    stmt = select(Property).where(Property.owner_user_id == user.id).offset((page - 1) * page_size).limit(page_size)
    props = session.exec(stmt).all()
    return list(props)


@app.get(
    "/properties/{property_id}",
    response_model=PropertyResponse,
    summary="Get property by ID",
    responses={404: {"description": "Property not found"}},
)
def get_property(
    property_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    prop = session.get(Property, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


@app.put(
    "/properties/{property_id}",
    response_model=PropertyResponse,
    summary="Update property",
    description="Landowner only. Only the owner can edit their property.",
    responses={403: {"description": "Not the property owner"}, 404: {"description": "Property not found"}},
)
def update_property(
    property_id: int,
    payload: PropertyUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "landowner")
    prop = session.get(Property, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not the property owner")
    update_data = payload.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(prop, k, v)
    session.add(prop)
    session.commit()
    session.refresh(prop)
    return prop

# ---------- Subscriptions ----------
@app.post(
    "/subscriptions",
    summary="Create subscription",
    description="Hunter only. Subscribe to an area (center + radius in km) for sighting alerts.",
    status_code=201,
    responses={403: {"description": "Requires hunter role"}},
)
def create_subscription(
    payload: SubscriptionCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "hunter")
    sub = Subscription(
        hunter_user_id=user.id,
        center_lat=payload.center_lat,
        center_lng=payload.center_lng,
        radius_km=payload.radius_km,
        active=True,
    )
    session.add(sub)
    session.commit()
    session.refresh(sub)
    return sub


@app.get(
    "/subscriptions/mine",
    summary="List my subscriptions",
    description="Hunter only. List the current user's area subscriptions.",
    responses={403: {"description": "Requires hunter role"}},
)
def list_my_subscriptions(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "hunter")
    subs = session.exec(select(Subscription).where(Subscription.hunter_user_id == user.id)).all()
    return subs

# ---------- Sightings + matching ----------
def _get_or_create_default_property(session: Session, user: User, lat: float, lng: float, size_acres: float) -> Property:
    """Get landowner's first property, or create 'My Land' with given coords."""
    prop = session.exec(select(Property).where(Property.owner_user_id == user.id).limit(1)).first()
    if prop:
        return prop
    prop = Property(owner_user_id=user.id, name="My Land", lat=lat, lng=lng, size_acres=size_acres)
    session.add(prop)
    session.commit()
    session.refresh(prop)
    return prop


@app.post(
    "/sightings",
    summary="Report sighting",
    description="Landowner only. Report a pig sighting. Auto-creates default property if needed.",
    status_code=201,
    responses={403: {"description": "Property not found or not yours"}},
)
def create_sighting(
    payload: SightingCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "landowner")
    if payload.property_id is not None:
        prop = session.get(Property, payload.property_id)
        if not prop or prop.owner_user_id != user.id:
            raise HTTPException(status_code=403, detail="Property not found or not yours")
    else:
        prop = _get_or_create_default_property(session, user, payload.lat, payload.lng, payload.size_acres)

    ai = analyze_sighting(payload.notes)

    sighting = Sighting(
        property_id=prop.id,
        reported_by_user_id=user.id,
        lat=payload.lat,
        lng=payload.lng,
        seen_at=payload.seen_at,
        count_estimate=payload.count_estimate,
        notes=payload.notes,
        credibility_score=ai["credibility_score"],
        tags_csv=",".join(ai["tags"]),
        summary=ai["summary"],
    )
    session.add(sighting)
    session.commit()
    session.refresh(sighting)
    cache_invalidate("properties:")

    # Match to hunters with subscriptions within radius (these hunters get notified)
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


@app.get(
    "/sightings/mine",
    summary="List my sightings",
    description="Landowner only. Sightings the current user reported.",
)
def list_my_sightings(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(None, ge=1, le=config.MAX_PAGE_SIZE),
):
    require_role(user, "landowner")
    page_size = page_size or config.DEFAULT_PAGE_SIZE
    stmt = select(Sighting).where(Sighting.reported_by_user_id == user.id).order_by(Sighting.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    sightings = session.exec(stmt).all()
    return list(sightings)


@app.get(
    "/sightings/for-hunter",
    summary="Sightings in my area (messages)",
    description="Hunter only. Sightings within subscription radii. New sightings appear here automatically.",
)
def list_sightings_for_hunter(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(None, ge=1, le=config.MAX_PAGE_SIZE),
):
    require_role(user, "hunter")
    page_size = page_size or config.DEFAULT_PAGE_SIZE
    subs = session.exec(select(Subscription).where(Subscription.hunter_user_id == user.id, Subscription.active == True)).all()
    all_sightings = session.exec(
        select(Sighting).where(Sighting.status == "open").order_by(Sighting.created_at.desc())
    ).all()
    if not subs:
        matched = list(all_sightings)
    else:
        matched = []
        seen_ids = set()
        for s in all_sightings:
            if s.id in seen_ids:
                continue
            for sub in subs:
                if haversine_km(s.lat, s.lng, sub.center_lat, sub.center_lng) <= sub.radius_km:
                    seen_ids.add(s.id)
                    matched.append(s)
                    break
    return matched[(page - 1) * page_size : page * page_size]

@app.get(
    "/sightings/{sighting_id}",
    summary="Get sighting",
    responses={404: {"description": "Sighting not found"}},
)
def get_sighting(
    sighting_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    s = session.get(Sighting, sighting_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sighting not found")
    return s


@app.delete(
    "/sightings/{sighting_id}",
    summary="Delete sighting",
    description="Landowner only. Delete a sighting you reported. Cannot delete if it has bookings.",
    status_code=204,
    responses={403: {"description": "Not your sighting"}, 404: {"description": "Sighting not found"}, 400: {"description": "Cannot delete: has bookings"}},
)
def delete_sighting(
    sighting_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "landowner")
    s = session.get(Sighting, sighting_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sighting not found")
    if s.reported_by_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your sighting")
    matches = session.exec(select(Match).where(Match.sighting_id == sighting_id)).all()
    if matches:
        raise HTTPException(status_code=400, detail="Cannot delete sighting with existing bookings")
    for req in session.exec(select(AccessRequest).where(AccessRequest.sighting_id == sighting_id)).all():
        session.delete(req)
    session.delete(s)
    session.commit()
    return None

# ---------- Access requests ----------
@app.post(
    "/sightings/{sighting_id}/request-access",
    summary="Request access",
    description="Hunter only. Request access to a sighting (e.g. to hunt on that property).",
    status_code=201,
    responses={403: {"description": "Requires hunter role"}, 404: {"description": "Sighting not found"}},
)
def request_access(
    sighting_id: int,
    payload: RequestAccessBody,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "hunter")
    sighting = session.get(Sighting, sighting_id)
    if not sighting:
        raise HTTPException(status_code=404, detail="Sighting not found")

    req = AccessRequest(sighting_id=sighting_id, hunter_user_id=user.id, message=payload.message, status="pending")
    session.add(req)
    session.commit()
    session.refresh(req)
    return req

@app.get("/requests/incoming")
def incoming_requests(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(None, ge=1, le=config.MAX_PAGE_SIZE),
):
    require_role(user, "landowner")
    page_size = page_size or config.DEFAULT_PAGE_SIZE
    my_sightings = session.exec(select(Sighting).where(Sighting.reported_by_user_id == user.id)).all()
    my_sighting_ids = [s.id for s in my_sightings]
    if not my_sighting_ids:
        return []
    stmt = select(AccessRequest).where(AccessRequest.sighting_id.in_(my_sighting_ids)).offset((page - 1) * page_size).limit(page_size)
    reqs = session.exec(stmt).all()
    return list(reqs)

@app.post(
    "/requests/{request_id}/approve",
    summary="Approve access request",
    description="Landowner only. Approve a hunter's access request with a time window. Enforces no double booking and property capacity (max_hunters).",
    responses={400: {"description": "Time window invalid or slot full"}, 403: {"description": "Not authorized"}, 404: {"description": "Request not found"}},
)
def approve_request(
    request_id: int,
    payload: ApproveRequestBody,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "landowner")
    req = session.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    sighting = session.get(Sighting, req.sighting_id)
    prop = session.get(Property, sighting.property_id) if sighting else None
    if not sighting or not prop or prop.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    start_time = payload.start_time
    end_time = payload.end_time
    if start_time.tzinfo:
        start_time = start_time.replace(tzinfo=None)
    if end_time.tzinfo:
        end_time = end_time.replace(tzinfo=None)

    allowed, msg = can_create_booking(session, prop.id, start_time, end_time)
    if not allowed:
        raise HTTPException(status_code=400, detail=msg)

    req.status = "approved"
    sighting.status = "closed"  # Remove from hunter map once approved
    hunter = session.get(User, req.hunter_user_id)
    m = Match(
        sighting_id=sighting.id,
        property_id=prop.id,
        landowner_user_id=user.id,
        hunter_user_id=req.hunter_user_id,
        start_time=start_time,
        end_time=end_time,
        instructions=payload.instructions,
        status="confirmed",
    )
    session.add(req)
    session.add(m)
    session.commit()
    session.refresh(m)
    log_booking_created(m.id, prop.id, user.id, req.hunter_user_id, str(start_time), str(end_time))
    cache_invalidate("properties:")
    background_tasks.add_task(
        send_booking_confirmation_mock,
        m.id, hunter.email if hunter else "", prop.name, str(start_time), str(end_time),
    )
    background_tasks.add_task(log_booking_analytics, m.id, prop.id, user.id, req.hunter_user_id)
    return {"request": req, "match": m}

@app.post(
    "/requests/{request_id}/reject",
    summary="Reject access request",
    description="Landowner only. Reject a hunter's access request.",
    responses={403: {"description": "Not authorized"}, 404: {"description": "Request not found"}},
)
def reject_request(
    request_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    require_role(user, "landowner")
    req = session.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    sighting = session.get(Sighting, req.sighting_id)
    prop = session.get(Property, sighting.property_id) if sighting else None
    if not sighting or not prop or prop.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    req.status = "rejected"
    session.add(req)
    session.commit()
    return req


@app.get("/requests/mine")
def my_requests(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(None, ge=1, le=config.MAX_PAGE_SIZE),
):
    """Hunter only. List outgoing access requests (conversations with landowners)."""
    require_role(user, "hunter")
    page_size = page_size or config.DEFAULT_PAGE_SIZE
    stmt = (
        select(AccessRequest)
        .where(AccessRequest.hunter_user_id == user.id)
        .order_by(AccessRequest.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    reqs = session.exec(stmt).all()
    return list(reqs)


# ---------- Messages (chat) ----------
def _enrich_conversation(req, session: Session, user: User):
    """Build conversation dict with other_user, sighting, property for display."""
    sighting = session.get(Sighting, req.sighting_id)
    prop = session.get(Property, sighting.property_id) if sighting else None
    if user.role == "landowner":
        other = session.get(User, req.hunter_user_id)
    else:
        sighting_owner = session.get(User, sighting.reported_by_user_id) if sighting else None
        other = sighting_owner
    last_msg = (
        session.exec(
            select(Message)
            .where(Message.access_request_id == req.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        ).first()
    )
    return {
        "id": req.id,
        "access_request_id": req.id,
        "sighting_id": req.sighting_id,
        "status": req.status,
        "initial_message": req.message,
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "other_user": {"id": other.id, "name": other.name} if other else None,
        "property_name": (prop.name if prop else None) or f"Sighting #{req.sighting_id}",
        "last_message": {"body": last_msg.body, "created_at": last_msg.created_at.isoformat()} if last_msg else None,
    }


@app.get("/messages/conversations")
def list_conversations(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(None, ge=1, le=config.MAX_PAGE_SIZE),
):
    """List chat conversations. Landowners see incoming requests; hunters see their outgoing requests."""
    page_size = page_size or config.DEFAULT_PAGE_SIZE
    if user.role == "landowner":
        my_sightings = session.exec(select(Sighting).where(Sighting.reported_by_user_id == user.id)).all()
        sighting_ids = [s.id for s in my_sightings]
        if not sighting_ids:
            return []
        stmt = (
            select(AccessRequest)
            .where(AccessRequest.sighting_id.in_(sighting_ids))
            .order_by(AccessRequest.created_at.desc())
        )
    else:
        stmt = (
            select(AccessRequest)
            .where(AccessRequest.hunter_user_id == user.id)
            .order_by(AccessRequest.created_at.desc())
        )
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    reqs = session.exec(stmt).all()
    return [_enrich_conversation(r, session, user) for r in reqs]


@app.get("/messages/conversations/{request_id}")
def get_conversation(
    request_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get full thread: request + follow-up messages."""
    req = session.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Conversation not found")
    sighting = session.get(Sighting, req.sighting_id)
    prop = session.get(Property, sighting.property_id) if sighting else None
    if user.role == "landowner":
        if not sighting or sighting.reported_by_user_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        if req.hunter_user_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    other = session.get(User, req.hunter_user_id if user.role == "landowner" else sighting.reported_by_user_id)
    messages = session.exec(
        select(Message)
        .where(Message.access_request_id == request_id)
        .order_by(Message.created_at.asc())
    ).all()
    thread = []
    if req.message:
        thread.append({
            "id": "initial",
            "sender_user_id": req.hunter_user_id,
            "body": req.message,
            "created_at": req.created_at.isoformat() if req.created_at else None,
        })
    for m in messages:
        thread.append({
            "id": m.id,
            "sender_user_id": m.sender_user_id,
            "body": m.body,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })
    return {
        "conversation": _enrich_conversation(req, session, user),
        "thread": thread,
        "other_user": {"id": other.id, "name": other.name} if other else None,
    }


@app.delete(
    "/messages/conversations/{request_id}",
    status_code=204,
    summary="Delete conversation",
    description="Delete an access request and its messages. Landowner or hunter can delete their own conversations.",
)
def delete_conversation(
    request_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Delete a conversation (access request + messages). Both parties can delete."""
    req = session.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Conversation not found")
    sighting = session.get(Sighting, req.sighting_id)
    if user.role == "landowner":
        if not sighting or sighting.reported_by_user_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        if req.hunter_user_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    for msg in session.exec(select(Message).where(Message.access_request_id == request_id)).all():
        session.delete(msg)
    session.delete(req)
    session.commit()
    return None


@app.post("/messages/conversations/{request_id}")
def send_message(
    request_id: int,
    payload: SendMessageBody,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Send a message in a conversation thread."""
    req = session.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Conversation not found")
    sighting = session.get(Sighting, req.sighting_id)
    if user.role == "landowner":
        if not sighting or sighting.reported_by_user_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        if req.hunter_user_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    msg = Message(
        access_request_id=request_id,
        sender_user_id=user.id,
        body=payload.body.strip(),
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return {
        "id": msg.id,
        "sender_user_id": msg.sender_user_id,
        "body": msg.body,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


# ---------- Matches ----------
@app.get(
    "/matches/mine",
    summary="List my matches (bookings)",
    description="List bookings with pagination. Optional status filter: confirmed, cancelled, completed.",
)
def list_my_matches(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    status: Optional[str] = Query(None, description="Filter by status: confirmed, cancelled, completed"),
    page: int = Query(1, ge=1),
    page_size: int = Query(None, ge=1, le=config.MAX_PAGE_SIZE),
):
    page_size = page_size or config.DEFAULT_PAGE_SIZE
    stmt = select(Match)
    if user.role == "landowner":
        stmt = stmt.where(Match.landowner_user_id == user.id)
    else:
        stmt = stmt.where(Match.hunter_user_id == user.id)
    if status:
        stmt = stmt.where(Match.status == status)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    ms = session.exec(stmt).all()
    return list(ms)


@app.post(
    "/matches/{match_id}/cancel",
    summary="Cancel a booking",
    description="Landowner or hunter can cancel. Only confirmed, future bookings. Sets status to cancelled.",
    responses={400: {"description": "Already cancelled or in the past"}, 403: {"description": "Not participant"}, 404: {"description": "Match not found"}},
)
def cancel_match(
    match_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    m = session.get(Match, match_id)
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    if m.landowner_user_id != user.id and m.hunter_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")
    if m.status == "cancelled":
        raise HTTPException(status_code=400, detail="Booking is already cancelled")
    if m.start_time < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Cannot cancel a booking that has already started or ended")
    m.status = "cancelled"
    session.add(m)
    session.commit()
    log_booking_cancelled(m.id, user.id)
    cache_invalidate("properties:")
    return {"match": m, "message": "Booking cancelled"}


# ---------- Stats ----------
@app.get(
    "/stats/dashboard",
    summary="Dashboard stats",
    description="Counts for properties, sightings, matches (bookings), users. For investors/demos.",
)
def stats_dashboard(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    properties_count = session.exec(select(func.count(Property.id))).one()
    sightings_count = session.exec(select(func.count(Sighting.id))).one()
    matches_count = session.exec(select(func.count(Match.id)).where(Match.status == "confirmed")).one()
    users_count = session.exec(select(func.count(User.id))).one()
    return {
        "properties": properties_count,
        "sightings": sightings_count,
        "confirmed_bookings": matches_count,
        "users": users_count,
    }


@app.get(
    "/properties/popular",
    response_model=List[PropertyResponse],
    summary="Popular properties",
    description="Properties with most confirmed bookings. Cached. Optional limit.",
)
def list_popular_properties(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=50),
):
    cache_key = f"properties:popular:{limit}"
    if config.CACHE_PROPERTIES_TTL > 0:
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
    # Property IDs with most confirmed matches, then fetch full Property rows
    ids_stmt = (
        select(Match.property_id, func.count(Match.id).label("c"))
        .where(Match.status == "confirmed")
        .group_by(Match.property_id)
        .order_by(desc("c"))
        .limit(limit)
    )
    rows = list(session.exec(ids_stmt).all())
    ids = [r[0] for r in rows] if rows else []
    if not ids:
        if config.CACHE_PROPERTIES_TTL > 0:
            cache_set(cache_key, [], config.CACHE_PROPERTIES_TTL)
        return []
    # Preserve order by match count (ids is already ordered)
    props = [session.get(Property, pid) for pid in ids]
    props = [p for p in props if p is not None]
    if config.CACHE_PROPERTIES_TTL > 0:
        cache_set(cache_key, props, config.CACHE_PROPERTIES_TTL)
    return props