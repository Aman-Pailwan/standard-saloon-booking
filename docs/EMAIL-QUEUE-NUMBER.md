# Email customers their queue number

The app can send an email to the customer after they book, with their **queue number** in the subject and body.

## When it runs

- Only if the customer **enters an email** in the booking form (email is optional).
- Only if you turn it on with env vars (see below).

## Enable it

Set these **environment variables** (e.g. in Render → Environment, or in your shell):

| Variable | Required | Description |
|----------|----------|-------------|
| **SEND_BOOKING_EMAIL** | Yes | Set to `true` or `1` to enable. |
| **SMTP_HOST** | Yes | Your SMTP server (e.g. `smtp.gmail.com`). |
| **SMTP_PORT** | No | Default `587`. Use `465` for SSL. |
| **SMTP_USER** | Yes | SMTP login (usually your email). |
| **SMTP_PASS** | Yes | SMTP password or app password. |
| **EMAIL_FROM_NAME** | No | Default: "Standard Hair and Makeup Studio". |
| **EMAIL_FROM_ADDRESS** | No | Default: same as SMTP_USER. |

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
