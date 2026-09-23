# NTG Admin Panel – Setup

## Admin URL
`https://YOUR-DOMAIN.onrender.com/admin.html`

## 1. Render Environment Variables
In Render → your Web Service → Environment add:

- `ADMIN_PASSWORD` = a strong private password
- `NODE_ENV` = `production`
- `DATABASE_URL` = your PostgreSQL Internal Database URL (recommended)

If `DATABASE_URL` is not set, the app falls back to `data/db.json`. On Render, the local filesystem is not a permanent database, so PostgreSQL is strongly recommended.

## 2. Features
- Admin login/logout
- Add, edit and delete tour packages
- Booking list, status update and delete
- Total visits
- Unique visitors (cookie-based)
- Today's visits
- 7-day visits
- PostgreSQL persistence when `DATABASE_URL` is configured

## 3. Deploy
Push all changed files to GitHub and redeploy the Render service.
