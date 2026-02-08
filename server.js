const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
// From env; set GOOGLE_SPREADSHEET_ID (Sheet ID from the URL) – update in Render/env when needed
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
const HEADERS = ['Date', 'Time', 'Customer Name', 'Phone', 'Email', 'Service', 'How did you hear', 'Notes', 'Booked At'];

// Embedded Google Form – only used when set. If not set, the custom form (with queue number) is shown.
const GOOGLE_FORM_EMBED_URL = process.env.GOOGLE_FORM_EMBED_URL || null;

// Bookings open only at 12:00 AM (midnight); for testing set to true to keep booking always open
const BOOKING_ALWAYS_OPEN = process.env.BOOKING_ALWAYS_OPEN === 'true' || process.env.BOOKING_ALWAYS_OPEN === '1';

// Create a new sheet tab per day in the same spreadsheet (tab name = YYYY-MM-DD)
const USE_DAILY_SHEETS = process.env.USE_DAILY_SHEETS !== 'false';

// Max bookings per day; once reached, no more accepted until next day (12:00 AM IST)
const MAX_BOOKINGS_PER_DAY = parseInt(process.env.MAX_BOOKINGS_PER_DAY || '20', 10) || 20;

// Optional: send email to customer with queue number
// On Render free tier: use SENDGRID_API_KEY (SMTP ports 587/465 are blocked). Locally: SMTP (Gmail) works.
const SEND_BOOKING_EMAIL = process.env.SEND_BOOKING_EMAIL === 'true' || process.env.SEND_BOOKING_EMAIL === '1';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Standard Hair and Makeup Studio';
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || process.env.SENDGRID_FROM_EMAIL || SMTP_USER;

const TIMEZONE_IST = 'Asia/Kolkata';

/** Current date in IST as YYYY-MM-DD (for sheet tab and booking date when server is in another region) */
function getISTDateString() {
  const parts = new Date().toLocaleString('en-IN', { timeZone: TIMEZONE_IST, year: 'numeric', month: '2-digit', day: '2-digit' }).split('/');
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Current hour (0–23) and minute in IST */
function getISTTime() {
  const str = new Date().toLocaleString('en-IN', { timeZone: TIMEZONE_IST, hour: '2-digit', minute: '2-digit', hour12: false });
  const [hour, minute] = str.split(':').map((n) => parseInt(n, 10));
  return { hour: hour || 0, minute: minute || 0 };
}

function getSheetNameForDate(date) {
  if (date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return getISTDateString();
}

/** Get today's booking count (data rows only) for the daily sheet. Returns 0 if no sheet or error. */
async function getTodayBookingCount() {
  if (!SPREADSHEET_ID) return 0;
  try {
    const sheets = getSheetsClient();
    const tabName = USE_DAILY_SHEETS ? getISTDateString() : SHEET_NAME;
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingTitles = (meta.data.sheets || []).map(s => s.properties.title);
    if (!existingTitles.includes(tabName)) return 0;
    const countRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A:A`,
    });
    const rows = countRes.data.values || [];
    const dataRowCount = rows.length <= 1 ? 0 : rows.length - 1;
    return dataRowCount;
  } catch (_) {
    return 0;
  }
}

/** Format a date as IST for display in the sheet (e.g. "31/1/2025, 3:45:00 pm IST") */
function toISTString(date) {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: true,
  }) + ' IST';
}

/** Get Google Sheets client using service account */
function getSheetsClient() {
  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON');
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const fs = require('fs');
    const keyPath = path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      ? process.env.GOOGLE_APPLICATION_CREDENTIALS
      : path.join(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
    credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  } else {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/** Ensure a sheet tab exists (create daily tab if USE_DAILY_SHEETS), add headers if empty, append row. Returns queue number (1-based). */
async function appendBookingToSheet(booking) {
  if (!SPREADSHEET_ID) throw new Error('GOOGLE_SPREADSHEET_ID is not set');
  const sheets = getSheetsClient();
  const tabName = USE_DAILY_SHEETS ? getSheetNameForDate() : SHEET_NAME;

  const bookedAt = toISTString(new Date());
  const row = [
    booking.date,
    booking.time,
    booking.customerName || '',
    booking.phone || '',
    booking.email || '',
    booking.service || '',
    booking.source || '',
    booking.notes || '',
    bookedAt,
  ];

  // List existing sheets and create daily tab if missing
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingTitles = (meta.data.sheets || []).map(s => s.properties.title);
  if (!existingTitles.includes(tabName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  }

  const range = `${tabName}!A1:I1`;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    const values = res.data.values;
    if (!values || values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [HEADERS] },
      });
    }
  } catch (e) {
    if (e.code === 404 || (e.message && e.message.includes('Unable to parse range'))) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [HEADERS] },
      });
    } else throw e;
  }

  // Get current row count for queue number (data rows only, excluding header)
  let queueNumber = 1;
  let dataRowCount = 0;
  try {
    const countRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A:A`,
    });
    const rows = countRes.data.values || [];
    dataRowCount = rows.length <= 1 ? 0 : rows.length - 1; // subtract header
    queueNumber = dataRowCount + 1;
  } catch (_) {
    queueNumber = 1;
  }

  if (dataRowCount >= MAX_BOOKINGS_PER_DAY) {
    const err = new Error('We\'re done for today. All slots are full. Bookings open again at 12:00 AM tomorrow.');
    err.code = 'DAILY_LIMIT_REACHED';
    throw err;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A:I`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  return queueNumber;
}

/** Professional HTML template for booking confirmation email (inline CSS for email clients). */
function getBookingEmailHtml(customerName, queueNumber) {
  const escapedName = String(customerName).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] || c));
  const q = String(queueNumber);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking confirmation</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333; background-color: #f5f7f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f7f6;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #1a3328 0%, #2d5245 100%); padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #ffffff;">Standard Hair and Makeup Studio</h1>
              <p style="margin: 8px 0 0; font-size: 13px; color: rgba(255,255,255,0.85); letter-spacing: 0.1em;">Booking confirmation</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333;">Hi ${escapedName},</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #555;">Thank you for booking with us. Your appointment has been received.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f0f9f6; border: 2px solid #5a9a88; border-radius: 10px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0 0 6px; font-size: 13px; color: #2d5245; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">Your queue number for today</p>
                    <p style="margin: 0; font-size: 36px; font-weight: 700; color: #1a3328; letter-spacing: 0.02em;">#${q}</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 14px; color: #666;">We will confirm your slot. To change or cancel, please contact us by phone.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background: #f5f7f6; border-top: 1px solid #e8ecea; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #666;">&copy; Standard Hair and Makeup Studio</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Send optional email to customer with queue number. Uses SendGrid API if SENDGRID_API_KEY set (works on Render free tier); else SMTP. Does not throw; logs errors. */
async function sendBookingConfirmationEmail(customerEmail, queueNumber, customerName) {
  if (!SEND_BOOKING_EMAIL || !customerEmail || !queueNumber) return;
  const email = (customerEmail || '').trim();
  if (!email || email.indexOf('@') === -1) return;

  const name = (customerName || 'Customer').trim() || 'Customer';
  const subject = 'Your booking – you are #' + queueNumber + ' in the queue';
  const text = `Hi ${name},\n\nThank you for your booking.\n\nYou are #${queueNumber} in the queue for today.\n\n– Standard Hair and Makeup Studio`;
  const html = getBookingEmailHtml(name, queueNumber);
  const fromAddr = EMAIL_FROM_ADDRESS || SMTP_USER;
  if (!fromAddr || fromAddr.indexOf('@') === -1) {
    console.warn('Email not sent: set EMAIL_FROM_ADDRESS or SENDGRID_FROM_EMAIL (or SMTP_USER for SMTP).');
    return;
  }

  if (SENDGRID_API_KEY) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + SENDGRID_API_KEY,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }],
          from: { email: fromAddr, name: EMAIL_FROM_NAME },
          reply_to: fromAddr ? { email: fromAddr, name: EMAIL_FROM_NAME } : undefined,
          subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html },
          ],
        }),
      });
      if (res.ok) {
        console.log('Confirmation email sent to', email, '(queue #' + queueNumber + ') via SendGrid');
      } else {
        const errText = await res.text();
        console.error('SendGrid error:', res.status, errText);
      }
    } catch (err) {
      console.error('Booking confirmation email error (SendGrid):', err.message);
    }
    return;
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('Email not sent: set SENDGRID_API_KEY (recommended on Render) or SMTP_HOST, SMTP_USER, SMTP_PASS.');
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"${EMAIL_FROM_NAME}" <${fromAddr}>`,
      to: email,
      subject,
      text,
      html,
    });
    console.log('Confirmation email sent to', email, '(queue #' + queueNumber + ')');
  } catch (err) {
    console.error('Booking confirmation email error:', err.message);
  }
}

app.use(express.json());

function isBookingWindowOpen() {
  if (BOOKING_ALWAYS_OPEN) return true;
  const { hour, minute } = getISTTime();
  // Bookings open at 12:00 AM IST (midnight India time), regardless of server region
  return hour > 0 || (hour === 0 && minute >= 0);
}

function getNextOpeningTime() {
  const { hour, minute } = getISTTime();
  const istToday = getISTDateString();
  const [y, m, d] = istToday.split('-').map((n) => parseInt(n, 10));
  const tomorrow = new Date(y, m - 1, d + 1);
  const tomorrowStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');
  const nextDateStr = hour > 0 || (hour === 0 && minute > 0) ? tomorrowStr : istToday;
  return new Date(nextDateStr + 'T00:00:00+05:30');
}

// Tell frontend whether to show embedded Google Form or our custom form
app.get('/api/config', (req, res) => {
  res.json({
    useGoogleForm: !!GOOGLE_FORM_EMBED_URL,
    googleFormEmbedUrl: GOOGLE_FORM_EMBED_URL || null,
    bookingAlwaysOpen: BOOKING_ALWAYS_OPEN,
  });
});

app.get('/api/booking-status', async (req, res) => {
  const windowOpen = isBookingWindowOpen();
  const currentBookingsToday = await getTodayBookingCount();
  const slotsFull = currentBookingsToday >= MAX_BOOKINGS_PER_DAY;
  const open = windowOpen && !slotsFull;

  let message;
  if (slotsFull) {
    message = "We're done for today. All slots are full. Bookings open again at 12:00 AM tomorrow.";
  } else if (windowOpen) {
    message = 'Slots are still available for today. You can submit your appointment below.';
  } else {
    message = 'Bookings open daily at 12:00 AM (midnight) IST. You can fill the form, but submission will be accepted after midnight.';
  }

  res.json({
    open,
    slotsFull,
    message,
    nextOpening: getNextOpeningTime().toISOString(),
  });
});

/** Check credentials and spreadsheet access – open /api/check in browser to confirm setup */
app.get('/api/check', async (req, res) => {
  const out = { ok: false, spreadsheetId: !!SPREADSHEET_ID, credentials: false, sheetAccess: false, error: null };
  if (!SPREADSHEET_ID) {
    out.error = 'GOOGLE_SPREADSHEET_ID is not set. Set it in Environment (Render) or in your shell.';
    return res.json(out);
  }
  let sheets;
  try {
    sheets = getSheetsClient();
    out.credentials = true;
  } catch (err) {
    out.error = 'Credentials failed: ' + (err.message || String(err));
    return res.json(out);
  }
  try {
    await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    out.sheetAccess = true;
    out.ok = true;
  } catch (err) {
    out.error = 'Sheet access failed: ' + (err.message || String(err));
    if (err.code === 403 || (err.message && err.message.toLowerCase().includes('permission'))) {
      out.error = 'Sheet not shared with service account. Share your Google Sheet with the client_email from your credentials as Editor.';
    } else if (err.code === 404) {
      out.error = 'Spreadsheet not found. Check GOOGLE_SPREADSHEET_ID (the ID from the sheet URL).';
    }
  }
  res.json(out);
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/book', async (req, res) => {
  if (GOOGLE_FORM_EMBED_URL) {
    return res.status(400).json({ success: false, error: 'Bookings use Google Form; submit there.' });
  }
  if (!SPREADSHEET_ID) {
    return res.status(500).json({
      success: false,
      error: 'Server is not configured for bookings. Set GOOGLE_SPREADSHEET_ID (and credentials) and restart the server.',
    });
  }
  if (!isBookingWindowOpen()) {
    return res.status(403).json({
      success: false,
      error: 'Bookings open daily at 12:00 AM (midnight) IST. Please try again then.',
      nextOpening: getNextOpeningTime().toISOString(),
    });
  }

  const currentCount = await getTodayBookingCount();
  if (currentCount >= MAX_BOOKINGS_PER_DAY) {
    return res.status(403).json({
      success: false,
      error: "We're done for today. All slots are full. Bookings open again at 12:00 AM tomorrow.",
      slotsFull: true,
    });
  }

  const { time, customerName, phone, email, service, source, notes } = req.body;
  if (!customerName || !phone || !service) {
    return res.status(400).json({
      success: false,
      error: 'Please provide name, phone, and service.',
    });
  }

  // Bookings are for today only (use IST date so US-hosted server uses Indian day)
  const today = getISTDateString();

  try {
    const queueNumber = await appendBookingToSheet({
      date: today,
      time: time || '',
      customerName: (customerName || '').trim(),
      phone: (phone || '').trim(),
      email: (email || '').trim(),
      service: (service || '').trim(),
      source: (source || '').trim(),
      notes: (notes || '').trim(),
    });

    const bookedAt = new Date().toISOString();
    res.json({
      success: true,
      message: 'Your appointment has been booked.',
      queueNumber,
      bookedAt,
    });

    // Send confirmation email in background so response is not delayed (avoids timeout on Render)
    sendBookingConfirmationEmail(email, queueNumber, customerName).catch((err) =>
      console.error('Booking confirmation email error:', err.message)
    );
  } catch (err) {
    console.error('Google Sheets error:', err.message || err);
    if (err.code === 'DAILY_LIMIT_REACHED') {
      return res.status(403).json({
        success: false,
        error: err.message,
        slotsFull: true,
      });
    }
    let userMessage = err.message || 'Failed to save booking.';
    if (err.code === 403 || (err.message && err.message.toLowerCase().includes('permission'))) {
      userMessage = 'Server cannot write to your Google Sheet. Share the sheet with the service account email (see credentials.json "client_email") as Editor.';
    } else if (err.code === 404 || (err.message && err.message.includes('Unable to parse range'))) {
      userMessage = 'Google Sheet not found or wrong ID. Check GOOGLE_SPREADSHEET_ID (the long id from the sheet URL).';
    }
    res.status(500).json({
      success: false,
      error: userMessage,
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/book', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'book.html'));
});

app.get('/locate', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'locate.html'));
});

app.listen(PORT, () => {
  console.log(`Salon booking site running at http://localhost:${PORT}`);
  console.log('Bookings accepted at 12:00 AM daily. New sheet tab per day when using API.');
  if (BOOKING_ALWAYS_OPEN) console.log('Testing mode: BOOKING_ALWAYS_OPEN is on – bookings are always accepted.');
  if (!SPREADSHEET_ID) {
    console.warn('\n*** GOOGLE_SPREADSHEET_ID is not set – bookings will fail. Set it to your Sheet ID (from the URL). ***');
  } else {
    const tabName = USE_DAILY_SHEETS ? getSheetNameForDate() : SHEET_NAME;
    console.log('Bookings will be written to spreadsheet', SPREADSHEET_ID, 'tab:', tabName);
    (function logServiceAccountEmail() {
      try {
        let creds;
        if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          const fp = path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS) ? process.env.GOOGLE_APPLICATION_CREDENTIALS : path.join(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
          creds = JSON.parse(require('fs').readFileSync(fp, 'utf8'));
        }
        if (creds && creds.client_email) console.log('Share your Google Sheet with this account as Editor:', creds.client_email);
      } catch (_) {}
    })();
  }
});
