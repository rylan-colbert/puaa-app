"""
Pydantic request/response schemas and validators.
Validates email format, dates not in past, numbers > 0, role enum.
"""

from datetime import datetime, timezone
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    """Sign up: name, email, password, role (landowner or hunter)."""
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: Literal["landowner", "hunter"]

    class Config:
        json_schema_extra = {"example": {"name": "Jane Doe", "email": "jane@example.com", "password": "securepass123", "role": "hunter"}}


class LoginRequest(BaseModel):
    """Login with email and password."""
    email: EmailStr
    password: str = Field(..., min_length=1)

    class Config:
        json_schema_extra = {"example": {"email": "jane@example.com", "password": "securepass123"}}


class Verify2FALoginRequest(BaseModel):
    """After login returned requires_2fa: pending_token + 6-digit code."""
    pending_token: str = Field(..., min_length=1)
    code: str = Field(..., min_length=6, max_length=6)

    @field_validator("code")
    @classmethod
    def code_digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("code must be 6 digits")
        return v


class Confirm2FASetupRequest(BaseModel):
    """Enable 2FA: code from app + secret from setup."""
    code: str = Field(..., min_length=6, max_length=6)
    secret: str = Field(..., min_length=1)

    @field_validator("code")
    @classmethod
    def code_digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("code must be 6 digits")
        return v


class Disable2FARequest(BaseModel):
    """Turn off 2FA: current password."""
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    """User in API responses (no password_hash)."""
    id: int
    name: str
    email: str
    role: str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Property
# ---------------------------------------------------------------------------

class PropertyCreate(BaseModel):
    """Create property: name, lat, lng required; notes, island, daily_rate, max_hunters optional."""
    name: str = Field(..., min_length=1, max_length=200)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    notes: Optional[str] = Field(None, max_length=2000)
    island: Optional[str] = Field(None, max_length=100)
    daily_rate: Optional[float] = Field(None, gt=0, description="Optional daily rate for filtering")
    max_hunters: Optional[int] = Field(None, ge=1, le=100, description="Max concurrent hunters (booking capacity)")
    size_acres: float = Field(..., gt=0, description="Property size in acres")

    class Config:
        json_schema_extra = {"example": {"name": "North Ranch", "lat": 19.7, "lng": -155.08, "notes": "Gate code 1234", "island": "Hawaii", "max_hunters": 4, "size_acres": 40}}


class PropertyUpdate(BaseModel):
    """Partial update (owner only)."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    notes: Optional[str] = Field(None, max_length=2000)
    island: Optional[str] = Field(None, max_length=100)
    daily_rate: Optional[float] = Field(None, gt=0)
    max_hunters: Optional[int] = Field(None, ge=1, le=100)
    size_acres: Optional[float] = Field(None, gt=0)  # optional for partial update


class PropertyResponse(BaseModel):
    """Property in API responses."""
    id: int
    owner_user_id: int
    name: str
    lat: float
    lng: float
    notes: Optional[str] = None
    island: Optional[str] = None
    daily_rate: Optional[float] = None
    max_hunters: Optional[int] = None
    size_acres: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Subscription
# ---------------------------------------------------------------------------

class SubscriptionCreate(BaseModel):
    """Hunter: subscribe to an area (center + radius in km)."""
    center_lat: float = Field(..., ge=-90, le=90)
    center_lng: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(..., gt=0, le=500)

    class Config:
        json_schema_extra = {"example": {"center_lat": 19.71, "center_lng": -155.08, "radius_km": 25}}


# ---------------------------------------------------------------------------
# Sighting
# ---------------------------------------------------------------------------

class SightingCreate(BaseModel):
    """Landowner: report a sighting. lat/lng required (or property_id for legacy). seen_at can be past."""
    seen_at: datetime
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    property_id: Optional[int] = None  # Optional; backend creates default property if omitted
    count_estimate: Optional[int] = Field(None, ge=0, le=1000)
    notes: Optional[str] = Field(None, max_length=2000)
    size_acres: Optional[float] = Field(None, gt=0, description="Property size in acres (required when creating default property)")

    @model_validator(mode="after")
    def require_size_when_no_property(self):
        if self.property_id is None and (self.size_acres is None or self.size_acres <= 0):
            raise ValueError("size_acres is required when not specifying property_id")
        return self


# ---------------------------------------------------------------------------
# Access request & Match (booking)
# ---------------------------------------------------------------------------

class RequestAccessBody(BaseModel):
    """Hunter: request access to a sighting."""
    message: Optional[str] = Field(None, max_length=500)


class SendMessageBody(BaseModel):
    """Send a chat message in a conversation thread."""
    body: str = Field(..., min_length=1, max_length=2000)


class ApproveRequestBody(BaseModel):
    """Landowner: approve access with time window. Dates must be in future; end > start."""
    start_time: datetime
    end_time: datetime
    instructions: Optional[str] = Field(None, max_length=2000)

    @model_validator(mode="after")
    def validate_times(self):
        start_time = self.start_time
        end_time = self.end_time
        if not start_time or not end_time:
            return self
        now = datetime.now(timezone.utc)
        for dt in (start_time, end_time):
            d = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
            if d < now:
                raise ValueError("start_time and end_time cannot be in the past")
        st = start_time.replace(tzinfo=timezone.utc) if start_time.tzinfo is None else start_time
        et = end_time.replace(tzinfo=timezone.utc) if end_time.tzinfo is None else end_time
        if et <= st:
            raise ValueError("end_time must be after start_time")
        return self


# ---------------------------------------------------------------------------
# Query params for filtering
# ---------------------------------------------------------------------------

class PropertyFilterParams(BaseModel):
    """Query params for GET /properties (search/list)."""
    island: Optional[str] = None
    min_price: Optional[float] = Field(None, gt=0, alias="min_price")
    max_price: Optional[float] = Field(None, gt=0, alias="max_price")
    name: Optional[str] = None  # substring search
    min_lat: Optional[float] = Field(None, ge=-90, le=90)
    max_lat: Optional[float] = Field(None, ge=-90, le=90)
    min_lng: Optional[float] = Field(None, ge=-180, le=180)
    max_lng: Optional[float] = Field(None, ge=-180, le=180)

    class Config:
        populate_by_name = True


# ---------------------------------------------------------------------------
# Standard error response (for docs)
# ---------------------------------------------------------------------------

class ErrorDetail(BaseModel):
    """Consistent error response body."""
    detail: str

    class Config:
        json_schema_extra = {"example": {"detail": "Property not found"}}
