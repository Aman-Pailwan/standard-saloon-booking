# Queue Number with Google Form + Google Sheet

When you use the **embedded Google Form** (not our custom form), our Node app never sees the submission, so we can’t show the queue number on our site. You can still add a **queue number in your Google Sheet** (and optionally email it to the customer) using **Google Apps Script**.

---

## 1. Add a “Queue #” column in your Sheet

1. Open the **Google Sheet** linked to your Form (Responses tab).
2. In **row 1**, add a new column (e.g. column J): **Queue #**.
3. Leave row 2 and below empty for that column; the script will fill it.

---

## 2. Add the script to your Sheet

1. In the Sheet: **Extensions** → **Apps Script**.
2. Delete any sample code and paste this:

```javascript
function onFormSubmit(e) {
  var sheet = e.source.getActiveSheet();
  var row = e.range.getRow();
  // Row 1 = header, so first response is row 2 → queue #1
  var queueNumber = row - 1;
  var queueCol = 10; // Column J = 10 (change if your Queue # column is different)
  sheet.getRange(row, queueCol).setValue(queueNumber);
}
```

3. **Set the trigger:** Click the **clock icon** (Triggers) in the left sidebar → **+ Add Trigger**:
   - **Function:** `onFormSubmit`
   - **Event:** **From spreadsheet** → **On form submit**
   - **Save**.

4. The first time you add the trigger, Google will ask for permission (Review permissions → choose your account → Advanced → Go to project → Allow).

---

## 3. What happens

- When someone submits your **Google Form**, a new row is added to the Sheet.
- The script runs and writes the **queue number** (1, 2, 3, …) in the **Queue #** column for that row.
- So in the Sheet you see: first response = 1, second = 2, etc.

---

## 4. (Optional) Email the queue number to the respondent

If your Form collects **Email** (and it’s the same for every response), you can send a short email with the queue number. In Apps Script, replace the script with:

```javascript
function onFormSubmit(e) {
  var sheet = e.source.getActiveSheet();
  var row = e.range.getRow();
  var queueNumber = row - 1;
  var queueCol = 10; // Column J
  sheet.getRange(row, queueCol).setValue(queueNumber);

  // Optional: email the respondent (if you have an "Email" column, e.g. column E)
  var emailCol = 5; // Change to the column index of your Email question (A=1, B=2, C=3, D=4, E=5...)
  var email = sheet.getRange(row, emailCol).getValue();
  if (email && typeof email === 'string' && email.indexOf('@') > -1) {
    var subject = 'Your booking – Standard Hair and Makeup Studio';
    var body = 'Thank you for booking. You are #' + queueNumber + ' in the queue for today.';
    GmailApp.sendEmail(email, subject, body);
  }
}
```

Adjust **queueCol** and **emailCol** to match your sheet (column J = 10; if Email is in column D, use 4).

---

## Summary

| Where you want queue number | How |
|-----------------------------|-----|
| **In the Google Sheet only** | Use the script in step 2. Queue # column is filled on each form submit. |
| **Emailed to the customer** | Use the optional script in step 4 (and the Email column in your form). |
| **On our website after submit** | Not possible with the embedded Form. Use our **custom form** (no `GOOGLE_FORM_EMBED_URL`, use Sheets API) so our app can show “You are #N in the queue” on the page. |

So: **yes**, you can use a queue number with **Google Form + Google Spreadsheet** by adding this script to the Sheet; the number will appear in the sheet (and optionally in an email). To show it on **our** site right after submit, you need the **custom form** and the Sheets API.
