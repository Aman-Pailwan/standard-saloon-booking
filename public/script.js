(function () {
  const form = document.getElementById('booking-form');
  const statusEl = document.getElementById('booking-status');
  const messageEl = document.getElementById('form-message');
  const submitBtn = document.getElementById('submit-btn');

  if (!form || !statusEl) return;

  function setMinDate() {}

  function showMessage(text, type) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.className = 'form-message ' + (type === 'error' ? 'error' : 'success');
  }

  function clearMessage() {
    if (messageEl) {
      messageEl.textContent = '';
      messageEl.className = 'form-message';
    }
  }

  async function fetchBookingStatus() {
    try {
      const res = await fetch('/api/booking-status');
      const data = await res.json();
      statusEl.textContent = data.open
        ? 'Bookings are open. You can submit your appointment below.'
        : 'Bookings open daily at 12:00 AM (midnight). You can fill the form, but submission will be accepted after midnight.';
      statusEl.className = 'booking-status ' + (data.open ? 'open' : 'closed');
    } catch (_) {
      statusEl.textContent = 'Unable to load booking status.';
      statusEl.className = 'booking-status closed';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessage();
    if (submitBtn) submitBtn.disabled = true;

    const payload = {
      customerName: form.customerName.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      service: form.service.value,
      source: form.source ? form.source.value : '',
      notes: form.notes.value.trim(),
    };

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        let msg = data.message || 'Your appointment has been booked.';
        if (data.bookedAt) {
          const d = new Date(data.bookedAt);
          const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
          const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
          msg += '\nForm submitted at ' + timeStr + ' IST, ' + dateStr + '.';
        }
        if (data.queueNumber != null) {
          msg += '\nYour number in the queue: #' + data.queueNumber + ' for today.';
        }
        showMessage(msg, 'success');
        form.reset();
        setMinDate();
        fetchBookingStatus();
      } else {
        showMessage(data.error || 'Booking failed. Please try again.', 'error');
      }
    } catch (_) {
      showMessage('Network error. Please try again.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  setMinDate();
  fetchBookingStatus();
})();
