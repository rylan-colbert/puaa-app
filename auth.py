from datetime import datetime, timedelta
from typing import Optional
import pyotp
from jose import jwt, JWTError
from passlib.context import CryptContext

# ------------------------------------------------------------------
# Config (use .env via config when available)
# ------------------------------------------------------------------

try:
    from config import config as _config
    SECRET_KEY = _config.SECRET_KEY
    ACCESS_TOKEN_EXPIRE_HOURS = _config.ACCESS_TOKEN_EXPIRE_HOURS
except ImportError:
    SECRET_KEY = "dev-secret-change-me"
    ACCESS_TOKEN_EXPIRE_HOURS = 24

ALGORITHM = "HS256"
PENDING_2FA_TOKEN_EXPIRE_MINUTES = 5
JWT_TYPE_ACCESS = "access"
JWT_TYPE_PENDING_2FA = "pending_2fa"
TOTP_ISSUER = "Pua'a"

# IMPORTANT:
# Using pbkdf2_sha256 instead of bcrypt because bcrypt has
# compatibility issues with Python 3.13 environments.
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto"
)

# ------------------------------------------------------------------
# Password hashing
# ------------------------------------------------------------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


# ------------------------------------------------------------------
# JWT token helpers
# ------------------------------------------------------------------

def create_access_token(subject: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode = {
        "sub": subject,
        "type": JWT_TYPE_ACCESS,
        "exp": expire
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    """Decode access token; returns user_id (sub) or None. Rejects pending_2fa tokens."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") not in (None, JWT_TYPE_ACCESS):
            return None
        return payload.get("sub")
    except JWTError:
        return None


# ------------------------------------------------------------------
# 2FA (TOTP) helpers
# ------------------------------------------------------------------

def create_totp_secret() -> str:
    """Generate a new base32 TOTP secret for the user's authenticator app."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    """Provisioning URI for QR code / manual entry in authenticator app."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=TOTP_ISSUER)


def verify_totp(secret: str, code: str) -> bool:
    """Verify a 6-digit TOTP code (current or previous window for clock skew)."""
    if not secret or not code or len(code) != 6:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


def create_pending_2fa_token(user_id: int) -> str:
    """Short-lived token used after password check when 2FA is required. Not a full access token."""
    expire = datetime.utcnow() + timedelta(minutes=PENDING_2FA_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": str(user_id),
        "type": JWT_TYPE_PENDING_2FA,
        "exp": expire
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_pending_2fa_token(token: str) -> Optional[str]:
    """Decode pending_2fa token; returns user_id (sub) or None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != JWT_TYPE_PENDING_2FA:
            return None
        return payload.get("sub")
    except JWTError:
        return None
