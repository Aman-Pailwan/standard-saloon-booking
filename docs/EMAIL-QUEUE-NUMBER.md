# Email customers their queue number

The app can send an email to the customer after they book, with their **queue number** in the subject and body.

**Emails going to spam?** See **[docs/EMAIL-NOT-SPAM.md](EMAIL-NOT-SPAM.md)** for what you can do (domain authentication, content, etc.).

## When it runs

- Only if the customer **enters an email** in the booking form (email is optional).
- Only if you turn it on with env vars (see below).

---

## Render free tier: use SendGrid (not Gmail SMTP)

**On Render free tier, outbound SMTP ports (587, 465) are blocked**, so Gmail SMTP will not send. Use **SendGrid** instead (HTTPS API works on free tier; ~100 emails/day free).

| Option | Where it works |
|--------|-----------------|
| **SENDGRID_API_KEY** | Render (and anywhere). Recommended for production. |
| **SMTP (Gmail)** | Local only, or a paid host that allows SMTP. |

---

## Enable it

| Variable | When | Description |
|----------|------|-------------|
| **SEND_BOOKING_EMAIL** | Always | `true` or `1` to enable. |
| **SENDGRID_API_KEY** | Render / production | SendGrid API key. App sends via HTTPS. |
| **SENDGRID_FROM_EMAIL** | With SendGrid | From address (must be verified in SendGrid). |
| **SMTP_HOST** | Local | e.g. `smtp.gmail.com`. |
| **SMTP_PORT** | SMTP | Default `587`. |
| **SMTP_USER** | SMTP | Your email. |
| **SMTP_PASS** | SMTP | App password. |
| **EMAIL_FROM_NAME** | Optional | Default: "Standard Hair and Makeup Studio". |
| **EMAIL_FROM_ADDRESS** | Optional | Default: SENDGRID_FROM_EMAIL or SMTP_USER. |

### SendGrid free – step-by-step

**Step 1: Create a SendGrid account**

1. Go to [sendgrid.com](https://sendgrid.com).
2. Click **Start for free** or **Sign up**.
3. Create an account (email + password). Free plan gives ~100 emails/day.

**Step 2: Verify your identity (one-time)**

1. After login, SendGrid may ask you to verify your email – check inbox and click the link.
2. You may be asked to complete a short “Tell us about yourself” form. Fill it and continue.

**Step 3: Create an API key**

1. In the left sidebar, go to **Settings** → **API Keys** (or [SendGrid API Keys](https://app.sendgrid.com/settings/api_keys)).
2. Click **Create API Key**.
3. **Name:** e.g. `Salon booking`.
4. **API Key Permissions:** choose **Restricted Access**. Under **Mail Send**, turn **ON** only **Mail Send** (full access for that). Leave others off.
5. Click **Create & View**. **Copy the key immediately** (it starts with `SG.`) – SendGrid will not show it again. Save it somewhere safe (e.g. a password manager or a note you’ll paste into Render).

**Step 4: Verify a sender (so SendGrid can send “from” your email)**

1. In the left sidebar, go to **Settings** → **Sender Authentication** (or [Sender Authentication](https://app.sendgrid.com/settings/sender_auth)).
2. Under **Single Sender Verification**, click **Create New Sender** (or **Verify a Single Sender**).
3. Fill in:
   - **From Name:** e.g. `Standard Hair and Makeup Studio`
   - **From Email Address:** the Gmail (or email) you want to send from, e.g. `saloonstandard92@gmail.com`
   - **Reply To:** same or your support email
   - **Company / Address:** optional
4. Click **Create**. SendGrid will send a verification email to that address.
5. Open your inbox, click the verification link in SendGrid’s email. Once verified, that address can be used as **From**.

**Step 5: Add env vars on Render**

1. Open [Render Dashboard](https://dashboard.render.com) → your **Web Service** (the salon booking app).
2. Go to **Environment** (left sidebar).
3. Add or edit:
   - **Key:** `SEND_BOOKING_EMAIL` → **Value:** `true`
   - **Key:** `SENDGRID_API_KEY` → **Value:** paste your API key (e.g. `SG.xxxx...`). Mark as **Secret** if you want.
   - **Key:** `SENDGRID_FROM_EMAIL` → **Value:** the **exact** email you verified in Step 4 (e.g. `saloonstandard92@gmail.com`)
4. Click **Save Changes**.

**Step 6: Redeploy**

1. Go to **Manual Deploy** → **Deploy latest commit** (or push a new commit so auto-deploy runs).
2. Wait until the deploy is **Live**.

After this, when a customer books and enters an email, the app will send the queue-number email via SendGrid and it should arrive in their inbox. If it doesn’t, check Render **Logs** for `Confirmation email sent to ... via SendGrid` or any SendGrid error message.

### Gmail SMTP (local only)

Example (local):

```bash
export SEND_BOOKING_EMAIL=true
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASS=your-app-password
```

Then restart the server. When a customer books **and** enters an email, they’ll get an email like:

- **Subject:** Your booking – you are #3 in the queue  
- **Body:** Hi [Name], Thank you for your booking. You are #3 in the queue for today.

---

## Using one Gmail account

You can use a single Gmail address (e.g. your studio email) to send queue-number emails. Gmail requires an **App Password** (not your normal password) for apps.

### Step 1: Turn on 2-Step Verification

1. Go to [Google Account](https://myaccount.google.com) → **Security**.
2. Under "How you sign in to Google", turn on **2-Step Verification** and complete the setup.

### Step 2: Create an App Password

1. In **Security**, open **2-Step Verification**.
2. At the bottom, click **App passwords**.
3. Choose **Mail** and **Other (Custom name)** → e.g. "Salon booking".
4. Click **Generate**. Google shows a **16-character password with spaces** (e.g. `abcd efgh ijkl mnop`).
5. Copy it and **remove all spaces** when you set `SMTP_PASS` – use only the 16 letters (e.g. `abcdefghijklmnop`).

### Step 3: Set environment variables

**Local:**

```bash
export SEND_BOOKING_EMAIL=true
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=yourstudio@gmail.com
export SMTP_PASS=abcdefghijklmnop
node server.js
```

**Render:** Add the same keys in your service **Environment**. Redeploy.

Emails are sent **from** this Gmail. Set `EMAIL_FROM_NAME` for a different display name (e.g. "Standard Hair and Makeup Studio").

---

## Example providers

### Gmail (summary)

- See **Using one Gmail account** above for full steps. Then set:
- `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`
- `SMTP_USER=` your full Gmail address
- `SMTP_PASS=` the 16-character App Password (see **Using one Gmail account** above)

### Outlook / Microsoft 365

- `SMTP_HOST=smtp.office365.com`
- `SMTP_PORT=587`
- `SMTP_USER=your@outlook.com` (or your work email)
- `SMTP_PASS=` your account password (or app password if required)

### SendGrid

1. Create an API key in SendGrid (Dashboard → Settings → API Keys).
2. Use:
   - `SMTP_HOST=smtp.sendgrid.net`
   - `SMTP_PORT=587`
   - `SMTP_USER=apikey` (literally the word `apikey`)
   - `SMTP_PASS=` your SendGrid API key

### Other

Use your provider’s SMTP host, port, and credentials. Most use port 587 (STARTTLS) or 465 (SSL).

---

## On Render

Add the same variables in **Environment** (your service → Environment). Restart/redeploy after adding them. Keep `SMTP_PASS` and other secrets as **secret** env vars.

---

## If email isn’t sent

- **Customer didn’t enter email** – Email is only sent when the form’s “Email address” field is filled.
- **Env not set** – Ensure `SEND_BOOKING_EMAIL=true` and `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` are set and the server was restarted.
- **Check logs** – On failure the server logs `Booking confirmation email error: ...` so you can see the reason (e.g. wrong password, blocked port).
