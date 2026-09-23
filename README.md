# NTG Travel Website

## Phone-only deployment (GitHub + Render)

1. Create a GitHub account and a new repository named `ntg-travel-website`.
2. Upload **all files inside this folder** to the repository root (do not upload this ZIP as a single file).
3. In Render, choose **New → Web Service**, connect the GitHub repository.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add Environment Variable: `ADMIN_PASSWORD` = your own strong password.
7. Add `NODE_ENV=production`.
8. Deploy.

## URLs
- Website: `/`
- Admin: `/admin.html`

## Important data note
The current starter stores tours and bookings in `(server creates the database automatically)`. On hosts with ephemeral disks, data can be lost after redeploy/restart. For a permanent production database, migrate this store to PostgreSQL/Supabase or another managed database.
