(() => {
  'use strict';
  const T = window.Toddler;
  const { TAU, rand, pick } = T;

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const PICKS = ['cat', 'duck', 'frog', 'bear', 'car', 'fish'];
  const CARDS = ['#ffe0e9', '#fff3c4', '#dcf5d6', '#f1e2d3', '#dbeaff', '#e6dcff'];
  const BOUNCE_FOR = 0.9;

  const buttons = PICKS.map((id, i) => ({
    fig: T.FIGURES.findIndex(f => f.id === id),
    color: CARDS[i],
    x: 0, y: 0, w: 0, h: 0,
    pressed: new Set(),
    playedAt: -Infinity,
  }));

  let W = 0, H = 0, dpr = 1;
  let parts = [];   // shared sparkles/confetti
  let notes = [];   // floating music notes
  let last = performance.now();

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const cols = W > H ? 3 : 2;
    const rows = Math.ceil(buttons.length / cols);
    const gap = Math.min(W, H) * 0.04;
    const w = (W - gap * (cols + 1)) / cols;
    const h = (H - gap * (rows + 1)) / rows;
    buttons.forEach((b, i) => {
      b.x = gap + (i % cols) * (w + gap);
      b.y = gap + Math.floor(i / cols) * (h + gap);
      b.w = w;
      b.h = h;
    });
  }

  function hit(x, y) {
    return buttons.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  }

  function press(b) {
    const f = T.FIGURES[b.fig];
    b.playedAt = performance.now();
    T.noise(f.noise);
    T.say(f.word, 650);
    if (navigator.vibrate) navigator.vibrate(30);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    for (let k = 0; k < 4; k++) {
      notes.push({
        x: cx + rand(-b.w * 0.3, b.w * 0.3), y: cy - b.h * 0.15,
        vx: rand(-30, 30), vy: rand(-140, -80),
        size: Math.min(b.w, b.h) * rand(0.12, 0.18),
        color: pick(T.COLORS), glyph: pick(['♪', '♫']),
        life: 0, max: rand(1.0, 1.4), delay: k * 0.08,
      });
    }
    T.sparkle(parts, cx, cy, 10);
  }

  // ---------- input ----------

  const held = new Map(); // pointerId -> button

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    const b = hit(e.clientX, e.clientY);
    if (!b) { T.sparkle(parts, e.clientX, e.clientY); return; }
    held.set(e.pointerId, b);
    b.pressed.add(e.pointerId);
    press(b);
  }, { passive: false });

  function release(e) {
    const b = held.get(e.pointerId);
    if (b) b.pressed.delete(e.pointerId);
    held.delete(e.pointerId);
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // ---------- drawing ----------

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }

  function drawButton(b, now) {
    const r = Math.min(b.w, b.h) * 0.14;
    const lift = Math.min(b.w, b.h) * 0.04;
    const sink = b.pressed.size ? lift : 0;

    ctx.fillStyle = 'rgba(60,40,80,0.14)';
    roundRect(b.x, b.y + lift, b.w, b.h - lift, r);
    ctx.fill();
    ctx.fillStyle = b.color;
    roundRect(b.x, b.y + sink, b.w, b.h - lift, r);
    ctx.fill();

    const t = (now - b.playedAt) / 1000;
    let jump = 0, wiggle = 0, squash = 1;
    if (t < BOUNCE_FOR) {
      const k = t / BOUNCE_FOR;
      jump = Math.sin(k * Math.PI) * Math.min(b.w, b.h) * 0.08;
      wiggle = 0.15 * Math.sin(t * 22) * (1 - k);
      squash = 1 + 0.08 * Math.sin(t * 18) * (1 - k);
    }
    const s = Math.min(b.w, b.h - lift) * 0.36;
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + sink + (b.h - lift) / 2 - jump);
    ctx.rotate(wiggle);
    ctx.scale(s * squash, s / squash);
    T.drawFigure(ctx, b.fig);
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fdf7ff';
    ctx.fillRect(0, 0, W, H);

    for (const b of buttons) drawButton(b, now);

    notes = notes.filter(n => (n.life += dt) < n.max + n.delay);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of notes) {
      const age = n.life - n.delay;
      if (age < 0) continue;
      n.x += n.vx * dt + Math.sin(age * 8) * 0.6;
      n.y += n.vy * dt;
      ctx.globalAlpha = Math.min(1, (n.max - age) / 0.4);
      ctx.fillStyle = n.color;
      ctx.font = `bold ${Math.round(n.size)}px sans-serif`;
      ctx.fillText(n.glyph, n.x, n.y);
    }
    ctx.globalAlpha = 1;

    parts = T.drawParticles(ctx, parts, dt, H);
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
