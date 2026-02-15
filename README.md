# Pua'a Backend

FastAPI backend for Pua'a: landowners report feral pig sightings; hunters subscribe to areas and get matched when sightings fall in their radius.

## Setup

```bash
cd pig-match-backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload
```

API: **http://127.0.0.1:8000**  
Docs: **http://127.0.0.1:8000/docs**

## Seed data

```bash
python seed.py
```

Creates demo users (all password `pass`):

- **Landowner:** kimo@demo.com  
- **Hunters:** malia@demo.com, noah@demo.com  

## Sign up (register)

There is no HTML sign-up page in the backend; your app calls the API.

**Endpoint:** `POST /auth/register`

**Request body (JSON):**

| Field     | Type   | Required | Description                          |
|----------|--------|----------|--------------------------------------|
| `name`   | string | yes      | Display name                         |
| `email`  | string | yes      | Unique; used to log in              |
| `password` | string | yes    | Plain text (sent over HTTPS in production) |
| `role`   | string | yes      | `"landowner"` or `"hunter"` only     |

**Example:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "your-secure-password",
  "role": "hunter"
}
```

**Success (200):**

```json
{
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "hunter"
  },
  "token": "eyJ..."
}
```

Use the `token` in the **Authorization** header for later requests: `Authorization: Bearer <token>`.

**Errors:**

- `400` — Missing required field, or `role` not `landowner`/`hunter`, or email already registered (detail in response body).

---

## Main endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | - | Sign up (see above) |
| POST | `/auth/login` | - | Login (body: email, password) |
| POST | `/properties` | landowner | Create property (name, lat, lng, notes, island, daily_rate, max_hunters) |
| GET | `/properties` | any | List properties with filters (island, min_price, max_price, name, lat/lng bounds) |
| GET | `/properties/mine` | landowner | List my properties |
| GET | `/properties/{id}` | any | Get property by ID |
| PUT | `/properties/{id}` | landowner | Update property (owner only) |
| POST | `/subscriptions` | hunter | Create area subscription (center_lat, center_lng, radius_km) |
| GET | `/subscriptions/mine` | hunter | List my subscriptions |
| POST | `/sightings` | landowner | Report sighting (property_id, seen_at, lat, lng, count_estimate, notes) |
| GET | `/sightings/{id}` | any | Get sighting |
| POST | `/sightings/{id}/request-access` | hunter | Request access (message) |
| GET | `/requests/incoming` | landowner | Incoming access requests |
| POST | `/requests/{id}/approve` | landowner | Approve (start_time, end_time, instructions); enforces no double booking & capacity |
| POST | `/requests/{id}/reject` | landowner | Reject request |
| GET | `/matches/mine` | any | My matches (bookings) |

Use the returned `token` in the **Authorization** header: `Bearer <token>`.

**Validation:** All request bodies use Pydantic (email format, dates not in past for bookings, price > 0, role enum). **Errors** return `{"detail": "..."}` with status 400, 401, 403, 404, or 422. **Booking rules:** Approving a request creates a Match only if the property’s time slot is not double-booked and (if `max_hunters` is set) capacity is not exceeded.

## Two-factor authentication (2FA)

Login supports TOTP 2FA (e.g. Google Authenticator, Authy).

**Flow when 2FA is enabled:**

1. `POST /auth/login` with email + password → response includes `requires_2fa: true` and `pending_token` (no access token yet).
2. `POST /auth/2fa/verify-login` with `pending_token` + `code` (6-digit from app) → returns `token` and `user`.

**Enabling 2FA (user must be logged in):**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/2fa/status` | Check if 2FA is enabled |
| POST | `/auth/2fa/setup` | Start setup: returns `secret`, `uri`, and `qr_image` (base64 data URL) to scan |
| POST | `/auth/2fa/confirm-setup` | Body: `code`, `secret` — verify code and enable 2FA |
| POST | `/auth/2fa/disable` | Body: `password` — turn off 2FA |

`pending_token` expires in 5 minutes. Store the `secret` from setup only until you call confirm-setup (e.g. in memory or state); do not persist it.

## Environment & config

- Copy `.env.example` to `.env` and set `PUAA_ENV=production` and `SECRET_KEY` for production.
- **Dev vs prod:** `PUAA_ENV` controls `config.IS_PRODUCTION`; `DATABASE_URL` can point to different DBs (e.g. SQLite for dev, PostgreSQL for prod).
- Config lives in `config.py` (single `Config` class, values from env).

## Logging

Structured logging (who booked what, when property created, failed logins):

- `event=property_created`, `event=booking_created`, `event=booking_cancelled`, `event=login_failed`, `event=login_success`.
- Log level via `LOG_LEVEL` (default DEBUG in dev, INFO in prod).

## Background tasks

When a booking is created (approve request):

- Mock “confirmation email” is logged (replace with real email in production).
- Analytics event is logged for the booking.

## Caching

- Property list (`GET /properties`) and popular properties (`GET /properties/popular`) are cached in-memory when `CACHE_PROPERTIES_TTL` > 0 (default 60s). Cache is invalidated on property create/update and on booking approve/cancel.

## Booking states & cancellation

- Match (booking) has `status`: `confirmed`, `cancelled`, or `completed`.
- **POST `/matches/{match_id}/cancel`**: landowner or hunter can cancel. Only future, confirmed bookings.

## Stats & pagination

- **GET `/stats/dashboard`**: counts for properties, sightings, confirmed bookings, users.
- **GET `/properties/popular`**: properties with most confirmed bookings (cached).
- List endpoints support **pagination**: `page` (1-based) and `page_size` on `/properties`, `/properties/mine`, `/matches/mine`, `/requests/incoming`. `GET /matches/mine` also supports `status` filter.

## Database

SQLite by default: `./app.db`. Set `DATABASE_URL` in `.env` for production (e.g. PostgreSQL).
