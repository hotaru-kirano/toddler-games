(() => {
  'use strict';
  const T = window.Toddler;
  const { TAU, NOTES } = T;

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const cover = document.createElement('canvas');
  const cctx = cover.getContext('2d');

  const COVERS = [
    ['#7b5cff', '#9a84ff'],
    ['#ff5d8f', '#ff86ab'],
    ['#1fb5a8', '#4fcfc4'],
    ['#ff9f1c', '#ffb956'],
    ['#3a86ff', '#6aa5ff'],
    ['#45b045', '#70c870'],
  ];
  const BACKDROPS = ['#fff6d6', '#e3f4ff', '#ffe8ef', '#e9ffe6', '#f1eaff'];
  const DONE_AT = 0.8;       // fraction of the figure uncovered before the rest clears by itself
  const SHOW_FOR = 3.0;      // seconds the figure stays uncovered
  const DROP_FOR = 0.8;      // seconds for the new cover to fall into place

  let W = 0, H = 0, dpr = 1, brush = 40;
  // wiped: cells the finger has cleared; onFig: cells over the figure, the only ones that count.
  let wiped = null, onFig = null, cols = 0, rows = 0, cell = 1, total = 1, cleared = 0;
  let state = 'play';        // play | reveal | refill
  let stateAt = 0;
  let round = 0;
  let fig = T.otherFigure(-1);
  let backdrop = BACKDROPS[0];
  let parts = [];
  let last = performance.now();

  function easeOutBounce(x) {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  }

  // ---------- cover ----------

  const figSize = () => Math.min(W, H) * 0.36;

  function setupGrid() {
    cell = brush * 0.6;
    cols = Math.ceil(W / cell);
    rows = Math.ceil(H / cell);
    wiped = new Uint8Array(cols * rows);
    markFigure();
  }

  // Finds the cells that sit over the current figure. Wiping empty background is free play;
  // only uncovering the figure moves the round along.
  function markFigure() {
    const sil = document.createElement('canvas');
    sil.width = cover.width;
    sil.height = cover.height;
    const sctx = sil.getContext('2d');
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.translate(W / 2, H / 2);
    sctx.scale(figSize(), figSize());
    T.drawFigure(sctx, fig, '#000');
    const img = sctx.getImageData(0, 0, sil.width, sil.height).data;
    onFig = new Uint8Array(cols * rows);
    total = 0;
    cleared = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = Math.min(sil.width - 1, Math.floor((c + 0.5) * cell * dpr));
        const py = Math.min(sil.height - 1, Math.floor((r + 0.5) * cell * dpr));
        if (img[(py * sil.width + px) * 4 + 3] < 128) continue;
        const i = r * cols + c;
        onFig[i] = 1;
        total++;
        cleared += wiped[i];
      }
    }
    total = Math.max(1, total);
  }

  function paintCover() {
    const [base, dot] = COVERS[round % COVERS.length];
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cctx.globalCompositeOperation = 'source-over';
    cctx.fillStyle = base;
    cctx.fillRect(0, 0, W, H);
    cctx.fillStyle = dot;
    const step = Math.max(40, Math.min(W, H) * 0.12);
    for (let y = 0, row = 0; y < H + step; y += step * 0.87, row++) {
      for (let x = (row % 2) * step / 2; x < W + step; x += step) {
        cctx.beginPath(); cctx.arc(x, y, step * 0.18, 0, TAU); cctx.fill();
      }
    }
    setupGrid();
  }

  // After a resize, rebuild the wiped/unwiped map from what the cover actually shows.
  function recountGrid() {
    const img = cctx.getImageData(0, 0, cover.width, cover.height).data;
    cleared = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = Math.min(cover.width - 1, Math.floor((c + 0.5) * cell * dpr));
        const py = Math.min(cover.height - 1, Math.floor((r + 0.5) * cell * dpr));
        const i = r * cols + c;
        wiped[i] = img[(py * cover.width + px) * 4 + 3] < 128 ? 1 : 0;
        cleared += wiped[i] & onFig[i];
      }
    }
  }

  function distToSeg(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2)) : 0;
    return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
  }

  let lastChime = 0;

  function wipe(x0, y0, x1, y1) {
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cctx.globalCompositeOperation = 'destination-out';
    cctx.lineCap = 'round';
    cctx.lineWidth = brush * 2;
    cctx.beginPath(); cctx.moveTo(x0, y0); cctx.lineTo(x1, y1); cctx.stroke();
    cctx.beginPath(); cctx.arc(x1, y1, brush, 0, TAU); cctx.fill();

    const c0 = Math.max(0, Math.floor((Math.min(x0, x1) - brush) / cell));
    const c1 = Math.min(cols - 1, Math.floor((Math.max(x0, x1) + brush) / cell));
    const r0 = Math.max(0, Math.floor((Math.min(y0, y1) - brush) / cell));
    const r1 = Math.min(rows - 1, Math.floor((Math.max(y0, y1) + brush) / cell));
    let fresh = 0, figFresh = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (wiped[i]) continue;
        if (distToSeg((c + 0.5) * cell, (r + 0.5) * cell, x0, y0, x1, y1) <= brush) {
          wiped[i] = 1;
          fresh++;
          figFresh += onFig[i];
        }
      }
    }
    if (!fresh) return;
    cleared += figFresh;
    const progress = cleared / total;

    const now = performance.now();
    if (now - lastChime > 90) {
      lastChime = now;
      T.chime(NOTES[Math.min(NOTES.length - 1, Math.floor(progress * NOTES.length))]);
    }
    if (progress >= DONE_AT) reveal();
  }

  // ---------- rounds ----------

  function reveal() {
    state = 'reveal';
    stateAt = performance.now();
    T.confetti(parts, W, H);
    T.cheer();
    T.roundDone();
    T.say(T.FIGURES[fig].name, 700);
    if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
  }

  function refill() {
    state = 'refill';
    stateAt = performance.now();
    round++;
    paintCover();
  }

  // ---------- input ----------

  // Every finger on the screen, tracked through round changes too, so a toddler who never
  // lifts their finger keeps wiping as soon as the next cover lands.
  const down = new Map(); // pointerId -> last {x, y}

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    down.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state === 'play') wipe(e.clientX, e.clientY, e.clientX, e.clientY);
    else T.sparkle(parts, e.clientX, e.clientY);
  }, { passive: false });

  canvas.addEventListener('pointermove', e => {
    const p = down.get(e.pointerId);
    if (!p) return;
    // Coalesced events keep fast swipes smooth on phones.
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of (evs.length ? evs : [e])) {
      if (state === 'play') wipe(p.x, p.y, ev.clientX, ev.clientY);
      p.x = ev.clientX; p.y = ev.clientY;
    }
  });

  canvas.addEventListener('pointerup', e => down.delete(e.pointerId));
  canvas.addEventListener('pointercancel', e => down.delete(e.pointerId));

  // ---------- layout ----------

  function resize() {
    let old = null;
    if (W && H) {
      old = document.createElement('canvas');
      old.width = cover.width; old.height = cover.height;
      old.getContext('2d').drawImage(cover, 0, 0);
    }
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    brush = Math.max(28, Math.min(W, H) * 0.085);
    canvas.width = cover.width = Math.round(W * dpr);
    canvas.height = cover.height = Math.round(H * dpr);
    if (old) {
      setupGrid();
      cctx.setTransform(1, 0, 0, 1, 0, 0);
      cctx.globalCompositeOperation = 'source-over';
      cctx.drawImage(old, 0, 0, cover.width, cover.height);
      recountGrid();
    } else {
      paintCover();
    }
  }

  // ---------- drawing ----------

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - stateAt) / 1000;

    let coverAlpha = 1, coverY = 0, bounce = 1, wiggle = 0;
    if (state === 'reveal') {
      coverAlpha = Math.max(0, 1 - t / 0.6);
      bounce = 1 + 0.12 * Math.sin(t * 9) * Math.exp(-t * 1.5);
      wiggle = 0.08 * Math.sin(t * 7) * Math.exp(-t * 1.2);
      if (t >= SHOW_FOR) refill();
    } else if (state === 'refill') {
      coverY = -H * (1 - easeOutBounce(Math.min(1, t / DROP_FOR)));
      if (t >= DROP_FOR) {
        // Cover is fully down, so the swap underneath is never seen.
        fig = T.otherFigure(fig);
        markFigure();
        backdrop = BACKDROPS[round % BACKDROPS.length];
        state = 'play';
        for (const p of down.values()) wipe(p.x, p.y, p.x, p.y);
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, W, H);

    const s = figSize();
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.ellipse(0, 0.88, 0.7, 0.1, 0, 0, TAU); ctx.fill();
    ctx.rotate(wiggle);
    ctx.scale(bounce, bounce);
    T.drawFigure(ctx, fig);
    ctx.restore();

    if (coverAlpha > 0) {
      ctx.globalAlpha = coverAlpha;
      ctx.drawImage(cover, 0, coverY, W, H);
      ctx.globalAlpha = 1;
    }

    parts = T.drawParticles(ctx, parts, dt, H);
    T.drawTouches(ctx, dt);
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
