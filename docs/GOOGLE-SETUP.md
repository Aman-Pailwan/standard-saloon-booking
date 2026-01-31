# How to Create Google Form + Sheet for Salon Bookings

**Want our styling and values mapped to the sheet?** Use **Option B** (custom form + Sheets API). Do **not** set `GOOGLE_FORM_EMBED_URL`; set up a Google Sheet and service account instead. The custom form uses our Walmart-style UI and each field maps directly to a column in your sheet.

Two options: **Option A** uses only a Form + Sheet (no credentials, but you can’t style the form or map from our app). **Option B** uses the custom form on the site (our styling, full mapping to sheet) and needs a service account.

---

## Option A: Google Form + Sheet (easiest – no credentials)

Your site will **embed** this form. Responses go straight to the linked Sheet. You only give the app the **form embed URL**.

### Step 1: Create the Google Form

1. Go to **[forms.google.com](https://forms.google.com)** and sign in.
2. Click **Blank** (or **+** to start from scratch).
3. Set the title: e.g. **Standard Saloon – Book Appointment**.
4. Add questions (recommended for salon booking):

   | Question | Type | Required |
   |----------|------|----------|
   | Appointment date | Date | ✓ |
   | Preferred time | Time (or Short answer) | ✓ |
   | Your name | Short answer | ✓ |
   | Phone | Short answer | ✓ |
   | Email | Short answer | No |
   | Service | Multiple choice or Dropdown | ✓ |
   | Notes | Paragraph | No |

   **Service** options you can add:
   - Haircut  
   - Beard trim  
   - Haircut & beard  
   - Hot towel shave  
   - Hair colour  
   - Other  

5. (Optional) In **Settings** (gear icon): collect email, limit to 1 response, etc.

### Step 2: Link the Form to a Google Sheet

1. In the form, open the **Responses** tab.
2. Click **Link to Sheets** (or the green Sheets icon).
3. Choose **Create a new spreadsheet** (or **Select existing spreadsheet**).
4. Give it a name, e.g. **Salon Bookings**.
5. Responses will now appear as rows in this Sheet – same as any Form + Sheet.

### Step 3: Get the embed URL (the only “cred” you need)

**In short:** Open your form → click **Send** (top right) → click the **<>** icon → copy the long web address that appears inside the code (the one that ends with `?embedded=true`). That is your embed URL.

The **embed URL** is the web address of your form in a format that works inside our booking page. Here are two ways to get it.

---

**Method 1: From the Send / Embed dialog**

1. Open your Google Form in the editor (the page where you add questions).
2. In the **top-right corner**, click the purple **Send** button.
3. A popup appears with three options at the top: **Email**, **Link**, **<>** (angle brackets).
4. Click the **<>** icon (it means “embed” or “HTML”).
5. You will see a block of code that starts with `<iframe` and has something like:
   ```html
   <iframe src="https://docs.google.com/forms/d/e/1FAIpQLSe.../viewform?embedded=true" ...>
   ```
6. Find the part that says **`src="..."`**. The text inside the quotes is your embed URL.
7. **Copy that full URL** (it should end with `?embedded=true`).  
   Example:  
   `https://docs.google.com/forms/d/e/1FAIpQLSeXXXXXXXX/viewform?embedded=true`

---

**Method 2: From the form’s normal link**

1. Open your Google Form in the editor.
2. Look at the **address bar** of your browser. The URL might look like:
   ```
   https://docs.google.com/forms/d/1ABC123xyz/edit
   ```
   or:
   ```
   https://docs.google.com/forms/d/e/1FAIpQLSeXXXXXXXX/viewform
   ```
3. To get the **embed URL**:
   - If your URL already has **`/e/`** in it (e.g. `.../d/e/1FAIpQL.../viewform`), add **`?embedded=true`** at the end.  
     Example:  
     `https://docs.google.com/forms/d/e/1FAIpQLSeXXXXXXXX/viewform?embedded=true`
   - If your URL has **`/d/1ABC.../edit`**, you must use Method 1 (Send → <>) to get the correct `/e/...` embed URL; the `/edit` link is not the embed URL.
4. The final embed URL must **end with** `?embedded=true`.

### Step 4: Give this to the app (no secrets)

Set this in your environment (or in a `.env` file – do **not** commit `.env`):

```bash
GOOGLE_FORM_EMBED_URL="https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform?embedded=true"
```

Replace with your actual embed URL. Then run:

```bash
npm start
```

Open the site → **Book now**. The booking page will show your form; submissions go to your linked Sheet. **You do not need to give any other credentials** for this option.

---

## Option B: Custom form on site + Google Sheets API

Use this if you want **our styling** and **values mapped to the sheet**. The form on the site is fully styled (Walmart theme) and each field maps to a column in your Google Sheet.

**Form field → Sheet column mapping:**

| Form field           | Sheet column     |
|----------------------|------------------|
| Appointment date     | Date             |
| Preferred time       | Time             |
| Full name             | Customer Name    |
| Phone number          | Phone           |
| Email address         | Email           |
| Primary service       | Service         |
| How did you hear about us? | How did you hear |
| Special requests/notes | Notes          |
| _(set on submit)_     | Booked At        |

### Step 1: Create a Google Sheet (for responses)

1. Go to **[sheets.new](https://sheets.new)** (or Drive → New → Google Sheets).
2. Name it, e.g. **Salon Bookings**.
3. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/ 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms  /edit
   ```
   The part between `/d/` and `/edit` is the ID. Copy that.

You’ll use: **Spreadsheet ID** in the app. The app will create one tab per day (e.g. `2025-02-01`) or use a single tab if you set `USE_DAILY_SHEETS=false`.

### Step 2: Create a Google Cloud project and enable Sheets API

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**.
2. Top bar: click the project dropdown → **New Project** → name it (e.g. **Salon Bookings**) → **Create**.
3. Make sure that project is selected.
4. Menu: **APIs & Services** → **Library**.
5. Search for **Google Sheets API** → open it → **Enable**.

### Step 3: Create a service account and download credentials

1. **APIs & Services** → **Credentials** → **+ Create Credentials** → **Service account**.
2. Name: e.g. **salon-booking** → **Create and Continue** → **Done**.
3. In the table, click the new service account.
4. Open the **Keys** tab → **Add Key** → **Create new key** → **JSON** → **Create**.  
   A JSON file will download. **Keep this file private** (do not commit to git or share in chat).

### Step 4: Share the Sheet with the service account

1. Open the JSON file. Find the field **"client_email"**. It looks like:
   `something@your-project-id.iam.gserviceaccount.com`
2. Open your **Salon Bookings** Google Sheet.
3. Click **Share**.
4. Paste that **client_email** as the new user.
5. Set permission to **Editor** → uncheck “Notify” if you like → **Share**.

### Step 5: Give the app the credentials (locally only)

You give the app access in one of two ways. **Do not paste the full JSON into chat or commit it to git.**

**Option 5a – Credentials file (recommended on your machine)**

1. Move the downloaded JSON to your project folder, e.g. `credentials.json`.
2. Ensure `credentials.json` is in `.gitignore` (it already is in this project).
3. Set:

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="./credentials.json"
   export GOOGLE_SPREADSHEET_ID="YOUR_SPREADSHEET_ID"
   ```

   Use the **Spreadsheet ID** from Step 1.

**Option 5b – JSON in env (e.g. for hosting)**

1. Put the **entire** contents of the JSON file into a **single line** (no newlines).
2. Set:

   ```bash
   export GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...", ...}'
   export GOOGLE_SPREADSHEET_ID="YOUR_SPREADSHEET_ID"
   ```

**Testing (optional):**

```bash
export BOOKING_ALWAYS_OPEN="true"
```

Then run:

```bash
npm start
```

---

## What to “give” the app (summary)

| What you create | What you give the app | Where |
|-----------------|------------------------|--------|
| **Option A** | Form embed URL | `GOOGLE_FORM_EMBED_URL` in env |
| **Option B** | Spreadsheet ID | `GOOGLE_SPREADSHEET_ID` in env |
| **Option B** | Service account key | `GOOGLE_APPLICATION_CREDENTIALS` (path to JSON file) **or** `GOOGLE_SERVICE_ACCOUNT_JSON` (full JSON string) |

**Do not share with anyone (including in chat):**

- The full contents of the service account JSON file.
- Any file that contains private keys.

You only need to **set env vars** in your own environment or hosting dashboard; you don’t need to “give” the actual key contents to a third party.
