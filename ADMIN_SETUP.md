# NTG Admin Panel Setup

## 1) Set the password on Render
Open your Render service -> Environment.
Add:
- Key: ADMIN_PASSWORD
- Value: your strong password
Then save and redeploy.

## 2) Open the admin panel
https://YOUR-DOMAIN.onrender.com/admin.html

Log in with the same ADMIN_PASSWORD.

## 3) Change a package
Admin -> Tours -> edit the package -> change name/date/duration/price/image/description -> "পরিবর্তন সংরক্ষণ".

## 4) Add a package
Admin -> Tours -> "নতুন Tour যোগ করুন" -> fill the fields -> "Tour যোগ করুন".

## 5) Manage bookings
Admin -> Bookings -> change status or delete a booking.

IMPORTANT
The current server stores tours/bookings in data/db.json. Render Free web services use ephemeral local storage, so data can be lost after certain restarts/redeploys. For permanent production data, use PostgreSQL/Supabase or a persistent disk.
