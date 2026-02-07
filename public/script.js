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
      statusEl.textContent = data.message || (data.open ? 'Bookings are open.' : 'Bookings open daily at 12:00 AM (midnight) IST.');
      statusEl.className = 'booking-status ' + (data.slotsFull ? 'full' : data.open ? 'open' : 'closed');

      var formSection = document.getElementById('custom-form-section');
      var form = document.getElementById('booking-form');
      if (data.slotsFull && formSection) {
        formSection.classList.add('slots-full');
        if (form) form.style.pointerEvents = 'none';
        if (form) form.style.opacity = '0.6';
      } else {
        if (formSection) formSection.classList.remove('slots-full');
        if (form) { form.style.pointerEvents = ''; form.style.opacity = ''; }
      }
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
      const controller = new AbortController();
      const timeoutId = setTimeout(function () { controller.abort(); }, 30000);
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const contentType = res.headers.get('Content-Type') || '';
      const data = contentType.includes('application/json') ? await res.json() : { success: false, error: 'Server returned an invalid response. Try again or check /api/check.' };

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
    } catch (e) {
      if (e.name === 'AbortError') {
        showMessage('Request timed out. The server may be starting up (e.g. on Render). Try again in a minute, or check /api/check.', 'error');
      } else {
        showMessage('Network error. Please try again. If deployed, check /api/check to verify credentials.', 'error');
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  setMinDate();
  fetchBookingStatus();
})();
