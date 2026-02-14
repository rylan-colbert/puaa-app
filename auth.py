from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext

# ------------------------------------------------------------------
# Config
# ------------------------------------------------------------------

SECRET_KEY = "dev-secret-change-me"  # change later for production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

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
        "exp": expire
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
