"""
Simple in-memory cache for property list and popular properties. TTL-based.
"""

import time
from typing import Any, Optional

# key -> (value, expiry_ts)
_cache: dict[str, tuple[Any, float]] = {}


def get(key: str) -> Optional[Any]:
    """Return cached value if present and not expired."""
    if key not in _cache:
        return None
    val, expiry = _cache[key]
    if time.time() > expiry:
        del _cache[key]
        return None
    return val


def set_(key: str, value: Any, ttl_seconds: int):
    """Store value with TTL."""
    _cache[key] = (value, time.time() + ttl_seconds)


def invalidate_pattern(prefix: str):
    """Remove all keys starting with prefix (e.g. 'properties:')."""
    to_del = [k for k in _cache if k.startswith(prefix)]
    for k in to_del:
        del _cache[k]
