# Custom Method: Our Form + Google Sheet + Queue Number on Site

With the **custom method**, the booking page shows **our form** (not the embedded Google Form). Submissions go to **your Google Sheet** via the Sheets API, and the user sees **"You are #N in the queue for today"** right on the site after submitting.

---

## What you get

- Our styled form on the site (no embedded Google Form).
- All responses in your Google Sheet (one tab per day by default).
- **Queue number shown after submit:** e.g. "You are #3 in the queue for today."
- Bookings for today only; no advance bookings (or set `BOOKING_ALWAYS_OPEN=true` for testing).

---

## Step 1: Do NOT set the Google Form embed URL

The custom form is used only when **GOOGLE_FORM_EMBED_URL** is **not** set.

- If you deploy with env vars, **do not add** `GOOGLE_FORM_EMBED_URL`.
- If it’s in your code as default, remove it or leave it unset in production so the app uses the custom form.

---

## Step 2: Create a Google Sheet

1. Go to **[sheets.new](https://sheets.new)** (or Google Drive → New → Google Sheets).
2. Name it (e.g. **Salon Bookings**).
3. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/ 13qdo8ARaDoh2vYsn_WJYm1dduxJmOvdIB2LFkXxBBiA  /edit
   ```
   Use the part between `/d/` and `/edit`. Example: `13qdo8ARaDoh2vYsn_WJYm1dduxJmOvdIB2LFkXxBBiA`.

You don’t need to add column headers; the app adds them when it creates a tab or writes the first row.

---

## Step 3: Create a Google Cloud project and enable Sheets API

**Detailed step-by-step:** see **[GOOGLE-CLOUD-STEPS.md](GOOGLE-CLOUD-STEPS.md)** (create project, enable API, create service account, download JSON).

Short version:

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**.
2. Top bar: **Select a project** → **New Project** → name (e.g. **Salon Bookings**) → **Create**.
3. With that project selected: **APIs & Services** → **Library**.
4. Search for **Google Sheets API** → open it → **Enable**.

---

## Step 4: Create a service account and download JSON

1. **APIs & Services** → **Credentials** → **+ Create Credentials** → **Service account**.
2. Name: e.g. **salon-booking** → **Create and Continue** → **Done**.
3. Click the new service account in the table.
4. Open the **Keys** tab → **Add Key** → **Create new key** → **JSON** → **Create**.
5. A JSON file downloads. Keep it private (don’t commit to git or share).

---

## Step 5: Share the Sheet with the service account

1. Open the JSON file and find **"client_email"**. It looks like:
   `salon-booking@your-project-id.iam.gserviceaccount.com`
2. Open your **Salon Bookings** Google Sheet.
3. Click **Share**.
4. Paste that **client_email** as a new user.
5. Set permission to **Editor** → **Share** (you can uncheck “Notify” if you like).

---

## Step 6: Set environment variables and run

**On your machine (local):**

1. Put the downloaded JSON in your project folder as `credentials.json` (it’s in `.gitignore`).
2. In the terminal:

   ```bash
   export GOOGLE_SPREADSHEET_ID="13qdo8ARaDoh2vYsn_WJYm1dduxJmOvdIB2LFkXxBBiA"
   export GOOGLE_APPLICATION_CREDENTIALS="./credentials.json"
   ```

   Use your real Spreadsheet ID from Step 2.

3. (Optional) To accept bookings at any time (testing):

   ```bash
   export BOOKING_ALWAYS_OPEN="true"
   ```

4. Start the app:

   ```bash
   npm start
   ```

5. Open **http://localhost:3000** → **Book now**. You should see **our form** (not the Google Form). Submit a booking; the success message will include **"You are #1 in the queue for today"** (then #2, #3, etc.).

**On Render (or another host):**

1. Do **not** set `GOOGLE_FORM_EMBED_URL`.
2. In the dashboard, add:
   - **GOOGLE_SPREADSHEET_ID** = your Spreadsheet ID.
   - **GOOGLE_SERVICE_ACCOUNT_JSON** = the **entire** contents of the JSON key file as a **single line** (copy-paste the whole JSON, minified).
3. Optional: **BOOKING_ALWAYS_OPEN** = `true` for testing.
4. Deploy. The booking page will use the custom form and show the queue number after submit.

---

## Summary: Custom method checklist

| Step | Action |
|------|--------|
| 1 | Do **not** set `GOOGLE_FORM_EMBED_URL` (so the app uses the custom form). |
| 2 | Create a Google Sheet and copy its **Spreadsheet ID**. |
| 3 | Create a Google Cloud project and enable **Google Sheets API**. |
| 4 | Create a **service account** and download its **JSON key**. |
| 5 | **Share** the Sheet with the service account email (Editor). |
| 6 | Set **GOOGLE_SPREADSHEET_ID** and either **GOOGLE_APPLICATION_CREDENTIALS** (path to JSON) or **GOOGLE_SERVICE_ACCOUNT_JSON** (full JSON string). |
| 7 | Run `npm start` (or deploy). Book via the site; queue number appears after submit. |

---

## Optional: Email the customer their queue number

If the customer enters an **email** in the form, you can send them an email with their queue number.

1. Set **SEND_BOOKING_EMAIL=true**.
2. Set SMTP env vars (e.g. Gmail or SendGrid):
   - **SMTP_HOST** – e.g. `smtp.gmail.com`
   - **SMTP_PORT** – e.g. `587`
   - **SMTP_USER** – your sending email
   - **SMTP_PASS** – your app password (Gmail: use an [App Password](https://support.google.com/accounts/answer/185833), not your normal password)
3. Optional: **EMAIL_FROM_NAME** and **EMAIL_FROM_ADDRESS** (default: SMTP_USER).

Example (Gmail):

```bash
export SEND_BOOKING_EMAIL=true
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your@gmail.com
export SMTP_PASS=your-app-password
```

The email says: *"You are #N in the queue for today."* If the customer didn’t provide an email, no email is sent; the queue number still shows on screen.

---

## Optional env vars

| Variable | Purpose |
|----------|--------|
| **USE_DAILY_SHEETS=false** | Use one fixed tab (e.g. "Bookings") instead of one tab per day. |
| **GOOGLE_SHEET_NAME=Bookings** | Name of that fixed tab (only when `USE_DAILY_SHEETS=false`). |
| **BOOKING_ALWAYS_OPEN=true** | Accept bookings at any time (ignore 12:00 AM rule; good for testing). |
| **SEND_BOOKING_EMAIL=true** | Send customer an email with queue number (requires SMTP_* env vars and customer email). |

Once this is set up, the **custom method** is in use: our form, your Sheet, queue number on screen (and optionally by email) after each booking.
