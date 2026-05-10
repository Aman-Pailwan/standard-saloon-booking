const express = require('express');
const path = require('path');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TZ = 'Asia/Kolkata';

const app = express();
const PORT = process.env.PORT || 3000;
// From env; set GOOGLE_SPREADSHEET_ID (Sheet ID from the URL) – update in Render/env when needed
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
const HEADERS = ['Date', 'Time', 'Customer Name', 'Phone', 'Email', 'Service', 'How did you hear', 'Notes', 'Booked At'];

// Embedded Google Form – only used when set. If not set, the custom form (with queue number) is shown.
const GOOGLE_FORM_EMBED_URL = process.env.GOOGLE_FORM_EMBED_URL || null;

// Bookings open at 9:00 PM IST daily; for testing set to true to keep booking always open
const BOOKING_ALWAYS_OPEN = process.env.BOOKING_ALWAYS_OPEN === 'true' || process.env.BOOKING_ALWAYS_OPEN === '1';
const BOOKING_OPEN_HOUR_IST = 21;   // 9 PM IST
const BOOKING_OPEN_MINUTE_IST = 0;

// Create a new sheet tab per day in the same spreadsheet (tab name = YYYY-MM-DD)
const USE_DAILY_SHEETS = process.env.USE_DAILY_SHEETS !== 'false';

// Max bookings per day; once reached, no more accepted until next day (9:00 PM IST)
const MAX_BOOKINGS_PER_DAY = parseInt(process.env.MAX_BOOKINGS_PER_DAY || '18', 10) || 18;

// Emergency closure message to disable bookings and show a notice on the frontend
const EMERGENCY_CLOSURE_MESSAGE = process.env.EMERGENCY_CLOSURE_MESSAGE || null;

/** Cache tab titles from spreadsheets.get to cut read quota (short TTL; invalidated on addSheet). */
let sheetTitlesCache = { titles: null, expiresAt: 0 };
const SHEET_TITLES_TTL_MS = parseInt(process.env.SHEET_TITLES_CACHE_MS || '60000', 10) || 60000;

function invalidateSheetTitlesCache() {
  sheetTitlesCache = { titles: null, expiresAt: 0 };
}

class Mutex {
  constructor() {
    this.locked = false;
    this.queue = [];
  }
  lock() {
    return new Promise(resolve => {
      if (this.locked) {
        this.queue.push(resolve);
      } else {
        this.locked = true;
        resolve();
      }
    });
  }
  unlock() {
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      resolve();
    } else {
      this.locked = false;
    }
  }
}
const bookingMutex = new Mutex();
let optimisticBookingCount = 0;
let optimisticBookingDate = '';

async function getSpreadsheetSheetTitles(sheets) {
  const now = Date.now();
  if (sheetTitlesCache.titles && now < sheetTitlesCache.expiresAt) {
    return sheetTitlesCache.titles;
  }
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const titles = (meta.data.sheets || []).map((s) => s.properties.title);
  sheetTitlesCache = { titles, expiresAt: now + SHEET_TITLES_TTL_MS };
  return titles;
}

// Weekly break (IST): when true, no bookings from Friday 9:00 PM through Saturday 8:59 PM; opens Saturday 9:00 PM (still uses env name SATURDAY_OFF for compatibility)
const SATURDAY_OFF = process.env.SATURDAY_OFF === 'true' || process.env.SATURDAY_OFF === '1';

const WEEKLY_BREAK_USER_MESSAGE =
  "We're on our weekly break (Friday 9 PM – Saturday 9 PM IST). Online bookings open again Saturday at 9:00 PM IST.";

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

/** Set TEST_SATURDAY_9PM=true to simulate Saturday 9:00 PM IST (form opens for Sunday). Use with SATURDAY_OFF=true. */
const TEST_SATURDAY_9PM = process.env.TEST_SATURDAY_9PM === 'true' || process.env.TEST_SATURDAY_9PM === '1';

/** Current moment in Asia/Kolkata. Server host timezone is ignored. Overridden when TEST_SATURDAY_9PM. */
function istMoment() {
  if (TEST_SATURDAY_9PM) {
    return dayjs.tz('2025-02-15 21:00:00', 'YYYY-MM-DD HH:mm:ss', IST_TZ);
  }
  return dayjs().tz(IST_TZ);
}

/** Current date in IST as YYYY-MM-DD */
function getISTDateString() {
  return istMoment().format('YYYY-MM-DD');
}

/** Current hour (0–23) and minute in IST */
function getISTTime() {
  const m = istMoment();
  return { hour: m.hour(), minute: m.minute() };
}

/** Date we are currently accepting bookings for (IST). Always returns the date of the appointment. Bookings open at 9 PM for the next day. */
function getBookingDateString() {
  const now = istMoment();
  const hour = now.hour();
  const minute = now.minute();
  
  const afterOpen = hour > BOOKING_OPEN_HOUR_IST || (hour === BOOKING_OPEN_HOUR_IST && minute >= BOOKING_OPEN_MINUTE_IST);
  
  if (afterOpen) {
    // 9 PM to Midnight: booking for tomorrow
    return now.add(1, 'day').format('YYYY-MM-DD');
  } else {
    // Midnight to 9 PM: booking for today
    return now.format('YYYY-MM-DD');
  }
}

/**
 * True during weekly break: Friday 9:00 PM IST (inclusive) through Saturday 8:59 PM IST.
 * Bookings resume Saturday 9:00 PM IST (for Sunday’s sheet when SATURDAY_OFF is on).
 */
function isWeekOff() {
  if (!SATURDAY_OFF) return false;
  const now = istMoment();
  const d = now.day();
  const hour = now.hour();
  const minute = now.minute();
  const atOrAfterOpen =
    hour > BOOKING_OPEN_HOUR_IST || (hour === BOOKING_OPEN_HOUR_IST && minute >= BOOKING_OPEN_MINUTE_IST);
  const beforeOpen = hour < BOOKING_OPEN_HOUR_IST || (hour === BOOKING_OPEN_HOUR_IST && minute < BOOKING_OPEN_MINUTE_IST);
  if (d === 5 && atOrAfterOpen) return true; // Friday from 9 PM
  if (d === 6 && beforeOpen) return true; // Saturday until 9 PM
  return false;
}

function getSheetNameForDate(date) {
  if (date) {
    const parsed = dayjs.tz(String(date).trim(), 'YYYY-MM-DD', IST_TZ);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : getBookingDateString();
  }
  return getBookingDateString();
}

/**
 * Tab name for a booking cycle. When bookingDateYmd is set (YYYY-MM-DD), use it so count + append stay on the same tab
 * even if the request spans the 9 PM IST window boundary while awaiting Google APIs.
 */
function getTabNameForBookingCycle(bookingDateYmd) {
  if (!USE_DAILY_SHEETS) return SHEET_NAME;
  if (bookingDateYmd) return getSheetNameForDate(bookingDateYmd);
  return getBookingDateString();
}

/** A1 range with a quoted sheet title (required for names like 2026-04-23). */
function sheetRange(tabName, a1) {
  const safe = String(tabName).replace(/'/g, "''");
  return `'${safe}'!${a1}`;
}

/** Queue # from append response, e.g. '2026-04-23'!A4:I4 → 3 (row 1 = header). */
function queueNumberFromAppendUpdates(appendRes) {
  const updatedRange =
    appendRes &&
    appendRes.data &&
    appendRes.data.updates &&
    appendRes.data.updates.updatedRange;
  if (!updatedRange || typeof updatedRange !== 'string') return 1;
  const m = updatedRange.match(/![A-Za-z]+(\d+)/);
  if (!m) return 1;
  const row = parseInt(m[1], 10);
  return row > 1 ? row - 1 : 1;
}

/** Get booking count for the active cycle, or for a fixed YYYY-MM-DD when provided (POST /api/book). */
/** One values.read per call (no spreadsheets.get) to reduce Sheets read quota. */
async function getTodayBookingCount(bookingDateYmd) {
  if (!SPREADSHEET_ID) return 0;
  try {
    const sheets = getSheetsClient();
    const tabName = getTabNameForBookingCycle(bookingDateYmd);
    const countRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetRange(tabName, 'A:A'),
    });
    const rows = countRes.data.values || [];
    const dataRowCount = rows.length <= 1 ? 0 : rows.length - 1;
    return dataRowCount;
  } catch (_) {
    return 0;
  }
}

/** Format instant as IST for the sheet (e.g. "31/1/2025, 3:45:00 pm IST") */
function toISTString(date) {
  const d = date != null ? dayjs(date) : dayjs();
  return d.tz(IST_TZ).format('D/M/YYYY, h:mm:ss a') + ' IST';
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
  // Must match booking.date — never recompute from the clock here (Sheets calls can cross 9 PM IST / midnight).
  const tabName = USE_DAILY_SHEETS ? getSheetNameForDate(booking.date) : SHEET_NAME;
  const rangeColA = sheetRange(tabName, 'A:A');
  const rangeHeader = sheetRange(tabName, 'A1:I1');
  const rangeAppend = sheetRange(tabName, 'A:I');

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

  let existingTitles = await getSpreadsheetSheetTitles(sheets);
  if (!existingTitles.includes(tabName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
    invalidateSheetTitlesCache();
  }

  const batch = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: [rangeColA, rangeHeader],
  });
  const vr = batch.data.valueRanges || [];
  const colA = (vr[0] && vr[0].values) || [];
  const headerVals = (vr[1] && vr[1].values) || [];
  let dataRowCount = colA.length <= 1 ? 0 : colA.length - 1;

  if (!headerVals.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: rangeHeader,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [HEADERS] },
    });
  }

  if (dataRowCount >= MAX_BOOKINGS_PER_DAY) {
    const err = new Error('We\'re done for today. All slots are full. Bookings open again at 9:00 PM IST tomorrow.');
    err.code = 'DAILY_LIMIT_REACHED';
    throw err;
  }

  if (dataRowCount >= MAX_BOOKINGS_PER_DAY - 1) {
    const countRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: rangeColA,
    });
    const rows = countRes.data.values || [];
    dataRowCount = rows.length <= 1 ? 0 : rows.length - 1;
    if (dataRowCount >= MAX_BOOKINGS_PER_DAY) {
      const err = new Error('We\'re done for today. All slots are full. Bookings open again at 9:00 PM IST tomorrow.');
      err.code = 'DAILY_LIMIT_REACHED';
      throw err;
    }
  }

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: rangeAppend,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  return queueNumberFromAppendUpdates(appendRes);
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
  if (isWeekOff()) return false;
  // Open from 9 PM until next 9 PM (24h window), except during Fri 9 PM – Sat 9 PM when SATURDAY_OFF.
  const { hour, minute } = getISTTime();
  const past9PmToday = hour > BOOKING_OPEN_HOUR_IST || (hour === BOOKING_OPEN_HOUR_IST && minute >= BOOKING_OPEN_MINUTE_IST);
  return past9PmToday || hour < BOOKING_OPEN_HOUR_IST;
}

function getNextOpeningTime() {
  const now = istMoment();
  const hour = now.hour();
  const minute = now.minute();
  const alreadyOpen = hour > BOOKING_OPEN_HOUR_IST || (hour === BOOKING_OPEN_HOUR_IST && minute >= BOOKING_OPEN_MINUTE_IST);

  if (SATURDAY_OFF && isWeekOff()) {
    const ymd =
      now.day() === 5
        ? now.add(1, 'day').format('YYYY-MM-DD')
        : now.format('YYYY-MM-DD');
    const hh = String(BOOKING_OPEN_HOUR_IST).padStart(2, '0');
    const mm = String(BOOKING_OPEN_MINUTE_IST).padStart(2, '0');
    return dayjs.tz(`${ymd} ${hh}:${mm}:00`, 'YYYY-MM-DD HH:mm:ss', IST_TZ).toDate();
  }

  const calendarDay = !alreadyOpen ? now : now.add(1, 'day');
  const ymd = calendarDay.format('YYYY-MM-DD');
  const hh = String(BOOKING_OPEN_HOUR_IST).padStart(2, '0');
  const mm = String(BOOKING_OPEN_MINUTE_IST).padStart(2, '0');
  return dayjs.tz(`${ymd} ${hh}:${mm}:00`, 'YYYY-MM-DD HH:mm:ss', IST_TZ).toDate();
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
  if (EMERGENCY_CLOSURE_MESSAGE) {
    return res.json({
      open: false,
      slotsFull: false,
      emergencyClosure: true,
      message: EMERGENCY_CLOSURE_MESSAGE,
      nextOpening: null
    });
  }

  const weekOff = isWeekOff();
  const windowOpen = !weekOff && isBookingWindowOpen();
  const currentBookingsToday = await getTodayBookingCount();
  const slotsFull = currentBookingsToday >= MAX_BOOKINGS_PER_DAY;
  const open = windowOpen && !slotsFull;
  let message;
  if (weekOff) {
    message = WEEKLY_BREAK_USER_MESSAGE;
  } else if (slotsFull) {
    message = "We're done for today. All slots are full. Bookings open again at 9:00 PM IST tomorrow.";
  } else if (windowOpen) {
    message = 'Slots are still available for today. You can submit your appointment below.';
  } else {
    message = 'Bookings open daily at 9:00 PM IST. You can fill the form; submission will be accepted after 9 PM.';
  }

  res.json({
    open,
    slotsFull,
    weekOff: weekOff || undefined,
    message,
    nextOpening: getNextOpeningTime().toISOString()
  });
});

/** Debug: IST date, week-off window, bookingDate – use on Render to verify */
app.get('/api/status-debug', (req, res) => {
  const istDate = getISTDateString();
  res.json({
    istDate,
    istDayOfWeek: istMoment().day(),
    maxBookingsPerDay: MAX_BOOKINGS_PER_DAY,
    SATURDAY_OFF,
    weekOff: isWeekOff(),
    bookingDate: getBookingDateString(),
    open: isBookingWindowOpen(),
    testSaturday9pm: TEST_SATURDAY_9PM,
    serverTime: new Date().toISOString(),
    timeNow: istMoment().format('YYYY-MM-DD HH:mm:ss'),
    dayNow: istMoment().format('dddd'),
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
  if (EMERGENCY_CLOSURE_MESSAGE) {
    return res.status(403).json({
      success: false,
      error: EMERGENCY_CLOSURE_MESSAGE,
      emergencyClosure: true,
    });
  }
  if (GOOGLE_FORM_EMBED_URL) {
    return res.status(400).json({ success: false, error: 'Bookings use Google Form; submit there.' });
  }
  if (!SPREADSHEET_ID) {
    return res.status(500).json({
      success: false,
      error: 'Server is not configured for bookings. Set GOOGLE_SPREADSHEET_ID (and credentials) and restart the server.',
    });
  }
  if (isWeekOff()) {
    return res.status(403).json({
      success: false,
      error: WEEKLY_BREAK_USER_MESSAGE,
      weekOff: true,
    });
  }
  if (!isBookingWindowOpen()) {
    return res.status(403).json({
      success: false,
      error: 'Bookings open daily at 9:00 PM IST. Please try again then.',
      nextOpening: getNextOpeningTime().toISOString(),
    });
  }

  const bookingDate = getBookingDateString();

  if (optimisticBookingDate !== bookingDate) {
    optimisticBookingDate = bookingDate;
    optimisticBookingCount = 0;
  }

  if (optimisticBookingCount >= MAX_BOOKINGS_PER_DAY) {
    return res.status(403).json({
      success: false,
      error: "We're done for today. All slots are full. Bookings open again at 9:00 PM IST tomorrow.",
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

  await bookingMutex.lock();
  try {
    const currentCount = await getTodayBookingCount(bookingDate);
    optimisticBookingCount = currentCount;
    if (currentCount >= MAX_BOOKINGS_PER_DAY) {
      return res.status(403).json({
        success: false,
        error: "We're done for today. All slots are full. Bookings open again at 9:00 PM IST tomorrow.",
        slotsFull: true,
      });
    }

    const queueNumber = await appendBookingToSheet({
      date: bookingDate,
      time: time || '',
      customerName: (customerName || '').trim(),
      phone: (phone || '').trim(),
      email: (email || '').trim(),
      service: (service || '').trim(),
      source: (source || '').trim(),
      notes: (notes || '').trim(),
    });

    optimisticBookingCount = currentCount + 1;

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
    } else if (
      err.code === 429 ||
      (err.message && err.message.toLowerCase().includes('quota exceeded'))
    ) {
      userMessage =
        'Our booking system hit a short-term Google Sheets limit. Please wait a minute and try again, or call us to book.';
    }
    res.status(500).json({
      success: false,
      error: userMessage,
    });
  } finally {
    bookingMutex.unlock();
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
  console.log('Bookings accepted at 9:00 PM IST daily. New sheet tab per day when using API.');
  if (TEST_SATURDAY_9PM) console.log('*** TEST_SATURDAY_9PM is ON – simulating Saturday 9 PM IST (form open for Sunday). Remove for real time. ***');
  if (BOOKING_ALWAYS_OPEN) console.log('Testing mode: BOOKING_ALWAYS_OPEN is on – bookings are always accepted.');
  if (!SPREADSHEET_ID) {
    console.warn('\n*** GOOGLE_SPREADSHEET_ID is not set – bookings will fail. Set it to your Sheet ID (from the URL). ***');
  } else {
    const tabName = getTabNameForBookingCycle();
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
