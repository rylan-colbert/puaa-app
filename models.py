from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    pass  # Avoid circular import; relationships are optional for API


class User(SQLModel, table=True):
    """User: landowner or hunter. Owns properties (landowner) or subscriptions/matches (hunter)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(index=True, unique=True)
    role: str  # "landowner" or "hunter"
    password_hash: str
    totp_secret: Optional[str] = None  # base32 secret for 2FA (TOTP)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    properties: List["Property"] = Relationship(back_populates="owner")


class Property(SQLModel, table=True):
    """Property: owned by a landowner. Has sightings and matches (bookings)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_user_id: int = Field(index=True, foreign_key="user.id")
    name: str
    lat: float
    lng: float
    notes: Optional[str] = None
    island: Optional[str] = None
    daily_rate: Optional[float] = None  # Optional; for filtering
    max_hunters: Optional[int] = None   # Max concurrent hunters (booking capacity)
    size_acres: Optional[float] = None  # Property size in acres
    created_at: datetime = Field(default_factory=datetime.utcnow)

    owner: Optional[User] = Relationship(back_populates="properties")
    sightings: List["Sighting"] = Relationship(back_populates="property")
    matches: List["Match"] = Relationship(back_populates="property")

class Sighting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    property_id: int = Field(index=True, foreign_key="property.id")
    reported_by_user_id: int = Field(index=True)
    lat: float
    lng: float
    seen_at: datetime
    count_estimate: Optional[int] = None
    notes: Optional[str] = None
    status: str = "open"  # open/closed
    # AI-ish fields (stubbed)
    credibility_score: float = 0.5
    tags_csv: str = ""      # store tags as comma-separated string
    summary: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)

    property: Optional["Property"] = Relationship(back_populates="sightings")

class Subscription(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hunter_user_id: int = Field(index=True)
    center_lat: float
    center_lng: float
    radius_km: float
    active: bool = True

class AccessRequest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sighting_id: int = Field(index=True)
    hunter_user_id: int = Field(index=True)
    message: Optional[str] = None
    status: str = "pending"  # pending/approved/rejected/cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Match(SQLModel, table=True):
    """Booking: landowner approved hunter access for a time window on a property."""
    id: Optional[int] = Field(default=None, primary_key=True)
    sighting_id: int = Field(index=True, foreign_key="sighting.id")
    property_id: int = Field(index=True, foreign_key="property.id")
    landowner_user_id: int = Field(index=True, foreign_key="user.id")
    hunter_user_id: int = Field(index=True, foreign_key="user.id")
    start_time: datetime
    end_time: datetime
    instructions: Optional[str] = None
    status: str = "confirmed"  # confirmed | cancelled | completed
    created_at: datetime = Field(default_factory=datetime.utcnow)

    property: Optional["Property"] = Relationship(back_populates="matches")


class Message(SQLModel, table=True):
    """Chat message within an access request thread (hunter <-> landowner)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    access_request_id: int = Field(index=True, foreign_key="accessrequest.id")
    sender_user_id: int = Field(index=True)
    body: str = Field(max_length=2000)
    created_at: datetime = Field(default_factory=datetime.utcnow)