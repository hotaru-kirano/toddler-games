(() => {
  'use strict';
  const T = window.Toddler;
  const { COLORS, rand, pick } = T;

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  // One note per color so each color always sings the same note.
  const NOTES = T.NOTES.slice(0, COLORS.length);
  const BACKGROUNDS = [
    ['#fff0f5', '#ffd9e8'],
    ['#eef7ff', '#cfe8ff'],
    ['#effff1', '#d3f5d8'],
    ['#fff9e8', '#ffecb8'],
    ['#f4efff', '#e0d4ff'],
  ];
  const KINDS = ['bubble', 'balloon', 'star'];
  const REFILL_DELAY = 2300;

  let W = 0, H = 0, dpr = 1;
  let items = [];
  let parts = [];
  let rings = [];
  let round = 0;
  let clearing = false;
  let last = performance.now();

  const bob = (it, now) => Math.sin(now / 1000 * 1.8 + it.phase) * it.r * 0.07;

  function easeOutBack(x) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  // ---------- layout ----------

  function resize() {
    const oldW = W, oldH = H;
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (oldW > 50 && oldH > 50) {
      for (const it of items) { it.x *= W / oldW; it.y *= H / oldH; }
    } else {
      newRound(); // first real size (a window can start out 0x0)
    }
  }

  function newRound() {
    round++;
    clearing = false;
    const m = Math.min(W, H);
    const r = Math.max(44, Math.min(110, m * 0.12));
    const want = Math.max(5, Math.min(12, Math.round((W * H) / (r * r * 14))));
    const placed = [];
    for (let tries = 0; tries < 3000 && placed.length < want; tries++) {
      const x = rand(r * 1.2, W - r * 1.2);
      const y = rand(r * 1.4, H - r * 2.1); // room below for balloon strings
      if (placed.every(p => Math.hypot(p.x - x, p.y - y) > r * 2.3)) placed.push({ x, y });
    }
    const now = performance.now();
    items = placed.map((p, i) => ({
      x: p.x, y: p.y,
      r: r * rand(0.92, 1.08),
      ci: Math.floor(Math.random() * COLORS.length),
      kind: pick(KINDS),
      born: now + i * 110,
      phase: rand(0, Math.PI * 2),
    }));
  }

  // ---------- game actions ----------

  // A chubby finger or a whole palm reports a bigger contact; let that reach further.
  const reach = e => Math.min(60, Math.max(e.width || 0, e.height || 0) / 2);

  function hit(x, y, extra = 0) {
    const now = performance.now();
    let best = -1, bestD = Infinity;
    items.forEach((it, i) => {
      if (now < it.born) return;
      const d = Math.hypot(x - it.x, y - (it.y + bob(it, now)));
      if (d < it.r * 1.25 + extra && d < bestD) { best = i; bestD = d; }
    });
    return best;
  }

  function pop(i) {
    const it = items[i];
    items.splice(i, 1);
    const color = COLORS[it.ci];
    const y = it.y + bob(it, performance.now());
    T.burst(parts, it.x, y, color, it.r);
    rings.push({ x: it.x, y, r: it.r, color, t: 0 });
    T.popSound(NOTES[it.ci]);
    if (navigator.vibrate) navigator.vibrate(25);
    if (items.length === 0 && !clearing) celebrate();
  }

  function celebrate() {
    clearing = true;
    setTimeout(newRound, REFILL_DELAY); // first: the next round must come even if an effect fails
    T.confetti(parts, W, H);
    T.cheer();
    T.roundDone();
  }

  // ---------- input ----------

  const down = new Set();

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    down.add(e.pointerId);
    const i = hit(e.clientX, e.clientY, reach(e));
    if (i >= 0) {
      pop(i);
    } else {
      T.sparkle(parts, e.clientX, e.clientY);
      T.chime(pick(T.NOTES) * 2, 0.06);
    }
  }, { passive: false });

  // Dragging a finger across things pops them too.
  canvas.addEventListener('pointermove', e => {
    if (!down.has(e.pointerId)) return;
    const i = hit(e.clientX, e.clientY, reach(e));
    if (i >= 0) pop(i);
  });

  canvas.addEventListener('pointerup', e => down.delete(e.pointerId));
  canvas.addEventListener('pointercancel', e => down.delete(e.pointerId));

  // ---------- drawing ----------

  function shine(r) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.16, r * 0.27, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function face(r) {
    ctx.fillStyle = 'rgba(255,120,150,0.45)';
    ctx.beginPath(); ctx.arc(-r * 0.5, r * 0.18, r * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.5, r * 0.18, r * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b2b3b';
    ctx.beginPath(); ctx.arc(-r * 0.28, -r * 0.1, r * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.28, -r * 0.1, r * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3b2b3b';
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, r * 0.06, r * 0.28, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();
  }

  function drawItem(it, now, s) {
    const color = COLORS[it.ci];
    const t = now / 1000;
    const r = it.r;
    ctx.save();
    ctx.translate(it.x, it.y + bob(it, now));
    ctx.scale(s, s);
    if (it.kind === 'balloon') {
      ctx.rotate(Math.sin(t * 1.3 + it.phase) * 0.06);
      ctx.strokeStyle = 'rgba(80,80,100,0.45)';
      ctx.lineWidth = Math.max(2, r * 0.04);
      ctx.beginPath();
      ctx.moveTo(0, r * 1.05);
      ctx.bezierCurveTo(r * 0.25, r * 1.35, -r * 0.25, r * 1.6, r * 0.05, r * 1.9);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.95); ctx.lineTo(-r * 0.12, r * 1.13); ctx.lineTo(r * 0.12, r * 1.13);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.88, r * 1.02, 0, 0, Math.PI * 2); ctx.fill();
      shine(r);
    } else if (it.kind === 'star') {
      ctx.rotate(Math.sin(t * 1.1 + it.phase) * 0.12);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineJoin = 'round';
      ctx.lineWidth = r * 0.18;
      T.starPath(ctx, 0, 0, r, r * 0.5);
      ctx.fill(); ctx.stroke();
      face(r * 0.75);
    } else {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      shine(r);
      face(r);
    }
    ctx.restore();
  }

  function frame(now) {
    requestAnimationFrame(frame); // first, so one failed frame can't stop the loop
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = BACKGROUNDS[round % BACKGROUNDS.length];
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, bg[0]);
    grad.addColorStop(1, bg[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (const it of items) {
      if (now < it.born) continue;
      drawItem(it, now, easeOutBack(Math.min(1, (now - it.born) / 500)));
    }

    rings = rings.filter(rg => (rg.t += dt) < 0.35);
    for (const rg of rings) {
      const k = rg.t / 0.35;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = rg.r * 0.15 * (1 - k) + 0.5;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r * (1 + k * 0.8), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    parts = T.drawParticles(ctx, parts, dt, H);
    T.drawTouches(ctx, dt);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
