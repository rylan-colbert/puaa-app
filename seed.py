from datetime import datetime
from sqlmodel import Session
from db import engine, create_db_and_tables
from models import User, Property, Sighting, Subscription
from auth import hash_password

def run():
    create_db_and_tables()
    with Session(engine) as session:
        # Landowner
        lo = User(
            name="Kimo",
            email="kimo@demo.com",
            role="landowner",
            password_hash=hash_password("pass")) 
        session.add(lo)
        session.commit()
        session.refresh(lo)

        prop = Property(owner_user_id=lo.id, name="Orchard Lot", lat=19.707, lng=-155.080, notes="Gate by the big mango tree", size_acres=40)
        session.add(prop)
        session.commit()
        session.refresh(prop)

        sighting = Sighting(property_id=prop.id, reported_by_user_id=lo.id, lat=19.707, lng=-155.080, seen_at=datetime.utcnow(), notes="Saw 3 pigs near the north fence")
        session.add(sighting)

        # Hunters
        h1 = User(name="Malia", email="malia@demo.com", role="hunter", password_hash=hash_password("pass"))
        h2 = User(name="Noah", email="noah@demo.com", role="hunter", password_hash=hash_password("pass"))
        session.add(h1)
        session.add(h2)
        session.commit()
        session.refresh(h1)
        session.refresh(h2)

        # Subscriptions near Hilo-ish (example) - cover Orchard Lot area
        s1 = Subscription(hunter_user_id=h1.id, center_lat=19.71, center_lng=-155.08, radius_km=50, active=True)
        s2 = Subscription(hunter_user_id=h2.id, center_lat=19.71, center_lng=-155.08, radius_km=50, active=True)
        session.add(s1)
        session.add(s2)
        session.commit()

    print("Seed complete. Users: kimo@demo.com / pass, malia@demo.com / pass, noah@demo.com / pass")

if __name__ == "__main__":
    run()
