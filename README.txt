NTG Travel Website — Production-ready starter

RUN LOCALLY
1. Install Node.js 18+.
2. Open this folder in terminal.
3. Set an admin password:
   Linux/macOS: export ADMIN_PASSWORD="your-strong-password"
   Windows PowerShell: $env:ADMIN_PASSWORD="your-strong-password"
4. Run: npm start
5. Open: http://localhost:3000
6. Admin: http://localhost:3000/admin.html

DEPLOY
Deploy this folder to any Node.js host (Render, Railway, Fly.io, VPS, etc.).
Start command: npm start
Set environment variable ADMIN_PASSWORD to a strong secret.

DATA
Bookings and tours are stored in (server creates the database automatically). For a multi-instance production deployment, replace this JSON store with PostgreSQL/Supabase or another managed database. Keep backups and use persistent storage on hosts with ephemeral filesystems.

SECURITY
- Admin password is server-side and never shipped to the browser.
- Login uses an HttpOnly SameSite cookie.
- Do not deploy with the default CHANGE_ME_BEFORE_DEPLOYMENT password.
- Use HTTPS in production.
