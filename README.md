# PigMatch

A platform connecting private landowners with nearby hunters to safely and legally manage invasive wild pig populations.

## Setup

```bash
npm install
npm run dev
```

## Structure

- **Landing** (`/`) — Hero, value prop, sign-in links for Hunter and Landowner
- **Sign in** (`/signin`) — Role selection
- **Hunter sign in** (`/hunter/signin`) — Email, password, hunting license fields
- **Landowner sign in** (`/landowner/signin`) — Name, email, phone, password
- **Hunter dashboard** (`/hunter/dashboard`) — Protected; map with pins (coming next)
- **Landowner dashboard** (`/landowner/dashboard`) — Protected; property form (coming next)

Auth is stored in `localStorage` for demo purposes. No backend yet.
