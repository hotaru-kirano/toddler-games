(() => {
  'use strict';
  const T = window.Toddler;
  const { TAU, rand, pick } = T;

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const BACKDROPS = [
    ['#e9f6ff', '#cfe9ff', '#c9a47e'],
    ['#fff3f6', '#ffdbe5', '#9bd18a'],
    ['#f2ffe9', '#dbf5c9', '#d9b48f'],
    ['#fff9e6', '#ffeec0', '#a7d7c5'],
  ]; // sky top, sky bottom, floor
  const GRAVITY = 2400;
  const CHEER_AFTER = 0.8;   // seconds after the last break
  const CLEAN_AFTER = 3.2;
  const CLEAN_FOR = 0.6;
  const DESCEND_FOR = 0.8;

  // How each kind looks, how far it reaches above/below its centre, and how it breaks.
  const KINDS = {
    egg: {
      top: 1, bottom: 1, sound: 'crack',
      draw(r) {
        oval(0, 0, r * 0.75, r, '#fff3dc');
        circle(-r * 0.2, r * 0.3, r * 0.05, '#ead7b5');
        circle(r * 0.25, -r * 0.1, r * 0.04, '#ead7b5');
        circle(r * 0.1, r * 0.55, r * 0.035, '#ead7b5');
        shine(r * 0.75, r);
      },
      shatter(x, y, r) {
        shards(x, y, r, ['#fff3dc', '#f3e2c2'], 10, 0.28, 700);
        stains.push({ x, rx: r * 1.1, ry: r * 0.22, color: 'rgba(255,255,255,0.85)', grow: 0 });
        stains.push({ x, rx: r * 0.45, ry: r * 0.14, color: '#ffc93c', grow: 0 });
        chicks.push({ x, y: floorY - r * 0.6, vy: -650, r: r * 0.6, flip: Math.random() < 0.5 ? -1 : 1, phase: rand(0, TAU) });
        setTimeout(() => T.noise('peep'), 300);
      },
    },
    pot: {
      top: 0.75, bottom: 0.9, sound: 'thud', also: 'crack',
      draw(r) {
        poly([[-0.7 * r, -0.5 * r], [0.7 * r, -0.5 * r], [0.5 * r, 0.9 * r], [-0.5 * r, 0.9 * r]], '#e07a3f');
        box(-0.85 * r, -0.75 * r, 1.7 * r, 0.32 * r, 0.08 * r, '#c8622a');
        box(-0.62 * r, 0.1 * r, 1.24 * r, 0.12 * r, 0.04 * r, 'rgba(255,255,255,0.35)');
      },
      shatter(x, y, r) {
        shards(x, y, r, ['#e07a3f', '#c8622a'], 9, 0.38, 650);
        stains.push({ x, rx: r * 0.9, ry: r * 0.16, color: '#8b5a2b', grow: 0 });
      },
    },
    ice: {
      top: 0.75, bottom: 0.75, sound: 'shatter',
      draw(r) {
        ctx.globalAlpha *= 0.9;
        box(-0.75 * r, -0.75 * r, 1.5 * r, 1.5 * r, 0.22 * r, '#bfe9ff');
        ctx.globalAlpha /= 0.9;
        box(-0.55 * r, -0.6 * r, 0.12 * r, 0.7 * r, 0.06 * r, 'rgba(255,255,255,0.8)');
        box(-0.35 * r, -0.6 * r, 0.08 * r, 0.35 * r, 0.04 * r, 'rgba(255,255,255,0.6)');
      },
      shatter(x, y, r) {
        shards(x, y, r, ['#bfe9ff', '#e6f7ff', '#9fd8f5'], 18, 0.22, 800);
        T.sparkle(parts, x, y, 14, '#ffffff');
      },
    },
    plate: {
      top: 1, bottom: 1, sound: 'shatter',
      draw(r) {
        circle(0, 0, r, '#ffffff');
        ring(0, 0, r * 0.88, r * 0.09, '#3a86ff');
        circle(0, 0, r * 0.58, '#f1f4fa');
        ring(0, 0, r * 0.58, r * 0.03, '#d7e3f7');
      },
      shatter(x, y, r) {
        shards(x, y, r, ['#ffffff', '#3a86ff', '#f1f4fa'], 10, 0.4, 700);
      },
    },
    melon: {
      top: 0.8, bottom: 0.8, sound: 'splat',
      draw(r) {
        oval(0, 0, r, r * 0.8, '#3fae49');
        ctx.strokeStyle = '#2b8a35';
        ctx.lineWidth = r * 0.1;
        ctx.lineCap = 'round';
        for (const k of [-0.6, -0.2, 0.2, 0.6]) {
          ctx.beginPath();
          ctx.moveTo(k * r * 0.9, -r * 0.7);
          ctx.quadraticCurveTo(k * r * 1.3, 0, k * r * 0.9, r * 0.7);
          ctx.stroke();
        }
        shine(r, r * 0.8);
      },
      shatter(x, y, r) {
        shards(x, y, r, ['#3fae49', '#2b8a35'], 8, 0.35, 650);
        shards(x, y, r, ['#ff4d6d', '#ff6b81'], 10, 0.3, 750);
        shards(x, y, r, ['#3b2b3b'], 8, 0.07, 700);
        stains.push({ x, rx: r * 1.2, ry: r * 0.2, color: 'rgba(255,77,109,0.55)', grow: 0 });
      },
    },
  };
  const KIND_NAMES = Object.keys(KINDS);

  let W = 0, H = 0, dpr = 1, floorY = 0;
  let hangers = [];
  let pieces = [];  // broken shards on the move or resting on the floor
  let stains = [];  // splats on the floor
  let chicks = [];
  let snaps = [];   // cut strings springing back up
  let parts = [];
  let round = 0;
  let state = 'play'; // play | done | clean
  let stateAt = 0;
  let cheered = false;
  let shake = 0;
  let last = performance.now();

  // ---------- small drawing helpers (current transform, pixel units) ----------

  function circle(x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function oval(x, y, rx, ry, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  }
  function ring(x, y, r, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }
  function poly(pts, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath(); ctx.fill();
  }
  function box(x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fill();
  }
  function shine(rx, ry) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.4, -ry * 0.45, rx * 0.14, ry * 0.24, -0.5, 0, TAU);
    ctx.fill();
  }

  // ---------- rounds ----------

  function newRound() {
    round++;
    state = 'play';
    stateAt = performance.now();
    cheered = false;
    const m = Math.min(W, H);
    const r = Math.max(44, Math.min(110, m * 0.12));
    const perRow = Math.max(3, Math.min(6, Math.floor(W / (r * 2.6))));
    const rows = H > W * 1.3 ? 2 : 1;
    const spacing = W / perRow;
    const now = performance.now();
    hangers = [];
    for (let row = 0; row < rows; row++) {
      const count = row === 0 ? perRow : perRow - 1;
      for (let i = 0; i < count; i++) {
        const len = (row === 0 ? H * 0.22 : H * 0.44) + rand(-0.03, 0.03) * H;
        hangers.push({
          kind: pick(KIND_NAMES),
          ax: row === 0 ? spacing * (i + 0.5) : spacing * (i + 1),
          len: Math.min(len, floorY - r * 2.2),
          r: r * rand(0.9, 1.08),
          phase: rand(0, TAU),
          born: now + hangers.length * 90,
          falling: false, broken: false,
          x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0,
        });
      }
    }
  }

  function easeOutBounce(x) {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  }

  // Where a hanging thing is right now: swinging gently, and lowering in when the round starts.
  function swing(h, now) {
    const lower = easeOutBounce(Math.max(0, Math.min(1, (now - h.born) / 1000 / DESCEND_FOR)));
    const len = h.len * lower;
    const a = 0.06 * Math.sin(now / 1000 * 1.6 + h.phase);
    h.x = h.ax + Math.sin(a) * len;
    h.y = Math.cos(a) * len - (1 - lower) * h.r * 2;
    h.vx = Math.cos(now / 1000 * 1.6 + h.phase) * 0.06 * 1.6 * len;
  }

  // ---------- breaking ----------

  function shards(x, y, r, colors, n, size, speed) {
    for (let k = 0; k < n; k++) {
      const s = r * size * rand(0.6, 1.2);
      const pts = [];
      const corners = Math.random() < 0.5 ? 3 : 4;
      for (let c = 0; c < corners; c++) {
        const a = c / corners * TAU + rand(-0.4, 0.4);
        pts.push([Math.cos(a) * s * rand(0.5, 1), Math.sin(a) * s * rand(0.5, 1)]);
      }
      pieces.push({
        x: x + rand(-r, r) * 0.4, y: y - rand(0, r * 0.5),
        vx: rand(-1, 1) * speed, vy: -rand(0.3, 1) * speed,
        rot: rand(0, TAU), vr: rand(-12, 12),
        pts, color: pick(colors), s,
      });
    }
    if (pieces.length > 500) pieces.splice(0, pieces.length - 500);
  }

  function drop(h) {
    h.falling = true;
    h.rot = (h.x - h.ax) / h.len;
    h.vy = 0;
    h.vr = rand(-3, 3);
    snaps.push({ ax: h.ax, x: h.x, y: h.y - h.r * KINDS[h.kind].top, t: 0 });
    T.noise('bonk', 700);
  }

  function smash(h) {
    const k = KINDS[h.kind];
    h.broken = true;
    k.shatter(h.x, floorY, h.r);
    T.noise(k.sound);
    if (k.also) T.noise(k.also);
    for (let i = 0; i < 8; i++) {
      parts.push({
        x: h.x + rand(-h.r, h.r), y: floorY - 4, vx: rand(-120, 120), vy: rand(-90, -20),
        size: rand(h.r * 0.1, h.r * 0.2), color: 'rgba(255,255,255,0.7)',
        life: 0, max: 0.6, g: 0, shape: 'dot',
      });
    }
    shake = 1;
    if (navigator.vibrate) navigator.vibrate(40);
    if (hangers.every(o => o.broken) && state === 'play') {
      state = 'done';
      stateAt = performance.now();
    }
  }

  // ---------- input ----------

  const down = new Set();
  const reach = e => Math.min(50, Math.max(e.width || 0, e.height || 0) / 2);

  function touchAt(x, y, extra) {
    let hit = false;
    for (const h of hangers) {
      if (h.falling || h.broken) continue;
      if (Math.hypot(x - h.x, y - h.y) < h.r * 1.25 + extra) { drop(h); hit = true; }
    }
    for (const c of chicks) {
      if (c.vy === 0 && Math.hypot(x - c.x, y - (c.y - c.r * 0.3)) < c.r * 1.3 + extra) {
        c.vy = -520;
        T.noise('peep');
        hit = true;
      }
    }
    return hit;
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    down.add(e.pointerId);
    touchAt(e.clientX, e.clientY, reach(e));
  }, { passive: false });

  // Swiping across hanging things knocks them all down.
  canvas.addEventListener('pointermove', e => {
    if (down.has(e.pointerId)) touchAt(e.clientX, e.clientY, reach(e));
  });

  const lift = e => down.delete(e.pointerId);
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

  // ---------- update & draw ----------

  function update(dt, now) {
    for (const h of hangers) {
      if (h.broken) continue;
      if (!h.falling) { swing(h, now); continue; }
      h.vy += GRAVITY * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += h.vr * dt;
      if (h.y + h.r * KINDS[h.kind].bottom >= floorY) smash(h);
    }

    for (const p of pieces) {
      if (p.rest) continue;
      p.vy += GRAVITY * 0.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.x < 0 || p.x > W) { p.vx *= -0.5; p.x = Math.max(0, Math.min(W, p.x)); }
      const ground = floorY - p.s * 0.3;
      if (p.y > ground) {
        p.y = ground;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vr *= 0.5;
        if (Math.abs(p.vy) < 60) { p.vy = 0; p.vx = 0; p.vr = 0; p.rest = true; }
      }
    }

    for (const s of stains) s.grow = Math.min(1, s.grow + dt * 4);

    for (const c of chicks) {
      if (c.vy !== 0 || c.y < floorY) {
        c.vy += GRAVITY * 0.7 * dt;
        c.y += c.vy * dt;
        if (c.y >= floorY) { c.y = floorY; c.vy = 0; }
      }
    }

    snaps = snaps.filter(s => (s.t += dt) < 0.3);
    shake *= Math.pow(0.001, dt);

    const t = (now - stateAt) / 1000;
    if (state === 'done') {
      if (!cheered && t >= CHEER_AFTER) {
        cheered = true;
        T.confetti(parts, W, H);
        T.cheer();
      }
      if (t >= CLEAN_AFTER) { state = 'clean'; stateAt = now; }
    } else if (state === 'clean' && t >= CLEAN_FOR) {
      pieces = [];
      stains = [];
      chicks = [];
      newRound();
    }
  }

  function drawChick(c, now) {
    const bob = c.vy === 0 ? Math.abs(Math.sin(now / 1000 * 3 + c.phase)) * c.r * 0.08 : 0;
    ctx.save();
    ctx.translate(c.x, c.y - c.r * 0.75 - bob);
    ctx.scale(c.r * c.flip, c.r);
    T.drawFigure(ctx, T.FIGURES.findIndex(f => f.id === 'duck'));
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt, now);

    const [skyTop, skyBottom, floor] = BACKDROPS[round % BACKDROPS.length];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grad = ctx.createLinearGradient(0, 0, 0, floorY);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(rand(-1, 1) * shake * 6, rand(-1, 1) * shake * 6);

    ctx.fillStyle = floor;
    ctx.fillRect(-10, floorY, W + 20, H - floorY + 10);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(-10, floorY, W + 20, 6);

    const mess = state === 'clean' ? Math.max(0, 1 - (now - stateAt) / 1000 / CLEAN_FOR) : 1;
    ctx.globalAlpha = mess;
    for (const s of stains) oval(s.x, floorY + 2, s.rx * s.grow, s.ry * s.grow, s.color);
    for (const p of pieces) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      poly(p.pts, p.color);
      ctx.restore();
    }
    for (const c of chicks) drawChick(c, now);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(80,70,90,0.5)';
    ctx.lineWidth = 2;
    for (const s of snaps) {
      const k = 1 - s.t / 0.3;
      ctx.beginPath();
      ctx.moveTo(s.ax, 0);
      ctx.lineTo(s.ax + (s.x - s.ax) * k, s.y * k);
      ctx.stroke();
    }

    for (const h of hangers) {
      if (h.broken || now < h.born) continue;
      const k = KINDS[h.kind];
      if (!h.falling) {
        ctx.strokeStyle = 'rgba(80,70,90,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(h.ax, 0);
        ctx.lineTo(h.x, h.y - h.r * k.top);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.falling ? h.rot : (h.x - h.ax) / h.len);
      k.draw(h.r);
      ctx.restore();
    }
    ctx.restore();

    parts = T.drawParticles(ctx, parts, dt, H);
    T.drawTouches(ctx, dt);
    requestAnimationFrame(frame);
  }

  function resize() {
    const oldFloor = floorY, oldW = W;
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    floorY = H - Math.max(50, H * 0.13);
    if (oldW > 50 && oldFloor > 50) {
      const dy = floorY - oldFloor;
      for (const p of pieces) p.y += dy;
      for (const c of chicks) c.y += dy;
      for (const h of hangers) h.len = Math.min(h.len, floorY - h.r * 2.2);
    } else {
      newRound(); // first real size (a window can start out 0x0)
    }
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
