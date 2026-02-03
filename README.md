# Standard Saloon – Appointment Website

A salon booking site with a **Walmart-inspired** UI. You can use it **the same way as Google Form + Sheets**: embed a Google Form so responses go straight into a linked Google Sheet (no API keys). Or use the built-in form with the Sheets API.

## Features

- **Landing page** – Hero, features, and “Book now” button
- **Booking page** (`/book`) – Either **embedded Google Form** (Form → Sheet) or custom form
- **Google Form + Sheets** – Create a Form, link to a Sheet; responses go to the Sheet like normal
- **12:00 AM rule** – (Custom form only) Submissions accepted from 12:00 AM (midnight) daily; with Google Form you control when the form is open
- **Daily sheet tabs** – (Custom form + API) One new tab per day in the same spreadsheet (tab name = `YYYY-MM-DD`)
- **Email queue number** – (Custom form) Optionally email the customer their queue number; see [docs/EMAIL-QUEUE-NUMBER.md](docs/EMAIL-QUEUE-NUMBER.md)
- **Testing** – Set `BOOKING_ALWAYS_OPEN=true` to keep bookings open at any time

## Setup

**Simplest (embedded form):** Your Google Form is already set as default. Just run:

```bash
npm install
npm start
```

Then open **http://localhost:3000** → **Book now**. Responses go to the Sheet linked to your form.

**Step-by-step Google Form + Sheet setup:** see **[docs/GOOGLE-SETUP.md](docs/GOOGLE-SETUP.md)**.

**Custom method (our form + queue number on site):** see **[docs/CUSTOM-METHOD-SETUP.md](docs/CUSTOM-METHOD-SETUP.md)**.  
**Step-by-step: create Google Cloud project + service account:** see **[docs/GOOGLE-CLOUD-STEPS.md](docs/GOOGLE-CLOUD-STEPS.md)**.

**How to host online:** see **[docs/HOSTING.md](docs/HOSTING.md)** (Render, Railway, Fly.io).

### 1. Install dependencies

```bash
npm install
```

### Option A: Google Form + Sheets (same as Form with Sheets)

No API keys or service account. Responses go to your Sheet via Google’s built-in link.

1. **Create a Google Form**
   - Go to [forms.google.com](https://forms.google.com) → Blank
   - Add questions (e.g. Date, Time, Name, Phone, Email, Service, Notes)

2. **Link the form to a Google Sheet**
   - In the form: **Responses** → **Link to Sheets** → **Create a new spreadsheet** (or choose existing)
   - Responses will appear as rows in that sheet, same as any Form + Sheet

3. **Get the embed URL**
   - In the form: **Send** (top right) → **<>** (embed) → copy the `src` URL  
   - It looks like: `https://docs.google.com/forms/d/e/XXXX/viewform?embedded=true`

4. **Set the env var and run**

   ```bash
   export GOOGLE_FORM_EMBED_URL="https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform?embedded=true"
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000) → **Book now**. The booking page will show your embedded form; submissions go to your linked Sheet.

---

### Option B: Custom form + Google Sheets API

1. **Create a Google Cloud project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - New project (e.g. “Salon Bookings”)

2. **Enable Google Sheets API**
   - APIs & Services → Library → search “Google Sheets API” → Enable

3. **Create a service account**
   - APIs & Services → Credentials → Create Credentials → Service Account
   - Name it (e.g. “salon-booking”), finish
   - Open the service account → Keys → Add Key → Create new key → JSON → save the file

4. **Create a Google Sheet**
   - [sheets.new](https://sheets.new) or Google Drive → New → Google Sheets
   - Name it (e.g. “Salon Bookings”)
   - Copy the **Spreadsheet ID** from the URL:  
     `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`  
     Use the part after `/d/` and before `/edit`.

5. **Share the sheet with the service account**
   - In the sheet: Share → add the **service account email** (e.g. `xxx@project-id.iam.gserviceaccount.com`) as **Editor**

6. **Set environment variables**

   **Option A – Credentials file**

   - Save the JSON key file somewhere (e.g. `./credentials.json` – add to `.gitignore`).
   - Set:

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="./credentials.json"
   export GOOGLE_SPREADSHEET_ID="your-spreadsheet-id"
   ```

   **Option B – JSON in env (e.g. hosting)**

   - Put the **entire** JSON key content in one line and set:

   ```bash
   export GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
   export GOOGLE_SPREADSHEET_ID="your-spreadsheet-id"
   ```

   **Daily tab per day** (default): A new sheet tab is created each day (e.g. `2025-02-01`, `2025-02-02`). To use a single fixed tab instead, set:

   ```bash
   export USE_DAILY_SHEETS="false"
   export GOOGLE_SHEET_NAME="Bookings"
   ```

   **Testing – keep booking open:** Accept bookings at any time (ignore 12:00 AM rule):

   ```bash
   export BOOKING_ALWAYS_OPEN="true"
   ```

### 3. Run the server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000). Use “Book now” for the booking form.

## Pages

- **`/`** – Landing (hero, features, “Book appointment”)
- **`/book`** – If `GOOGLE_FORM_EMBED_URL` is set: embedded Google Form. **To show our styled form instead**, do **not** set `GOOGLE_FORM_EMBED_URL`; use `GOOGLE_SPREADSHEET_ID` + credentials so submissions save to your sheet.

## Google Sheet columns

The app writes one row per booking. By default it creates a **new tab per day** (e.g. `2025-02-01`, `2025-02-02`) in the same spreadsheet; headers are added when a tab is created.

| Date | Time | Customer Name | Phone | Email | Service | Notes | Booked At |

## Port

Default: **3000**. Override:

```bash
PORT=8080 npm start
```

## Tech

- **Backend:** Node.js, Express
- **Sheets:** Google Sheets API (googleapis)
- **Frontend:** HTML, CSS, JS (Walmart-style theme)
# standard-saloon-booking