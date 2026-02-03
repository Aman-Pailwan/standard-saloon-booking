# Step-by-step: Create Google Cloud project + Sheets API + service account

Follow these steps to get the credentials needed for the **custom method** (our form + Google Sheet + queue number on site).

---

## Step 1: Open Google Cloud Console

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**.
2. Sign in with your Google account.

---

## Step 2: Create a new project

1. At the **top left**, click the **project dropdown** (it may say "Select a project" or show your current project name).
2. In the popup, click **"New Project"** (top right of the dialog).
3. **Project name:** e.g. `Salon Bookings` (any name is fine).
4. **Location:** leave as "No organization" if you don’t have one.
5. Click **"Create"**.
6. Wait a few seconds. Then use the **project dropdown** again and **select** the new project (e.g. "Salon Bookings") so it’s the active project.

---

## Step 3: Enable Google Sheets API

1. In the **left sidebar**, click **"APIs & Services"** → **"Library"**  
   (or open the **☰** menu → **APIs & Services** → **Library**).
2. In the **search box**, type **Google Sheets API**.
3. Click **"Google Sheets API"** in the results.
4. On the API page, click **"Enable"**.
5. When it’s enabled, you’ll see "API enabled". You can go back to the console (e.g. **APIs & Services** → **Dashboard** or **Credentials**).

---

## Step 4: Create a service account

1. In the **left sidebar**, click **"APIs & Services"** → **"Credentials"**  
   (or **☰** → **APIs & Services** → **Credentials**).
2. Near the top, click **"+ Create Credentials"**.
3. In the menu, click **"Service account"**.
4. **Service account details:**
   - **Service account name:** e.g. `salon-booking` (any name).
   - **Service account ID:** will fill in automatically (e.g. `salon-booking`).
   - **Description (optional):** e.g. "For salon booking app".
5. Click **"Create and Continue"**.
6. **Grant access (optional):** you can skip this. Click **"Continue"**.
7. **Grant users access (optional):** skip. Click **"Done"**.

You’ll be back on the Credentials page and see your new service account in the list.

---

## Step 5: Create a key (JSON) for the service account

1. In **Credentials**, under **"Service Accounts"**, find the service account you just created (e.g. `salon-booking@...`).
2. **Click on its email/name** to open it.
3. Open the **"Keys"** tab at the top.
4. Click **"Add Key"** → **"Create new key"**.
5. Choose **"JSON"**.
6. Click **"Create"**.
7. A JSON file will **download** (e.g. `salon-bookings-xxxxx.json`).  
   **Keep this file private.** Do not commit it to git or share it. You’ll use it in the app as credentials.

---

## Step 6: Get the service account email

1. Open the **downloaded JSON file** in a text editor.
2. Find the line **"client_email"**. It looks like:
   ```text
   "client_email": "salon-booking@salon-bookings-123456.iam.gserviceaccount.com"
   ```
3. **Copy that email** (the part in quotes, without the quotes). You’ll paste it when sharing the Google Sheet.

---

## Step 7: Create a Google Sheet (if you don’t have one)

1. Go to **[sheets.new](https://sheets.new)** (or Google Drive → New → Google Sheets).
2. Name the sheet (e.g. **Salon Bookings**).
3. In the browser URL, copy the **Spreadsheet ID**:
   - URL looks like: `https://docs.google.com/spreadsheets/d/ 1ABC...xyz /edit`
   - Copy the part **between** `/d/` and `/edit` (the long string).  
   Example: `13qdo8ARaDoh2vYsn_WJYm1dduxJmOvdIB2LFkXxBBiA`

---

## Step 8: Share the Sheet with the service account

1. Open your **Google Sheet** (the one you’ll use for bookings).
2. Click the **"Share"** button (top right).
3. In **"Add people and groups"**, **paste the service account email** (the `client_email` from Step 6).
4. Set the permission to **"Editor"**.
5. You can **uncheck** "Notify people" (the service account doesn’t read email).
6. Click **"Share"** (or **"Send"**).

The service account can now read and write that Sheet.

---

## Step 9: Use the credentials in your app

**Option A – Use a credentials file (e.g. on your computer)**

1. Move the **downloaded JSON file** into your project folder.
2. Rename it to **`credentials.json`** (or keep the name and use it in the command below).
3. Ensure **`credentials.json`** is in your **`.gitignore`** (it already is in this project).
4. In the terminal, from your project folder:

   ```bash
   export GOOGLE_SPREADSHEET_ID="YOUR_SPREADSHEET_ID"
   export GOOGLE_APPLICATION_CREDENTIALS="./credentials.json"
   npm start
   ```

   Replace `YOUR_SPREADSHEET_ID` with the ID you copied in Step 7.

**Option B – Use JSON in an env var (e.g. for Render)**

1. Open the **JSON file** and copy its **entire** contents.
2. Put it on **one line** (remove newlines) and paste into your host’s env var **GOOGLE_SERVICE_ACCOUNT_JSON**.
3. Set **GOOGLE_SPREADSHEET_ID** to your Spreadsheet ID.
4. Do **not** set **GOOGLE_FORM_EMBED_URL** so the app uses the custom form.

---

## Quick checklist

| # | Step |
|---|------|
| 1 | Open [console.cloud.google.com](https://console.cloud.google.com). |
| 2 | Create a new project (e.g. "Salon Bookings"). |
| 3 | Enable **Google Sheets API** (APIs & Services → Library). |
| 4 | Create a **service account** (APIs & Services → Credentials → Create Credentials → Service account). |
| 5 | Create a **JSON key** for that service account (Keys → Add Key → Create new key → JSON). |
| 6 | Copy **client_email** from the JSON file. |
| 7 | Create a Google Sheet and copy its **Spreadsheet ID** from the URL. |
| 8 | **Share** the Sheet with the service account email (Editor). |
| 9 | Set **GOOGLE_SPREADSHEET_ID** and **GOOGLE_APPLICATION_CREDENTIALS** (or **GOOGLE_SERVICE_ACCOUNT_JSON**), then run the app. |

After this, the **custom method** works: our form, your Sheet, and queue number on the site.
