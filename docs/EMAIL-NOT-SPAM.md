# Emails going to spam – what you can do

Booking confirmation emails can land in spam for a few common reasons. Below are the most effective steps.

---

## 1. Use Domain Authentication (SendGrid) – best fix

If you send **from a custom domain** (e.g. `bookings@yourstudio.com` instead of Gmail), **authenticate that domain** in SendGrid. That tells inbox providers the mail is really from you.

1. In **SendGrid** go to **Settings** → **Sender Authentication**.
2. Under **Domain Authentication**, click **Authenticate Your Domain**.
3. Follow the steps: add the **CNAME records** SendGrid gives you to your domain’s DNS (where you bought the domain, e.g. GoDaddy, Namecheap, Google Domains).
4. After DNS propagates (often 10–30 minutes), verify in SendGrid.
5. Use that domain as your “From” address (e.g. set **SENDGRID_FROM_EMAIL** to `bookings@yourstudio.com` and add/verify that sender in Single Sender Verification if needed).

SendGrid’s guide: [Domain Authentication](https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication).

**If you don’t have a custom domain:** Single Sender with Gmail works but is more likely to be flagged, because the “From” domain (gmail.com) doesn’t match SendGrid’s servers. Getting a small domain (e.g. for your studio) and authenticating it is the most effective way to reduce spam.

---

## 2. Keep the “From” address consistent

Use the same **From name** and **From address** every time (e.g. “Standard Hair and Makeup Studio” &lt;your@email.com&gt;). Changing it often can hurt reputation.

---

## 3. Avoid spammy content

- **Subject:** Keep it clear and normal, e.g. “Your booking – you are #3 in the queue”. Avoid ALL CAPS, lots of punctuation!!!, or words like “FREE”, “ACT NOW”.
- **Body:** We already send plain text + HTML and no heavy sales language. Keep it that way.
- **Links:** We use one main link only if needed. Too many links can trigger filters.

---

## 4. Ask customers to add you to contacts

Tell customers (e.g. on the booking confirmation screen or in person): “If the email goes to spam, open it and click ‘Not spam’ or add our address to your contacts.” Once they do that, future emails to them are more likely to land in the inbox.

---

## 5. Check SendGrid stats

In **SendGrid** → **Activity**, check bounces and spam reports. Fix bounces (invalid addresses); spam reports you can’t fix directly but domain auth and consistent, clean content help over time.

---

## Summary

| Action | Impact |
|--------|--------|
| **Domain Authentication (custom domain)** | High – best way to reduce “spam” placement. |
| **Consistent From address** | Medium. |
| **Neutral subject/body, few links** | Medium (we already do this). |
| **Customers add you to contacts** | Helps for those specific recipients. |

The single biggest improvement is sending from **your own domain** and **authenticating that domain** in SendGrid.
