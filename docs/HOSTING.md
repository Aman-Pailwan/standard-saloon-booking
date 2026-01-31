# How to Host Your Salon Booking Site

Your app is a Node.js + Express app. Here are simple ways to put it online.

---

## Are they free?

| Host     | Free tier | Limits |
|----------|-----------|--------|
| **Render** | Yes       | Free web services **sleep after ~15 min** of no traffic; first visit after that can take 30–60 sec to wake. ~750 hours/month on free tier. |
| **Railway** | Yes (trial / credit) | Often **$5 free credit per month**; after that you pay. Check [railway.app/pricing](https://railway.app/pricing). |
| **Fly.io** | Yes       | **Free allowance** for small apps (shared VMs, limited resources). Check [fly.io/docs/about/pricing](https://fly.io/docs/about/pricing). |

For a low-traffic salon booking site, **Render’s free tier** is usually enough; the only downside is the cold start when the app has been idle.

---

## Option 1: Render (free tier, recommended)

1. **Push your project to GitHub** (if you haven’t):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/standard-saloon.git
   git push -u origin main
   ```

2. **Go to [render.com](https://render.com)** and sign up (GitHub login is fine).

3. **New → Web Service**, connect your GitHub repo (`standard-saloon`).

4. **Settings:**
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Plan:** Free

5. **Environment variables** (in Render dashboard → Environment):
   - **GOOGLE_FORM_EMBED_URL** = your form embed URL (e.g. `https://docs.google.com/forms/d/e/.../viewform?embedded=true`)
   - If you use the custom form + Sheets API instead:
     - **GOOGLE_SPREADSHEET_ID** = your sheet ID  
     - **GOOGLE_SERVICE_ACCOUNT_JSON** = paste the **entire** JSON key (one line) from your service account file

6. Click **Create Web Service**. Render will build and deploy. Your site will be at `https://YOUR-APP-NAME.onrender.com`.

**Note:** On the free tier, the app may sleep after ~15 minutes of no traffic; the first visit after that can be slow.

---

## Option 2: Railway

1. **Push your project to GitHub** (same as above).

2. **Go to [railway.app](https://railway.app)** and sign up (GitHub login).

3. **New Project → Deploy from GitHub repo** → select `standard-saloon`.

4. **Settings:** Railway usually detects Node and uses `npm start`. If not, set:
   - **Build:** `npm install`
   - **Start:** `npm start`

5. **Variables** (Railway dashboard → your service → Variables):
   - Add **GOOGLE_FORM_EMBED_URL** (or **GOOGLE_SPREADSHEET_ID** + **GOOGLE_SERVICE_ACCOUNT_JSON** if using Sheets API).

6. **Deploy.** Railway will give you a URL like `https://standard-saloon-production-xxxx.up.railway.app`.

**Note:** Railway’s free tier has a monthly usage limit.

---

## Option 3: Fly.io

1. **Install Fly CLI:** [fly.io/docs/hands-on/install-flyctl](https://fly.io/docs/hands-on/install-flyctl/)

2. **In your project folder:**
   ```bash
   fly launch
   ```
   Answer the prompts (app name, region). Say **no** to PostgreSQL if asked.

3. **Set secrets (env vars):**
   ```bash
   fly secrets set GOOGLE_FORM_EMBED_URL="https://docs.google.com/forms/d/e/.../viewform?embedded=true"
   ```
   Or for Sheets API:
   ```bash
   fly secrets set GOOGLE_SPREADSHEET_ID="your-id"
   fly secrets set GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
   ```

4. **Deploy:**
   ```bash
   fly deploy
   ```
   Your app will be at `https://YOUR-APP-NAME.fly.dev`.

---

## Environment variables summary

| Variable | When to set |
|----------|-------------|
| **GOOGLE_FORM_EMBED_URL** | Always (embedded form). Your form embed URL. |
| **GOOGLE_SPREADSHEET_ID** | Only if using custom form + Sheets API. |
| **GOOGLE_SERVICE_ACCOUNT_JSON** | Only if using custom form + Sheets API. Paste full JSON key. |
| **PORT** | Usually set by the host; don’t set unless needed. |
| **BOOKING_ALWAYS_OPEN** | Optional. Set to `true` to accept bookings at any time (testing). |

---

## Custom domain (optional)

- **Render:** Dashboard → your service → Settings → Custom Domain.
- **Railway:** Dashboard → your service → Settings → Domains.
- **Fly.io:** `fly certs add yourdomain.com` then add a CNAME record pointing to your Fly app.

---

## Checklist before deploy

- [ ] No secrets in code (use env vars only).
- [ ] `npm start` works locally.
- [ ] Project is pushed to GitHub (for Render/Railway).
- [ ] GOOGLE_FORM_EMBED_URL (or Sheets env vars) set on the host.
