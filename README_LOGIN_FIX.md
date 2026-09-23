# NTG Admin Login Fix

This version fixes the admin authentication flow for Render:
- Adds `/api/admin/status` for configuration/session diagnostics.
- Uses a signed stateless session cookie instead of an in-memory Map.
- Verifies the session before showing the dashboard.
- Uses `credentials: 'same-origin'` for admin API requests.
- Trims the Render `ADMIN_PASSWORD` value and entered password.

Render environment variables:
- `ADMIN_PASSWORD` = your admin password
- `SESSION_SECRET` = a long random secret (recommended; if omitted, ADMIN_PASSWORD is used as the signing secret)

Do not commit real passwords or secrets to GitHub.
