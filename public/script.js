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
      time: form.time.value,
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
        showMessage(data.message || 'Your appointment has been booked.', 'success');
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
