(() => {
  'use strict';
  const T = window.Toddler;
  const { TAU, COLORS, rand } = T;

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const BACKGROUNDS = [
    ['#eefbf3', '#d4f2df'],
    ['#eef4ff', '#d6e4ff'],
    ['#fff5ec', '#ffe3c9'],
    ['#f6efff', '#e4d8ff'],
  ];
  const FRICTION = 0.5;      // fraction of speed kept per second
  const KICK = 12;           // extra speed per pixel of overlap, so a plain poke still flicks things
  const BOUNCE = 0.8;        // how bouncy things are against each other
  const SUBSTEPS = 3;
  const REFILL_DELAY = 2300;

  let W = 0, H = 0, dpr = 1, fingerR = 30;
  let things = [];
  let parts = [];
  let round = 0;
  let clearing = false;
  let last = performance.now();

  function easeOutBack(x) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  // ---------- rounds ----------

  function newRound() {
    round++;
    clearing = false;
    const m = Math.min(W, H);
    const r = Math.max(40, Math.min(100, m * 0.12));
    const want = Math.max(4, Math.min(7, Math.round((W * H) / (r * r * 26))));
    const placed = [];
    for (let tries = 0; tries < 3000 && placed.length < want; tries++) {
      const x = rand(r * 2, W - r * 2);
      const y = rand(r * 2, H - r * 2);
      if (placed.every(p => Math.hypot(p.x - x, p.y - y) > r * 2.5)) placed.push({ x, y });
    }
    const now = performance.now();
    things = placed.map((p, i) => ({
      x: p.x, y: p.y, vx: 0, vy: 0,
      r: r * rand(0.9, 1.1),
      ball: Math.random() < 0.5,
      fig: Math.floor(Math.random() * T.FIGURES.length),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: 0, squash: 0, hitAt: 0,
      born: now + i * 120,
    }));
  }

  function celebrate() {
    clearing = true;
    T.confetti(parts, W, H);
    T.cheer();
    setTimeout(newRound, REFILL_DELAY);
  }

  // ---------- input ----------

  // pointerId -> finger; velocity comes from how far it moved between frames.
  const fingers = new Map();
  const reach = e => Math.min(50, Math.max(e.width || 0, e.height || 0) / 2);

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, vx: 0, vy: 0, reach: reach(e) });
  }, { passive: false });

  canvas.addEventListener('pointermove', e => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    f.x = e.clientX;
    f.y = e.clientY;
    f.reach = reach(e);
  });

  // A lifted finger still pushes on the next frame, so even the quickest tap lands.
  const lift = e => {
    const f = fingers.get(e.pointerId);
    if (f) f.up = true;
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

  // ---------- physics ----------

  function bonk(t, strength) {
    const now = performance.now();
    t.squash = Math.min(1, Math.max(t.squash, strength / 600));
    if (now - t.hitAt < 140) return;
    t.hitAt = now;
    T.noise('bonk', 900 - t.r * 5);
  }

  function step(dt, now) {
    let travel = 0;
    for (const f of fingers.values()) {
      f.vx = (f.x - f.lx) / dt;
      f.vy = (f.y - f.ly) / dt;
      travel = Math.max(travel, Math.hypot(f.x - f.lx, f.y - f.ly));
    }
    const live = things.filter(t => now >= t.born);
    // Enough substeps that a finger never jumps more than half its width, however far it moved.
    const steps = Math.max(SUBSTEPS, Math.min(60, Math.ceil(travel / (fingerR * 0.5))));
    const h = dt / steps;

    for (let s = 1; s <= steps; s++) {
      // Fingers: sweep along the path the finger took this frame so fast swipes don't skip over things.
      for (const f of fingers.values()) {
        const fx = f.lx + (f.x - f.lx) * s / steps;
        const fy = f.ly + (f.y - f.ly) * s / steps;
        for (const t of live) {
          let dx = t.x - fx, dy = t.y - fy;
          let d = Math.hypot(dx, dy);
          const minD = t.r + fingerR + f.reach;
          if (d >= minD) continue;
          if (d < 0.01) { const a = rand(0, TAU); dx = Math.cos(a); dy = Math.sin(a); d = 1; }
          const nx = dx / d, ny = dy / d;
          const overlap = minD - d;
          t.x += nx * overlap * 0.5;
          t.y += ny * overlap * 0.5;
          const vn = t.vx * nx + t.vy * ny;
          const want = Math.min(2500, Math.max(0, f.vx * nx + f.vy * ny) * 1.1) + overlap * KICK;
          if (vn < want) {
            t.vx += nx * (want - vn);
            t.vy += ny * (want - vn);
            if (want - vn > 80) bonk(t, want - vn);
          }
        }
      }

      // Things bump into each other like bumper cars.
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i], b = live[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          const minD = a.r + b.r;
          if (d >= minD || d < 0.01) continue;
          const nx = dx / d, ny = dy / d;
          const overlap = (minD - d) / 2;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv >= 0) continue;
          const imp = -(1 + BOUNCE) * rv / 2;
          a.vx -= nx * imp; a.vy -= ny * imp;
          b.vx += nx * imp; b.vy += ny * imp;
          if (-rv > 150) { bonk(a, -rv); bonk(b, -rv); }
        }
      }

      for (const t of live) {
        t.x += t.vx * h;
        t.y += t.vy * h;
        t.rot += t.vx / t.r * h * 0.5;
      }
    }

    for (const [id, f] of fingers) {
      f.lx = f.x; f.ly = f.y;
      if (f.up) fingers.delete(id);
    }

    const keep = Math.pow(FRICTION, dt);
    for (const t of live) {
      // Once the middle is past an edge, it slides the rest of the way out by itself.
      if (t.x < 0) t.vx -= 500 * dt;
      if (t.x > W) t.vx += 500 * dt;
      if (t.y < 0) t.vy -= 500 * dt;
      if (t.y > H) t.vy += 500 * dt;
      const outside = t.x < 0 || t.x > W || t.y < 0 || t.y > H;
      if (!outside) { t.vx *= keep; t.vy *= keep; }
      t.squash *= Math.pow(0.02, dt);

      if (t.x < -t.r || t.x > W + t.r || t.y < -t.r || t.y > H + t.r) {
        t.gone = true;
        T.noise('whoosh');
        T.sparkle(parts, Math.max(0, Math.min(W, t.x)), Math.max(0, Math.min(H, t.y)), 12);
        if (navigator.vibrate) navigator.vibrate(20);
      }
    }
    things = things.filter(t => !t.gone);
    if (things.length === 0 && !clearing) celebrate();
  }

  // ---------- drawing ----------

  function drawThing(t, now) {
    const grow = easeOutBack(Math.min(1, (now - t.born) / 450));
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(grow, grow);

    ctx.fillStyle = 'rgba(40,30,60,0.12)';
    ctx.beginPath(); ctx.ellipse(t.r * 0.08, t.r * 0.14, t.r, t.r * 0.96, 0, 0, TAU); ctx.fill();

    const sq = t.squash * 0.18;
    ctx.scale(1 + sq, 1 - sq);
    if (t.ball) {
      ctx.fillStyle = t.color;
      ctx.beginPath(); ctx.arc(0, 0, t.r, 0, TAU); ctx.fill();
      ctx.save();
      ctx.rotate(t.rot);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      T.starPath(ctx, 0, 0, t.r * 0.45, t.r * 0.2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = t.r * 0.08;
      ctx.beginPath(); ctx.arc(0, 0, t.r * 0.7, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(-t.r * 0.4, -t.r * 0.45, t.r * 0.15, t.r * 0.25, -0.6, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, t.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = t.color;
      ctx.lineWidth = t.r * 0.1;
      ctx.beginPath(); ctx.arc(0, 0, t.r * 0.95, 0, TAU); ctx.stroke();
      ctx.rotate(t.rot);
      ctx.scale(t.r * 0.72, t.r * 0.72);
      T.drawFigure(ctx, t.fig);
    }
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    step(dt, now);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = BACKGROUNDS[round % BACKGROUNDS.length];
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, bg[0]);
    grad.addColorStop(1, bg[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (const t of things) {
      if (now >= t.born) drawThing(t, now);
    }

    parts = T.drawParticles(ctx, parts, dt, H);
    T.drawTouches(ctx, dt);
    requestAnimationFrame(frame);
  }

  function resize() {
    const oldW = W, oldH = H;
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    fingerR = Math.max(22, Math.min(W, H) * 0.06);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (oldW > 50 && oldH > 50) {
      for (const t of things) { t.x *= W / oldW; t.y *= H / oldH; }
    } else {
      newRound(); // first real size (a window can start out 0x0)
    }
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
