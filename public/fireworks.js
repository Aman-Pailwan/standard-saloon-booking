(function () {
  'use strict';

  // Check if user prefers reduced motion (accessibility)
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Lightweight fullscreen canvas overlay
  const canvas = document.createElement('canvas');
  canvas.id = 'fireworks-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);
  let isMobile = width < 600;

  // Maximum particle bounds to guarantee zero frame drops even on budget devices
  const MAX_PARTICLES = isMobile ? 90 : 180;

  window.addEventListener('resize', function () {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    isMobile = width < 600;
  });

  // Diwali festive color palettes (optimized RGB tuples)
  const FESTIVE_PALETTES = [
    // Golden Radiance
    [
      { r: 245, g: 217, b: 138 },
      { r: 255, g: 195, b: 60 },
      { r: 255, g: 235, b: 170 },
      { r: 212, g: 175, b: 55 },
    ],
    // Marigold & Saffron
    [
      { r: 255, g: 140, b: 0 },
      { r: 255, g: 180, b: 50 },
      { r: 255, g: 90, b: 50 },
      { r: 245, g: 217, b: 138 },
    ],
    // Rose Gold & Ruby
    [
      { r: 232, g: 169, b: 163 },
      { r: 255, g: 105, b: 135 },
      { r: 255, g: 215, b: 180 },
      { r: 245, g: 217, b: 138 },
    ],
    // Emerald & Gold
    [
      { r: 76, g: 195, b: 135 },
      { r: 120, g: 230, b: 160 },
      { r: 255, g: 220, b: 120 },
      { r: 255, g: 255, b: 255 },
    ],
  ];

  let rockets = [];
  let particles = [];
  let isRunning = true;
  let autoTimer = null;
  let animFrameId = null;

  class Rocket {
    constructor(startX, startY, targetX, targetY, palette) {
      this.x = startX;
      this.y = startY;
      this.targetX = targetX;
      this.targetY = targetY;
      this.angle = Math.atan2(targetY - startY, targetX - startX);
      this.speed = 5.2 + Math.random() * 2.5;
      this.palette = palette;
      this.color = palette[Math.floor(Math.random() * palette.length)];
      this.prevX = startX;
      this.prevY = startY;
    }

    update(index) {
      this.prevX = this.x;
      this.prevY = this.y;

      const vx = Math.cos(this.angle) * this.speed;
      const vy = Math.sin(this.angle) * this.speed;

      this.x += vx;
      this.y += vy;

      if (vy >= 0 || this.y <= this.targetY || Math.hypot(this.targetX - this.x, this.targetY - this.y) <= this.speed * 2) {
        createBurst(this.targetX, this.targetY, this.palette);
        rockets.splice(index, 1);
      }
    }

    draw() {
      // Fast single-line rocket tail
      ctx.beginPath();
      ctx.moveTo(this.prevX, this.prevY);
      ctx.lineTo(this.x, this.y);
      ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.7)`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rocket head
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
      ctx.fill();
    }
  }

  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.2 + 1.2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.friction = 0.96;
      this.gravity = 0.065;
      this.alpha = 1;
      this.decay = Math.random() * 0.016 + 0.014;
      this.color = color;
      this.prevX = x;
      this.prevY = y;
      this.size = Math.random() * 1.8 + 1.1;
    }

    update(index) {
      this.prevX = this.x;
      this.prevY = this.y;

      this.vx *= this.friction;
      this.vy *= this.friction;
      this.vy += this.gravity;
      this.x += this.vx;
      this.y += this.vy;
      this.alpha -= this.decay;

      if (this.alpha <= 0) {
        particles.splice(index, 1);
      }
    }

    draw() {
      // Subtle fast spark line
      ctx.beginPath();
      ctx.moveTo(this.prevX, this.prevY);
      ctx.lineTo(this.x, this.y);
      ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha * 0.4})`;
      ctx.lineWidth = this.size;
      ctx.stroke();

      // Spark dot
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
      ctx.fill();
    }
  }

  function createBurst(x, y, palette) {
    if (particles.length >= MAX_PARTICLES) return;

    // Mobile receives 24-32 particles; Desktop receives 38-50 particles
    const count = isMobile ? Math.floor(Math.random() * 10) + 24 : Math.floor(Math.random() * 14) + 38;

    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) break;
      const color = palette[Math.floor(Math.random() * palette.length)];
      particles.push(new Particle(x, y, color));
    }
  }

  function launchRocket() {
    if (!isRunning || document.hidden) return;

    const startX = Math.random() * (width * 0.8) + width * 0.1;
    const startY = height + 10;
    const targetX = startX + (Math.random() - 0.5) * (width * 0.25);
    const targetY = Math.random() * (height * 0.42) + height * 0.12;

    const palette = FESTIVE_PALETTES[Math.floor(Math.random() * FESTIVE_PALETTES.length)];
    rockets.push(new Rocket(startX, startY, targetX, targetY, palette));
  }

  function loop() {
    if (!isRunning || document.hidden) {
      animFrameId = null;
      return;
    }

    ctx.clearRect(0, 0, width, height);

    for (let i = rockets.length - 1; i >= 0; i--) {
      rockets[i].update(i);
      if (rockets[i]) rockets[i].draw();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update(i);
      if (particles[i]) particles[i].draw();
    }

    animFrameId = requestAnimationFrame(loop);
  }

  function scheduleBurst() {
    if (!isRunning || document.hidden) return;

    const delay = Math.random() * 600 + 800; // between 800ms and 1.4s

    autoTimer = setTimeout(function () {
      launchRocket();

      // Occasionally launch a second rocket on desktop only
      if (!isMobile && Math.random() > 0.72) {
        setTimeout(launchRocket, 280);
      }

      scheduleBurst();
    }, delay);
  }

  function start() {
    if (!isRunning) return;
    if (!animFrameId) {
      animFrameId = requestAnimationFrame(loop);
    }
    scheduleBurst();
  }

  function stop() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    rockets = [];
    particles = [];
    ctx.clearRect(0, 0, width, height);
  }

  // Initial greeting burst
  setTimeout(function () {
    launchRocket();
    if (!isMobile) {
      setTimeout(launchRocket, 350);
    }
  }, 400);

  // Discrete user toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'fireworks-toggle';
  toggleBtn.className = 'fireworks-toggle-btn';
  toggleBtn.innerHTML = '🎆 Crackers: <strong>ON</strong>';
  toggleBtn.title = 'Click to pause or play Diwali fireworks';
  document.body.appendChild(toggleBtn);

  toggleBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    isRunning = !isRunning;
    if (isRunning) {
      toggleBtn.innerHTML = '🎆 Crackers: <strong>ON</strong>';
      toggleBtn.classList.remove('is-off');
      start();
      launchRocket();
    } else {
      toggleBtn.innerHTML = '🎆 Crackers: <strong>OFF</strong>';
      toggleBtn.classList.add('is-off');
      stop();
    }
  });

  // Zero background CPU usage: completely cancel RAF when tab is hidden
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stop();
    } else if (isRunning) {
      start();
    }
  });

  // Start the animation
  start();
})();
