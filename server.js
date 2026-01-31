const express = require('express');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
const HEADERS = ['Date', 'Time', 'Customer Name', 'Phone', 'Email', 'Service', 'How did you hear', 'Notes', 'Booked At'];

// Embedded Google Form – responses go to the Sheet you linked to the form. Set your embed URL here or via env.
const GOOGLE_FORM_EMBED_URL = process.env.GOOGLE_FORM_EMBED_URL || 'https://docs.google.com/forms/d/e/1FAIpQLSdAGF7uE5iEot6jhk3q5Gr6VTgYa8jtE5LJ57imspTVcaqoRQ/viewform?embedded=true';

// Bookings open only at 12:00 AM (midnight); for testing set to true to keep booking always open
const BOOKING_ALWAYS_OPEN = process.env.BOOKING_ALWAYS_OPEN === 'true' || process.env.BOOKING_ALWAYS_OPEN === '1';

// Create a new sheet tab per day in the same spreadsheet (tab name = YYYY-MM-DD)
const USE_DAILY_SHEETS = process.env.USE_DAILY_SHEETS !== 'false';

function getSheetNameForDate(date) {
  const d = date ? new Date(date) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

/** Ensure a sheet tab exists (create daily tab if USE_DAILY_SHEETS), add headers if empty, then append row */
async function appendBookingToSheet(booking) {
  if (!SPREADSHEET_ID) throw new Error('GOOGLE_SPREADSHEET_ID is not set');
  const sheets = getSheetsClient();
  const tabName = USE_DAILY_SHEETS ? getSheetNameForDate() : SHEET_NAME;

  const bookedAt = new Date().toISOString();
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

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A:I`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function isBookingWindowOpen() {
  if (BOOKING_ALWAYS_OPEN) return true;
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  // Bookings open only at 12:00 AM (midnight)
  return hour > 0 || (hour === 0 && minute >= 0);
}

function getNextOpeningTime() {
  const now = new Date();
  const next = new Date(now);
  if (now.getHours() > 0 || (now.getHours() === 0 && now.getMinutes() > 0)) {
    next.setDate(next.getDate() + 1);
  }
  next.setHours(0, 0, 0, 0);
  return next;
}

// Tell frontend whether to show embedded Google Form or our custom form
app.get('/api/config', (req, res) => {
  res.json({
    useGoogleForm: !!GOOGLE_FORM_EMBED_URL,
    googleFormEmbedUrl: GOOGLE_FORM_EMBED_URL || null,
    bookingAlwaysOpen: BOOKING_ALWAYS_OPEN,
  });
});

app.get('/api/booking-status', (req, res) => {
  const open = isBookingWindowOpen();
  res.json({
    open,
    message: open ? 'Bookings are open.' : 'Bookings open daily at 12:00 AM (midnight).',
    nextOpening: getNextOpeningTime().toISOString(),
  });
});

app.post('/api/book', async (req, res) => {
  if (GOOGLE_FORM_EMBED_URL) {
    return res.status(400).json({ success: false, error: 'Bookings use Google Form; submit there.' });
  }
  if (!isBookingWindowOpen()) {
    return res.status(403).json({
      success: false,
      error: 'Bookings open daily at 12:00 AM (midnight). Please try again then.',
      nextOpening: getNextOpeningTime().toISOString(),
    });
  }

  const { time, customerName, phone, email, service, source, notes } = req.body;
  if (!time || !customerName || !phone || !service) {
    return res.status(400).json({
      success: false,
      error: 'Please provide time, name, phone, and service.',
    });
  }

  // Bookings are for today only – no preferred date, no advance bookings
  const today = new Date().toISOString().slice(0, 10);

  try {
    await appendBookingToSheet({
      date: today,
      time,
      customerName: (customerName || '').trim(),
      phone: (phone || '').trim(),
      email: (email || '').trim(),
      service: (service || '').trim(),
      source: (source || '').trim(),
      notes: (notes || '').trim(),
    });
    res.json({ success: true, message: 'Your appointment has been booked.' });
  } catch (err) {
    console.error('Google Sheets error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to save booking. Check server config and Google Sheets setup.',
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/book', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'book.html'));
});

app.listen(PORT, () => {
  console.log(`Salon booking site running at http://localhost:${PORT}`);
  console.log('Bookings accepted at 12:00 AM daily. New sheet tab per day when using API.');
  if (BOOKING_ALWAYS_OPEN) console.log('Testing mode: BOOKING_ALWAYS_OPEN is on – bookings are always accepted.');
});
