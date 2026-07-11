# FileFlexer — MongoDB Backend

This folder adds a MongoDB-backed authentication API to the FileFlexer project
using **Express** + **Mongoose**. It is a self-contained addition — nothing in
the existing `fileflexer/` static frontend was changed, so all current
features (including the localStorage-based demo auth) keep working exactly as
before.

## What was added

```
backend/
├── config/
│   └── db.js              # MongoDB connection (Mongoose), reads MONGODB_URI
├── models/
│   └── User.js             # User schema: name, email, password, createdAt
├── controllers/
│   └── authController.js   # signup / login / getMe logic
├── routes/
│   └── authRoutes.js       # /api/auth/signup, /login, /me
├── middleware/
│   └── auth.js              # JWT verification middleware
├── server.js                # Express app entry point
├── package.json
└── .env.example
```

## Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env and set MONGODB_URI, JWT_SECRET, etc.
npm run dev   # or: npm start
```

The server starts on `PORT` (default `5000`) and connects to MongoDB using
`MONGODB_URI` from `.env`.

## Environment variables (`.env.example`)

| Variable         | Description                                      |
|-------------------|--------------------------------------------------|
| `MONGODB_URI`     | MongoDB connection string (Atlas or local)       |
| `JWT_SECRET`      | Secret used to sign auth tokens                  |
| `JWT_EXPIRES_IN`  | Token lifetime (default `7d`)                    |
| `PORT`            | Port for the Express server (default `5000`)     |

## API

### `POST /api/auth/signup`
Body: `{ "name": "...", "email": "...", "password": "..." }`
Creates a user in MongoDB (password hashed with bcrypt) and returns a JWT.

### `POST /api/auth/login`
Body: `{ "email": "...", "password": "..." }`
Verifies credentials against MongoDB and returns a JWT.

### `GET /api/auth/me`
Header: `Authorization: Bearer <token>`
Returns the logged-in user's profile (`id`, `name`, `email`, `createdAt`).

## Note on the existing frontend

`fileflexer/js/auth.js` currently stores demo users in the browser's
`localStorage`, per the original project design. That file was **left
untouched** so nothing breaks. This backend runs independently and gives you
a real MongoDB-backed API you can point the frontend at whenever you're ready
— e.g. by replacing the `localStorage` calls in `signup()`/`login()` in
`auth.js` with `fetch()` calls to `POST /api/auth/signup` and
`POST /api/auth/login`. Happy to wire that up too if you'd like.
