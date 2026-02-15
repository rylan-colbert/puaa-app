# Pua'a Backend — API Guide for Frontend

This document lists **all API changes and features** so the frontend can stay in sync. Everything below is implemented in the backend.

---

## Base URL & Auth

- **Base URL:** `http://localhost:8000` (or your deployed URL)
- **Auth:** After login or register, send the token in every request:
  - **Header:** `Authorization: Bearer <token>`

---

## 1. Sign Up (Register)

**POST** `/auth/register`

**Body (JSON):**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "your-password",
  "role": "landowner"
}
```
- `role` must be `"landowner"` or `"hunter"`
- `password` min 8 characters (validated)
- `email` must be valid format (validated)

**Success (200):**
```json
{
  "user": { "id": 1, "name": "Jane Doe", "email": "jane@example.com", "role": "landowner" },
  "token": "eyJ..."
}
```

**Errors:** `400` — email already registered, or invalid role / missing fields.

---

## 2. Login (with 2FA support)

**POST** `/auth/login`

**Body:**
```json
{ "email": "jane@example.com", "password": "your-password" }
```

**If user does NOT have 2FA:**  
Response (200):
```json
{
  "token": "eyJ...",
  "user": { "id": 1, "name": "Jane Doe", "email": "jane@example.com", "role": "landowner" }
}
```

**If user HAS 2FA enabled:**  
Response (200) — no `token` yet:
```json
{
  "requires_2fa": true,
  "pending_token": "eyJ...",
  "message": "Enter the 6-digit code from your authenticator app"
}
```
→ Frontend should show a 6-digit code input, then call **POST** `/auth/2fa/verify-login` with that code.

---

## 3. Complete 2FA Login

**POST** `/auth/2fa/verify-login`

**Body:**
```json
{
  "pending_token": "<from login response>",
  "code": "123456"
}
```
- `code` = 6 digits from authenticator app

**Success (200):** Same as normal login: `{ "token": "...", "user": { ... } }`

**Errors:** `401` — invalid/expired pending token or wrong code.

---

## 4. 2FA Setup (user must be logged in)

| Method | Path | Description |
|--------|------|-------------|
| **GET** | `/auth/2fa/status` | Returns `{ "enabled": true \| false }` |
| **POST** | `/auth/2fa/setup` | Returns `{ "secret", "uri", "qr_image", "message" }`. Show QR (`qr_image` is a data URL) and have user enter first code. |
| **POST** | `/auth/2fa/confirm-setup` | Body: `{ "code": "123456", "secret": "<from setup>" }` — enables 2FA |
| **POST** | `/auth/2fa/disable` | Body: `{ "password": "current-password" }` — turns off 2FA |

---

## 5. Properties

| Method | Path | Description |
|--------|------|-------------|
| **POST** | `/properties` | Create (landowner). Body: `name`, `lat`, `lng`; optional: `notes`, `island`, `daily_rate`, `max_hunters` |
| **GET** | `/properties` | List with **filters** and **pagination**. Query params: `island`, `min_price`, `max_price`, `name` (substring), `min_lat`, `max_lat`, `min_lng`, `max_lng`, `page`, `page_size` |
| **GET** | `/properties/mine` | My properties (landowner). Query: `page`, `page_size` |
| **GET** | `/properties/{id}` | Get one property by ID |
| **PUT** | `/properties/{id}` | Update (landowner, owner only). Body: any of `name`, `lat`, `lng`, `notes`, `island`, `daily_rate`, `max_hunters` (partial OK) |
| **GET** | `/properties/popular` | Properties with most bookings. Query: `limit` (default 10) |

**Property object** includes: `id`, `owner_user_id`, `name`, `lat`, `lng`, `notes`, `island`, `daily_rate`, `max_hunters`, `created_at`.

---

## 6. Subscriptions (hunter)

| Method | Path | Description |
|--------|------|-------------|
| **POST** | `/subscriptions` | Body: `center_lat`, `center_lng`, `radius_km` |
| **GET** | `/subscriptions/mine` | List my subscriptions |

---

## 7. Sightings

| Method | Path | Description |
|--------|------|-------------|
| **POST** | `/sightings` | Report (landowner). Body: `property_id`, `seen_at` (ISO datetime); optional: `lat`, `lng`, `count_estimate`, `notes` |
| **GET** | `/sightings/{id}` | Get one sighting |

---

## 8. Access Requests & Approve (bookings)

| Method | Path | Description |
|--------|------|-------------|
| **POST** | `/sightings/{sighting_id}/request-access` | Hunter. Body: `{ "message": "optional" }` |
| **GET** | `/requests/incoming` | Landowner. Incoming requests. Query: `page`, `page_size` |
| **POST** | `/requests/{request_id}/approve` | Landowner. Body: `start_time`, `end_time` (ISO), `instructions` (optional). Creates a **booking (Match)**. Dates must be in future; end > start. Backend enforces no double-booking and property capacity. |
| **POST** | `/requests/{request_id}/reject` | Landowner. No body. |

---

## 9. Matches (Bookings)

| Method | Path | Description |
|--------|------|-------------|
| **GET** | `/matches/mine` | My bookings. Query: `status` (optional: `confirmed`, `cancelled`, `completed`), `page`, `page_size` |
| **POST** | `/matches/{match_id}/cancel` | Cancel a booking. Landowner or hunter; only **confirmed** and **future** bookings. No body. |

**Match object** includes: `id`, `sighting_id`, `property_id`, `landowner_user_id`, `hunter_user_id`, `start_time`, `end_time`, `instructions`, **`status`** (`confirmed` | `cancelled` | `completed`), `created_at`.

---

## 10. Stats (for dashboard / investors)

**GET** `/stats/dashboard`

**Response (200):**
```json
{
  "properties": 12,
  "sightings": 45,
  "confirmed_bookings": 8,
  "users": 20
}
```
Requires auth.

---

## 11. Pagination (all list endpoints)

These endpoints support **`page`** (1-based) and **`page_size`**:

- `GET /properties` — `page`, `page_size`
- `GET /properties/mine` — `page`, `page_size`
- `GET /matches/mine` — `page`, `page_size`, optional `status`
- `GET /requests/incoming` — `page`, `page_size`

Default `page_size` is 20; max is 100 (configurable on backend).

---

## 12. Error responses

All errors return JSON:

```json
{ "detail": "Human-readable message" }
```

**Status codes:**
- `400` — Bad request (validation, business rule, e.g. email already registered, slot full)
- `401` — Unauthorized (missing/invalid token, wrong password, 2FA failure)
- `403` — Forbidden (wrong role, not owner)
- `404` — Not found (property, sighting, request, match)
- `422` — Validation error (invalid body or query params)

---

## 13. Validation rules (frontend can mirror)

- **Register:** name 1–200 chars, email valid, password 8+ chars, role = landowner | hunter
- **Property:** lat -90..90, lng -180..180; daily_rate > 0; max_hunters 1..100
- **Subscription:** radius_km 0–500
- **Approve request:** start_time and end_time in the future; end_time > start_time
- **2FA code:** exactly 6 digits

---

## 14. Map-related data

- **Properties:** `GET /properties` (or `/properties?min_lat=...&max_lat=...&min_lng=...&max_lng=...`) returns `lat`, `lng`, `name`, `island` for each.
- **Subscriptions:** `GET /subscriptions/mine` returns `center_lat`, `center_lng`, `radius_km` for drawing circles.
- **Sightings:** Each has `lat`, `lng`; get by ID with `GET /sightings/{id}`.

---

## Quick checklist for frontend

- [ ] Use `Authorization: Bearer <token>` on all requests after login/register
- [ ] Handle login response: if `requires_2fa` is true, show 6-digit input and call `/auth/2fa/verify-login`
- [ ] 2FA setup flow: call setup → show QR → user enters code → call confirm-setup with code + secret
- [ ] Add pagination (`page`, `page_size`) to any list views (properties, my properties, matches, incoming requests)
- [ ] Add filters on property list: island, price range, name search, map bounds (min/max lat/lng)
- [ ] Property create/update: support optional `island`, `daily_rate`, `max_hunters`
- [ ] Match (booking) list: support optional `status` filter; show `status` on each booking
- [ ] Add “Cancel booking” using `POST /matches/{id}/cancel` (only for confirmed, future bookings)
- [ ] Add dashboard/stats view using `GET /stats/dashboard`
- [ ] Optional: “Popular properties” using `GET /properties/popular?limit=10`
- [ ] Display errors from `{ "detail": "..." }` for 4xx/422 responses

If you need more detail on any endpoint, the backend serves **OpenAPI docs** at `GET /docs` (Swagger UI) when the server is running.
