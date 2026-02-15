import math
from typing import List, Dict

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Earth radius in km
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def analyze_sighting(notes: str | None) -> Dict:
    """
    Hackathon 'AI' stub. Replace with LLM call later.
    Returns: {credibility_score, tags, summary}
    """
    text = (notes or "").lower()

    tags = []
    score = 0.5

    if any(w in text for w in ["fresh", "just now", "right now", "minutes"]):
        tags.append("fresh")
        score += 0.15
    if any(w in text for w in ["herd", "group", "many", "8", "10", "dozen"]):
        tags.append("multiple_pigs")
        score += 0.10
    if any(w in text for w in ["damage", "rooting", "destroyed", "torn up"]):
        tags.append("property_damage")
        score += 0.10
    if any(w in text for w in ["maybe", "not sure", "think", "guess"]):
        tags.append("uncertain")
        score -= 0.15

    score = max(0.0, min(1.0, score))
    summary = (notes or "Pig sighting reported.")[:160]

    return {"credibility_score": score, "tags": tags, "summary": summary}