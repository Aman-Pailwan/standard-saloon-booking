(function () {
  const form = document.getElementById('booking-form');
  const statusEl = document.getElementById('booking-status');
  const countdownEl = document.getElementById('next-slot-countdown');
  const messageEl = document.getElementById('form-message');
  const submitBtn = document.getElementById('submit-btn');

  if (!form || !statusEl) return;

  let countdownInterval = null;

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

  function showAcknowledgementModal(messageText) {
    const modal = document.getElementById('ack-modal');
    const messageDiv = document.getElementById('ack-modal-message');
    if (!modal || !messageDiv) return;
    messageDiv.textContent = messageText;
    modal.hidden = false;
    modal.classList.add('ack-modal-visible');
    const doneBtn = document.getElementById('ack-done-btn');
    if (doneBtn) doneBtn.focus();
  }

  function hideAcknowledgementModal() {
    const modal = document.getElementById('ack-modal');
    if (!modal) return;
    modal.hidden = true;
    modal.classList.remove('ack-modal-visible');
  }

  function goHome() {
    hideAcknowledgementModal();
    window.location.href = '/';
  }
  const ackDoneBtn = document.getElementById('ack-done-btn');
  if (ackDoneBtn) ackDoneBtn.addEventListener('click', goHome);
  const ackBackdrop = document.querySelector('#ack-modal .ack-modal-backdrop');
  if (ackBackdrop) ackBackdrop.addEventListener('click', goHome);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('ack-modal');
      if (modal && !modal.hidden && modal.classList.contains('ack-modal-visible')) goHome();
    }
  });

  function formatCountdown(ms) {
    if (ms <= 0) return null;
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var parts = [];
    if (h > 0) parts.push(h + 'h');
    parts.push(m + 'm');
    parts.push(s + 's');
    return parts.join(' ');
  }

  function startCountdown(nextOpeningISO) {
    if (countdownInterval) clearInterval(countdownInterval);
    if (!countdownEl || !nextOpeningISO) return;
    var nextOpen = new Date(nextOpeningISO);
    function tick() {
      var now = new Date();
      var ms = nextOpen.getTime() - now.getTime();
      if (ms <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        countdownEl.style.display = 'none';
        countdownEl.textContent = '';
        fetchBookingStatus();
        return;
      }
      var str = formatCountdown(ms);
      if (str) {
        countdownEl.textContent = 'Next slot opens in: ' + str;
        countdownEl.style.display = 'block';
      }
    }
    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  function stopCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (countdownEl) {
      countdownEl.style.display = 'none';
      countdownEl.textContent = '';
    }
  }

  async function fetchBookingStatus() {
    try {
      const res = await fetch('/api/booking-status');
      const data = await res.json();
      var weekOffSection = document.getElementById('week-off-section');
      var formSection = document.getElementById('custom-form-section');
      var formEl = document.getElementById('booking-form');

      if (data.weekOff) {
        statusEl.textContent = '';
        statusEl.className = 'booking-status week-off-header';
        var headerSection = document.querySelector('.book-page-header');
        if (headerSection) headerSection.classList.add('has-week-off');
        if (weekOffSection) weekOffSection.style.display = 'block';
        if (formSection) formSection.style.display = 'none';
        var googleFormSection = document.getElementById('google-form-section');
        if (googleFormSection) googleFormSection.style.display = 'none';
        stopCountdown();
      } else {
        statusEl.textContent = data.message || (data.open ? 'Bookings are open.' : 'Bookings open daily at 12:00 AM (midnight) IST.');
        statusEl.className = 'booking-status ' + (data.slotsFull ? 'full' : data.open ? 'open' : 'closed');
        var headerSection = document.querySelector('.book-page-header');
        if (headerSection) headerSection.classList.remove('has-week-off');
        if (weekOffSection) weekOffSection.style.display = 'none';
        if (formSection) formSection.style.display = '';
        if (data.slotsFull && formSection) {
          formSection.classList.add('slots-full');
          if (formEl) { formEl.style.pointerEvents = 'none'; formEl.style.opacity = '0.6'; }
          if (data.nextOpening) startCountdown(data.nextOpening);
        } else {
          stopCountdown();
          if (formSection) formSection.classList.remove('slots-full');
          if (formEl) { formEl.style.pointerEvents = ''; formEl.style.opacity = ''; }
        }
      }
    } catch (_) {
      stopCountdown();
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
        form.reset();
        setMinDate();
        fetchBookingStatus();
        showAcknowledgementModal(msg);
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
