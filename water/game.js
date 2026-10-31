(() => {
  'use strict';
  const T = window.Toddler;
  const { TAU, rand, pick } = T;

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const BACKDROPS = [
    ['#eaf6ff', '#f6e7d4'],
    ['#fff4e6', '#e9d8f5'],
    ['#f0fff0', '#f3e1c8'],
    ['#fdf0ff', '#d8ecf7'],
  ]; // wall, table
  const PITCHERS = ['#ff8fab', '#8ecae6', '#b5e48c', '#ffd166', '#cdb4db'];
  const FILL_TIME = 7;       // seconds of pouring to fill up
  const MAX_FILL = 0.88;     // the "full" line, as a fraction of the inside height
  const FULL_FOR = 3.4;
  const DRAIN_FOR = 1.6;
  const GROW_FOR = 0.5;
  const TILT = -1.05;        // pitcher angle while pouring
  const GLASS = 'rgba(140,190,235,0.95)';

  // Each container: size (relative to the base size), where its inside starts, the outline path,
  // what the water looks like, and what happens when it's full.
  const KINDS = {
    tank: {
      w: 1, h: 0.8, top: 0.04, water: 'rgba(64,180,240,0.72)', solid: '#40b4f0', say: 'Fishies!',
      path(c, w, h) {
        c.beginPath();
        if (c.roundRect) c.roundRect(-w / 2, 0, w, h, [w * 0.02, w * 0.02, w * 0.07, w * 0.07]);
        else c.rect(-w / 2, 0, w, h);
      },
      back(w, h, t) {
        for (let i = 0; i < 18; i++) {
          const x = -w / 2 + (i + 0.5) * w / 18;
          circle(x, h - w * 0.03 - (i % 2) * w * 0.012, w * 0.03, ['#f4a261', '#e9c46a', '#e76f51'][i % 3]);
        }
        ctx.strokeStyle = '#52b852';
        ctx.lineWidth = w * 0.025;
        ctx.lineCap = 'round';
        for (const sx of [-0.32, -0.26, 0.34]) {
          ctx.beginPath();
          ctx.moveTo(sx * w, h - w * 0.04);
          for (let k = 1; k <= 6; k++) {
            ctx.lineTo(sx * w + Math.sin(t * 1.5 + k + sx * 9) * w * 0.025, h - w * 0.04 - k * h * 0.07);
          }
          ctx.stroke();
        }
      },
      front(w, h) {
        outline(this, w, h, w * 0.03, GLASS);
        box(-w / 2 - w * 0.02, -w * 0.02, w * 1.04, w * 0.04, w * 0.015, '#7aa6c9');
      },
    },
    tub: {
      w: 1, h: 0.72, top: 0.12, water: 'rgba(120,205,255,0.7)', solid: '#78cdff', say: 'Bath time!',
      path(c, w, h) {
        c.beginPath();
        c.moveTo(-w / 2, h * 0.12);
        c.lineTo(w / 2, h * 0.12);
        c.lineTo(w / 2, h * 0.5);
        c.quadraticCurveTo(w / 2, h, w * 0.18, h);
        c.lineTo(-w * 0.18, h);
        c.quadraticCurveTo(-w / 2, h, -w / 2, h * 0.5);
        c.closePath();
      },
      back() {},
      front(w, h) {
        for (const sx of [-1, 1]) oval(sx * w * 0.3, h + w * 0.02, w * 0.06, w * 0.035, '#f2c14e');
        outline(this, w, h, w * 0.05, '#ffffff');
        outline(this, w, h, w * 0.012, '#e3b7c8');
        box(-w / 2 - w * 0.03, h * 0.12 - w * 0.03, w * 1.06, w * 0.05, w * 0.025, '#ffffff');
        box(w * 0.36, h * 0.12 - w * 0.12, w * 0.05, w * 0.1, w * 0.02, '#c0c7d6');
        box(w * 0.3, h * 0.12 - w * 0.13, w * 0.12, w * 0.035, w * 0.015, '#c0c7d6');
      },
    },
    jug: {
      w: 0.66, h: 1, top: 0.0, water: 'rgba(255,170,60,0.78)', solid: '#ffaa3c', say: 'Yummy!',
      path(c, w, h) {
        c.beginPath();
        c.moveTo(-w * 0.3, 0);
        c.lineTo(w * 0.3, 0);
        c.quadraticCurveTo(w * 0.3, h * 0.18, w * 0.5, h * 0.32);
        c.lineTo(w * 0.5, h * 0.9);
        c.quadraticCurveTo(w * 0.5, h, w * 0.38, h);
        c.lineTo(-w * 0.38, h);
        c.quadraticCurveTo(-w * 0.5, h, -w * 0.5, h * 0.9);
        c.lineTo(-w * 0.5, h * 0.32);
        c.quadraticCurveTo(-w * 0.3, h * 0.18, -w * 0.3, 0);
        c.closePath();
      },
      back() {},
      front(w, h) {
        ctx.strokeStyle = GLASS;
        ctx.lineWidth = w * 0.07;
        ctx.beginPath(); ctx.arc(w * 0.5, h * 0.58, h * 0.2, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        outline(this, w, h, w * 0.04, GLASS);
      },
    },
  };
  const KIND_NAMES = Object.keys(KINDS);

  let W = 0, H = 0, dpr = 1, base = 200;
  let kind = pick(KIND_NAMES);
  let level = 0;
  let tilt = 0, flow = 0, stir = 0;
  let state = 'grow';        // grow | play | full | drain
  let stateAt = performance.now();
  let round = 0;
  let bubbles = [];
  let fish = [];
  let parts = [];
  let last = performance.now();

  // ---------- drawing helpers ----------

  function circle(x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function oval(x, y, rx, ry, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  }
  function box(x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fill();
  }
  function outline(k, w, h, width, color) {
    k.path(ctx, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function easeOutBack(x) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  // ---------- layout ----------

  function dims() {
    const k = KINDS[kind];
    const w = base * k.w, h = base * k.h;
    const bottom = H * 0.86;
    const p = base * 0.22; // pitcher size
    return {
      k, w, h, p,
      cx: W / 2, top: bottom - h, bottom,
      // Place the pitcher so its spout ends up over the middle when tipped.
      px: W / 2 + p * 1.04, py: bottom - h - p * 0.95,
    };
  }

  function waterTop(d) {
    const inside = d.h * (1 - d.k.top);
    return d.h - level * inside * MAX_FILL;
  }

  function surfaceAt(d, x, t) {
    const amp = d.h * (0.008 + stir * 0.022);
    return waterTop(d) + Math.sin(x / d.w * TAU * 1.5 + t * 5) * amp + Math.sin(x / d.w * TAU * 2.7 - t * 3.3) * amp * 0.5;
  }

  function spout(d) {
    const sx = -0.75 * d.p, sy = -0.75 * d.p;
    const c = Math.cos(tilt), s = Math.sin(tilt);
    return { x: d.px + sx * c - sy * s, y: d.py + sx * s + sy * c };
  }

  // ---------- rounds ----------

  function setState(s) {
    state = s;
    stateAt = performance.now();
  }

  function filled(d) {
    setState('full');
    T.pour(false);
    T.confetti(parts, W, H);
    T.cheer();
    T.roundDone();
    if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
    if (kind === 'tub') T.noise('quack');
    T.say(d.k.say, 800);
    if (kind === 'tank') {
      fish = [0, 1, 2].map(i => ({
        x: rand(-0.3, 0.3), y: 0.35 + i * 0.18, dir: Math.random() < 0.5 ? -1 : 1,
        speed: rand(0.12, 0.22), phase: rand(0, TAU), born: performance.now() + i * 250,
      }));
    }
  }

  // ---------- input ----------

  const held = new Set();

  function duckHit(x, y) {
    if (kind !== 'tub') return false;
    const d = dims();
    const duck = duckPos(d, performance.now() / 1000);
    return Math.hypot(x - (d.cx + duck.x), y - (d.top + duck.y)) < duck.r * 1.2;
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    held.add(e.pointerId);
    if (duckHit(e.clientX, e.clientY)) T.noise('quack');
  }, { passive: false });

  const lift = e => held.delete(e.pointerId);
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

  // ---------- update ----------

  function update(dt, now) {
    const d = dims();
    const t = (now - stateAt) / 1000;
    const pouring = held.size > 0 && state === 'play';

    tilt += ((pouring ? TILT : 0) - tilt) * Math.min(1, dt * 8);
    flow = Math.max(0, Math.min(1, (-tilt - 0.55) / 0.45));
    stir += ((flow > 0.05 ? 1 : 0) - stir) * Math.min(1, dt * (flow > 0.05 ? 4 : 1.2));

    if (state === 'play') {
      level = Math.min(1, level + flow * dt / FILL_TIME);
      T.pour(flow > 0.05, level);
      if (level >= 1) filled(d);
    } else if (state === 'full' && t >= FULL_FOR) {
      setState('drain');
      T.noise('glug');
    } else if (state === 'drain') {
      level = Math.max(0, level - dt / DRAIN_FOR);
      if (level <= 0) {
        round++;
        fish = [];
        bubbles = [];
        let next;
        do { next = pick(KIND_NAMES); } while (next === kind);
        kind = next;
        setState('grow');
      }
    } else if (state === 'grow' && t >= GROW_FOR) {
      setState('play');
    }

    if (flow > 0.3) {
      const s = spout(d);
      const ix = s.x - d.p * 0.12;
      const iy = d.top + surfaceAt(d, ix - d.cx, now / 1000);
      for (let i = 0; i < 2; i++) {
        parts.push({
          x: ix + rand(-4, 4), y: iy, vx: rand(-140, 140), vy: -rand(120, 320),
          size: rand(2.5, 5.5), color: d.k.solid, life: 0, max: rand(0.35, 0.6), g: 1100, shape: 'dot',
        });
      }
      if (Math.random() < 0.5) {
        bubbles.push({ x: ix - d.cx + rand(-d.w * 0.05, d.w * 0.05), y: iy - d.top + rand(d.h * 0.05, d.h * 0.2), r: rand(2, 6), vy: -rand(60, 120) });
      }
    }
    const surf = waterTop(d);
    bubbles = bubbles.filter(b => (b.y += b.vy * dt) > surf);
  }

  // ---------- drawing ----------

  function duckPos(d, t) {
    const r = d.w * 0.13;
    const floating = waterTop(d) - r * 0.35 + Math.sin(t * 2) * r * 0.05;
    return { x: d.w * 0.15 + Math.sin(t * 0.7) * d.w * 0.05, y: Math.min(floating, d.h - r * 0.8), r };
  }

  function drawPitcher(d) {
    ctx.save();
    ctx.translate(d.px, d.py);
    ctx.rotate(tilt);
    ctx.scale(d.p, d.p);
    const color = PITCHERS[round % PITCHERS.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.13;
    ctx.beginPath(); ctx.arc(0.5, 0, 0.3, -1.3, 1.3); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-0.46, -0.6);
    ctx.lineTo(-0.8, -0.78);
    ctx.lineTo(-0.38, -0.25);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-0.46, -0.62);
    ctx.lineTo(0.46, -0.62);
    ctx.quadraticCurveTo(0.62, 0.62, 0.4, 0.66);
    ctx.lineTo(-0.4, 0.66);
    ctx.quadraticCurveTo(-0.62, 0.62, -0.46, -0.62);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.ellipse(-0.22, -0.2, 0.08, 0.28, 0.1, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawStream(d, t) {
    if (flow <= 0.02) return;
    const s = spout(d);
    const endX = s.x - d.p * 0.12;
    const endY = d.top + surfaceAt(d, endX - d.cx, t);
    ctx.strokeStyle = d.k.solid;
    ctx.lineWidth = d.p * 0.17 * flow;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      const x = s.x + (endX - s.x) * Math.sqrt(k) + Math.sin(t * 25 + k * 9) * d.p * 0.025 * k;
      const y = s.y + (endY - s.y) * k;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt, now);
    const t = now / 1000;
    const d = dims();
    const st = (now - stateAt) / 1000;

    const [wall, table] = BACKDROPS[round % BACKDROPS.length];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = table;
    ctx.fillRect(0, d.bottom + d.w * 0.02, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(0, d.bottom + d.w * 0.02, W, 5);

    const grow = state === 'grow' ? Math.max(0.001, easeOutBack(Math.min(1, st / GROW_FOR))) : 1;
    ctx.save();
    ctx.translate(d.cx, d.bottom);
    ctx.scale(grow, grow);
    ctx.translate(0, -d.h);
    const { k, w, h } = d;

    oval(0, h + w * 0.03, w * 0.55, w * 0.05, 'rgba(0,0,0,0.08)');
    k.path(ctx, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();

    ctx.save();
    k.path(ctx, w, h);
    ctx.clip();
    k.back(w, h, t);
    if (level > 0) {
      ctx.fillStyle = k.water;
      ctx.beginPath();
      ctx.moveTo(-w / 2 - 4, h + 4);
      for (let i = 0; i <= 24; i++) {
        const x = -w / 2 - 4 + (w + 8) * i / 24;
        ctx.lineTo(x, surfaceAt(d, x, t));
      }
      ctx.lineTo(w / 2 + 4, h + 4);
      ctx.closePath();
      ctx.fill();
      for (const b of bubbles) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(b.x + Math.sin(b.y * 0.1) * 2, b.y, b.r, 0, TAU); ctx.stroke();
      }
      if (kind === 'tub') {
        for (let i = 0; i < 14; i++) {
          const x = -w / 2 + (i + 0.5) * w / 14;
          circle(x, surfaceAt(d, x, t), w * (0.025 + 0.012 * Math.sin(i * 2.3 + t * 2)), 'rgba(255,255,255,0.9)');
        }
      }
    }
    if (kind === 'tank' && fish.length) {
      const fade = state === 'drain' ? Math.max(0, 1 - st / 0.4) : 1;
      ctx.globalAlpha = fade;
      for (const f of fish) {
        if (now < f.born) continue;
        f.x += f.dir * f.speed * dt;
        if (f.x > 0.36 || f.x < -0.36) f.dir *= -1;
        ctx.save();
        ctx.translate(f.x * w, f.y * h + Math.sin(t * 2 + f.phase) * h * 0.02);
        ctx.scale(w * 0.09 * -f.dir, w * 0.09);
        T.drawFigure(ctx, T.FIGURES.findIndex(g => g.id === 'fish'));
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    if (kind === 'jug') {
      const s = w * 0.13;
      for (const [i, sx] of [[0, -0.14], [1, 0.12]]) {
        const y = Math.min(waterTop(d) - s * 0.25 + Math.sin(t * 2 + i) * s * 0.06, h - s * 0.55 - i * s * 0.9);
        ctx.save();
        ctx.translate(sx * w, y);
        ctx.rotate(0.2 * (i ? 1 : -1) + Math.sin(t + i) * 0.05);
        box(-s / 2, -s / 2, s, s, s * 0.2, 'rgba(225,245,255,0.92)');
        box(-s * 0.3, -s * 0.32, s * 0.12, s * 0.4, s * 0.06, 'rgba(255,255,255,0.95)');
        ctx.restore();
      }
    }
    ctx.restore();

    if (kind === 'tub') {
      const duck = duckPos(d, t);
      ctx.save();
      ctx.translate(duck.x, duck.y);
      ctx.scale(duck.r, duck.r);
      T.drawFigure(ctx, T.FIGURES.findIndex(g => g.id === 'duck'));
      ctx.restore();
    }

    k.front(w, h);
    ctx.restore();

    drawStream(d, t);
    drawPitcher(d);

    parts = T.drawParticles(ctx, parts, dt, H);
    T.drawTouches(ctx, dt);
    requestAnimationFrame(frame);
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    base = Math.min(W * 0.8, H * 0.5);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
