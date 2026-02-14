from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(index=True, unique=True)
    role: str  # "landowner" or "hunter"
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Property(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_user_id: int = Field(index=True)
    name: str
    lat: float
    lng: float
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Sighting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    property_id: int = Field(index=True)
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
    id: Optional[int] = Field(default=None, primary_key=True)
    sighting_id: int = Field(index=True)
    property_id: int = Field(index=True)
    landowner_user_id: int = Field(index=True)
    hunter_user_id: int = Field(index=True)
    start_time: datetime
    end_time: datetime
    instructions: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)