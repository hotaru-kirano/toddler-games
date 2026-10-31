(() => {
  'use strict';
  const T = window.Toddler;
  const { TAU, NOTES, rand } = T;

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const paint = document.createElement('canvas');     // light silhouette that strokes color in
  const pctx = paint.getContext('2d');
  const outline = document.createElement('canvas');   // dark rim drawn just outside the silhouette
  const octx = outline.getContext('2d');

  const BACKDROPS = ['#fff6d6', '#e3f4ff', '#ffe8ef', '#e9ffe6', '#f1eaff'];
  const EMPTY = '#ece8f4';
  const RIM = '#6b5a7b';
  const DONE_AT = 0.85;      // fraction colored before the rest fills by itself
  const SHOW_FOR = 3.0;      // seconds the finished figure is shown
  const SWAP_FOR = 0.45;     // seconds to shrink away / grow back in

  let W = 0, H = 0, dpr = 1, brush = 30, size = 100;
  let cells = null, cols = 0, rows = 0, cell = 1, total = 1, filled = 0; // cells: 0 outside, 1 empty, 2 colored
  let state = 'play';        // play | done | out | in
  let stateAt = 0;
  let round = 0;
  let fig = T.otherFigure(-1);
  let hue = rand(0, 360);
  let parts = [];
  let last = performance.now();

  function easeOutBack(x) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  // ---------- figure setup ----------

  function silhouette(c, color) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, W, H);
    c.translate(W / 2, H / 2);
    c.scale(size, size);
    T.drawFigure(c, fig, color);
  }

  function setupFigure() {
    silhouette(pctx, EMPTY);

    const dark = document.createElement('canvas');
    dark.width = outline.width; dark.height = outline.height;
    const dctx = dark.getContext('2d');
    silhouette(dctx, RIM);
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, outline.width, outline.height);
    const off = 3.5 * dpr;
    for (let a = 0; a < 8; a++) {
      octx.drawImage(dark, Math.cos(a * TAU / 8) * off, Math.sin(a * TAU / 8) * off);
    }

    // Only cells whose centre sits inside the figure count toward "done".
    cell = brush * 0.5;
    cols = Math.ceil(W / cell);
    rows = Math.ceil(H / cell);
    cells = new Uint8Array(cols * rows);
    const img = pctx.getImageData(0, 0, paint.width, paint.height).data;
    total = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = Math.min(paint.width - 1, Math.floor((c + 0.5) * cell * dpr));
        const py = Math.min(paint.height - 1, Math.floor((r + 0.5) * cell * dpr));
        if (img[(py * paint.width + px) * 4 + 3] > 200) {
          cells[r * cols + c] = 1;
          total++;
        }
      }
    }
    total = Math.max(1, total);
    filled = 0;
  }

  // ---------- painting ----------

  function distToSeg(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2)) : 0;
    return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
  }

  let lastChime = 0;

  function stroke(x0, y0, x1, y1) {
    const color = `hsl(${hue % 360}, 90%, 60%)`;
    hue += Math.hypot(x1 - x0, y1 - y0) * 0.4;
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.globalCompositeOperation = 'source-atop'; // color only lands on the figure
    pctx.strokeStyle = pctx.fillStyle = color;
    pctx.lineCap = 'round';
    pctx.lineWidth = brush * 2;
    pctx.beginPath(); pctx.moveTo(x0, y0); pctx.lineTo(x1, y1); pctx.stroke();
    pctx.beginPath(); pctx.arc(x1, y1, brush, 0, TAU); pctx.fill();

    const c0 = Math.max(0, Math.floor((Math.min(x0, x1) - brush) / cell));
    const c1 = Math.min(cols - 1, Math.floor((Math.max(x0, x1) + brush) / cell));
    const r0 = Math.max(0, Math.floor((Math.min(y0, y1) - brush) / cell));
    const r1 = Math.min(rows - 1, Math.floor((Math.max(y0, y1) + brush) / cell));
    let fresh = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (cells[i] !== 1) continue;
        if (distToSeg((c + 0.5) * cell, (r + 0.5) * cell, x0, y0, x1, y1) <= brush) {
          cells[i] = 2;
          fresh++;
        }
      }
    }
    if (!fresh) return;
    filled += fresh;
    const progress = filled / total;

    const now = performance.now();
    if (now - lastChime > 90) {
      lastChime = now;
      T.chime(NOTES[Math.min(NOTES.length - 1, Math.floor(progress * NOTES.length))]);
    }
    if (progress >= DONE_AT) finish();
  }

  // ---------- rounds ----------

  function finish() {
    state = 'done';
    stateAt = performance.now();
    T.confetti(parts, W, H);
    T.cheer();
    T.roundDone();
    T.say(T.FIGURES[fig].name, 700);
    if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
  }

  function setState(s) {
    state = s;
    stateAt = performance.now();
  }

  // ---------- input ----------

  // Every finger on the screen, tracked through round changes too, so a toddler who never
  // lifts their finger keeps painting as soon as the next figure appears.
  const down = new Map(); // pointerId -> last {x, y}

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    down.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state === 'play') stroke(e.clientX, e.clientY, e.clientX, e.clientY);
    else T.sparkle(parts, e.clientX, e.clientY);
  }, { passive: false });

  canvas.addEventListener('pointermove', e => {
    const p = down.get(e.pointerId);
    if (!p) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of (evs.length ? evs : [e])) {
      if (state === 'play') stroke(p.x, p.y, ev.clientX, ev.clientY);
      p.x = ev.clientX; p.y = ev.clientY;
    }
  });

  canvas.addEventListener('pointerup', e => down.delete(e.pointerId));
  canvas.addEventListener('pointercancel', e => down.delete(e.pointerId));

  // ---------- layout ----------

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    brush = Math.max(24, Math.min(W, H) * 0.07);
    size = Math.min(W, H) * 0.4;
    canvas.width = paint.width = outline.width = Math.round(W * dpr);
    canvas.height = paint.height = outline.height = Math.round(H * dpr);
    setupFigure(); // a new size means a fresh, uncolored figure
  }

  // ---------- drawing ----------

  function frame(now) {
    requestAnimationFrame(frame); // first, so one failed frame can't stop the loop
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - stateAt) / 1000;

    let scale = 1, wiggle = 0, reveal = 0;
    if (state === 'done') {
      reveal = Math.min(1, t / 0.6);
      scale = 1 + 0.1 * Math.sin(t * 9) * Math.exp(-t * 1.5);
      wiggle = 0.06 * Math.sin(t * 7) * Math.exp(-t * 1.2);
      if (t >= SHOW_FOR) setState('out');
    } else if (state === 'out') {
      const k = Math.min(1, t / SWAP_FOR);
      reveal = 1;
      scale = Math.max(0.001, 1 - k * k);
      if (k >= 1) {
        round++;
        fig = T.otherFigure(fig);
        setupFigure();
        setState('in');
      }
    } else if (state === 'in') {
      const k = Math.min(1, t / (SWAP_FOR * 1.4));
      scale = Math.max(0.001, easeOutBack(k));
      if (k >= 1) {
        setState('play');
        for (const p of down.values()) stroke(p.x, p.y, p.x, p.y);
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BACKDROPS[round % BACKDROPS.length];
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.beginPath(); ctx.ellipse(0, size * 0.92, size * 0.7 * scale, size * 0.1 * scale, 0, 0, TAU); ctx.fill();
    ctx.rotate(wiggle);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(outline, 0, 0, W, H);
    ctx.drawImage(paint, 0, 0, W, H);
    if (reveal > 0) {
      ctx.globalAlpha = reveal;
      ctx.translate(W / 2, H / 2);
      ctx.scale(size, size);
      T.drawFigure(ctx, fig);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    parts = T.drawParticles(ctx, parts, dt, H);
    T.drawTouches(ctx, dt);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
