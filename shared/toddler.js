// Shared bits for the toddler games: sound, figures, particles, and keeping little hands in the app.
window.Toddler = (() => {
  'use strict';

  const TAU = Math.PI * 2;
  const INK = '#3b2b3b';
  const COLORS = ['#ff4d6d', '#ff9f1c', '#ffd60a', '#2ec4b6', '#3a86ff', '#8338ec', '#ff6fb5', '#52d158'];
  // C major pentatonic, low to high
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // ---------- sound ----------

  let ac = null, master = null, noise = null;

  function audio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      master = ac.createGain();
      master.gain.value = 0.8;
      master.connect(comp);
      comp.connect(ac.destination);
      const len = Math.floor(ac.sampleRate * 0.12);
      noise = ac.createBuffer(1, len, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }

  function tone(freq, start, dur, vol, type, slideFrom) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(slideFrom || freq, start);
    if (slideFrom) o.frequency.exponentialRampToValueAtTime(freq, start + 0.08);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(master);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  // [[secondsFromStart, value], ...] -> param automation
  function ramp(param, start, points) {
    points.forEach(([dt, v], i) => {
      if (i === 0) param.setValueAtTime(v, start + dt);
      else param.exponentialRampToValueAtTime(v, start + dt);
    });
  }

  // One shaped note: oscillator -> filter -> envelope (-> optional amplitude wobble for rasp).
  function voice(type, start, pitch, filter, peak, attack, hold, release, wobble) {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    const end = start + attack + hold + release;
    o.type = type;
    ramp(o.frequency, start, pitch);
    f.type = filter.type;
    f.Q.value = filter.Q || 1;
    ramp(f.frequency, start, filter.f);
    ramp(g.gain, start, [[0, 0.0001], [attack, peak], [attack + hold, peak], [attack + hold + release, 0.0001]]);
    o.connect(f);
    f.connect(g);
    let out = g;
    if (wobble) {
      const w = ac.createGain(), lfo = ac.createOscillator(), depth = ac.createGain();
      w.gain.value = 0.5;
      depth.gain.value = 0.5;
      lfo.frequency.value = wobble;
      lfo.connect(depth);
      depth.connect(w.gain);
      g.connect(w);
      out = w;
      lfo.start(start);
      lfo.stop(end + 0.05);
    }
    out.connect(master);
    o.start(start);
    o.stop(end + 0.05);
  }

  function popSound(freq) {
    if (!audio()) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise;
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    g.gain.value = 0.9;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
    tone(freq, t, 0.35, 0.3, 'triangle', freq * 1.6);
  }

  function chime(freq, vol = 0.12) {
    if (!audio()) return;
    tone(freq, ac.currentTime, 0.25, vol, 'sine');
  }

  function cheer() {
    if (!audio()) return;
    const t = ac.currentTime + 0.05;
    [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]
      .forEach((f, i) => tone(f, t + i * 0.1, 0.45, 0.22, 'triangle'));
  }

  const NOISES = {
    meow(t) {
      voice('sawtooth', t, [[0, 480], [0.18, 820], [0.6, 430]],
        { type: 'bandpass', Q: 4, f: [[0, 700], [0.2, 1800], [0.6, 800]] }, 0.9, 0.06, 0.3, 0.3);
    },
    quack(t) {
      for (const k of [0, 0.28]) {
        voice('sawtooth', t + k, [[0, 300], [0.15, 210]],
          { type: 'bandpass', Q: 5, f: [[0, 1300], [0.15, 900]] }, 1, 0.01, 0.08, 0.1, 60);
      }
    },
    ribbit(t) {
      voice('square', t, [[0, 140], [0.12, 120]],
        { type: 'bandpass', Q: 3, f: [[0, 800], [0.12, 600]] }, 0.8, 0.01, 0.08, 0.06, 35);
      voice('square', t + 0.2, [[0, 180], [0.16, 150]],
        { type: 'bandpass', Q: 3, f: [[0, 900], [0.16, 650]] }, 0.8, 0.01, 0.1, 0.08, 35);
    },
    growl(t) {
      voice('sawtooth', t, [[0, 110], [0.3, 140], [0.9, 70]],
        { type: 'lowpass', Q: 2, f: [[0, 400], [0.3, 1400], [0.9, 300]] }, 0.8, 0.08, 0.5, 0.35, 28);
    },
    honk(t) {
      for (const k of [0, 0.3]) {
        for (const f of [415.3, 523.25]) {
          voice('square', t + k, [[0, f]], { type: 'lowpass', f: [[0, 2200]] }, 0.25, 0.01, 0.16, 0.05);
        }
      }
    },
    blub(t) {
      for (let k = 0; k < 4; k++) {
        voice('sine', t + k * 0.13 + rand(0, 0.03), [[0, 180 + k * 30], [0.07, 700 + k * 80]],
          { type: 'lowpass', f: [[0, 4000]] }, 0.6, 0.005, 0.03, 0.05);
      }
    },
    boing(t) {
      voice('sine', t, [[0, 150], [0.5, 420]], { type: 'lowpass', f: [[0, 3000]] }, 0.6, 0.01, 0.25, 0.3, 14);
    },
  };

  function noise_(name) {
    if (!audio()) return;
    NOISES[name](ac.currentTime + 0.01);
  }

  function say(text, delay = 0) {
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.pitch = 1.3;
      setTimeout(() => speechSynthesis.speak(u), delay);
    } catch (_) { /* no voice available */ }
  }

  // ---------- keeping the toddler in ----------

  let wakeLock = null, wakePending = false, historyArmed = false;

  async function keepAwake() {
    if (wakeLock || wakePending || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    wakePending = true;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (_) { /* not allowed right now */ }
    wakePending = false;
  }

  // Touch only grants user activation on pointerup, so this runs on both down and up.
  function unlock(e) {
    audio();
    keepAwake();
    if (!historyArmed && navigator.userActivation && navigator.userActivation.isActive) {
      historyArmed = true;
      history.pushState({ toddler: 1 }, '');
    }
    const standalone = matchMedia('(display-mode: fullscreen)').matches;
    if (e.pointerType === 'touch' && !standalone && !document.fullscreenElement &&
        document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
  }

  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('pointerup', unlock, true);
  // Swallow the back gesture: every back just re-pushes the same page. Chrome skips entries pushed
  // without a tap, so the next tap pushes a fresh one as well.
  window.addEventListener('popstate', () => {
    historyArmed = false;
    history.pushState({ toddler: 1 }, '');
  });
  document.addEventListener('visibilitychange', keepAwake);
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---------- touch feedback: every finger shows up, wherever it lands ----------

  const TRAIL_LIFE = 0.5;
  const RIPPLE_LIFE = 0.45;
  const fingers = new Map(); // pointerId -> {x, y, hue}
  let ripples = [];
  let trail = [];
  let nextHue = rand(0, 360);

  window.addEventListener('pointerdown', e => {
    const f = { x: e.clientX, y: e.clientY, hue: nextHue };
    nextHue = (nextHue + 47) % 360;
    fingers.set(e.pointerId, f);
    ripples.push({ x: f.x, y: f.y, hue: f.hue, t: 0 });
  }, true);

  window.addEventListener('pointermove', e => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of (evs.length ? evs : [e])) {
      const dx = ev.clientX - f.x, dy = ev.clientY - f.y;
      const d = Math.hypot(dx, dy);
      const steps = Math.ceil(d / 6);
      for (let i = 1; i <= steps; i++) {
        trail.push({ x: f.x + dx * i / steps, y: f.y + dy * i / steps, hue: (f.hue + d * 0.5 * i / steps) % 360, life: 0 });
      }
      f.hue = (f.hue + d * 0.5) % 360;
      f.x = ev.clientX;
      f.y = ev.clientY;
    }
    if (trail.length > 800) trail.splice(0, trail.length - 800);
  }, true);

  const liftFinger = e => fingers.delete(e.pointerId);
  window.addEventListener('pointerup', liftFinger, true);
  window.addEventListener('pointercancel', liftFinger, true);

  // Draws the beam behind moving fingers, a ripple where each touch landed and a ring under held fingers.
  function drawTouches(c, dt) {
    const size = Math.max(10, Math.min(innerWidth, innerHeight) * 0.03);
    c.lineCap = 'round';

    trail = trail.filter(p => (p.life += dt) < TRAIL_LIFE);
    for (const p of trail) {
      const k = 1 - p.life / TRAIL_LIFE;
      c.globalAlpha = 0.85 * k;
      c.fillStyle = `hsl(${p.hue}, 95%, 62%)`;
      c.beginPath(); c.arc(p.x, p.y, size * (0.35 + 0.65 * k), 0, TAU); c.fill();
    }

    ripples = ripples.filter(r => (r.t += dt) < RIPPLE_LIFE);
    for (const r of ripples) {
      const k = r.t / RIPPLE_LIFE;
      c.globalAlpha = 1 - k;
      c.strokeStyle = `hsl(${r.hue}, 95%, 62%)`;
      c.lineWidth = size * 0.5 * (1 - k) + 1;
      c.beginPath(); c.arc(r.x, r.y, size * (1.5 + 4 * k), 0, TAU); c.stroke();
    }

    const pulse = 1 + 0.1 * Math.sin(performance.now() / 110);
    for (const f of fingers.values()) {
      const rad = size * 3 * pulse;
      c.globalAlpha = 0.9;
      c.strokeStyle = `hsl(${f.hue}, 95%, 62%)`;
      c.lineWidth = size * 0.45;
      c.beginPath(); c.arc(f.x, f.y, rad, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = size * 0.14;
      c.beginPath(); c.arc(f.x, f.y, rad, 0, TAU); c.stroke();
    }
    c.globalAlpha = 1;
  }

  // ---------- particles ----------

  function starPath(c, cx, cy, outer, inner) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rad = i % 2 ? inner : outer;
      c.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    c.closePath();
  }

  function burst(parts, x, y, color, r) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU + rand(-0.2, 0.2);
      const s = rand(250, 520);
      parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        size: rand(r * 0.12, r * 0.22), color,
        life: 0, max: rand(0.5, 0.8), g: 600, shape: 'dot',
      });
    }
  }

  function sparkle(parts, x, y, n = 7, color = null) {
    for (let k = 0; k < n; k++) {
      const a = rand(0, TAU), s = rand(60, 160);
      parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        size: rand(5, 9), color: color || pick(COLORS),
        life: 0, max: 0.5, g: 0, shape: 'star',
      });
    }
  }

  function confetti(parts, W, H) {
    for (let k = 0; k < 140; k++) {
      parts.push({
        x: rand(0, W), y: rand(-H * 0.3, -10), vx: rand(-60, 60), vy: rand(80, 260),
        size: rand(6, 12), color: pick(COLORS),
        life: 0, max: rand(2.4, 3.4), g: 120, shape: 'confetti',
        rot: rand(0, TAU), vr: rand(-8, 8),
      });
    }
  }

  // Moves, draws and returns the particles still alive.
  function drawParticles(c, parts, dt, H) {
    const alive = parts.filter(p => (p.life += dt) < p.max && p.y < H + 40);
    const drag = Math.pow(0.08, dt);
    for (const p of alive) {
      if (p.shape === 'dot') { p.vx *= drag; p.vy *= drag; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      c.globalAlpha = Math.min(1, (p.max - p.life) / 0.25);
      c.fillStyle = p.color;
      if (p.shape === 'confetti') {
        p.rot += p.vr * dt;
        c.save();
        c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        c.restore();
      } else if (p.shape === 'star') {
        starPath(c, p.x, p.y, p.size, p.size * 0.45);
        c.fill();
      } else {
        c.beginPath(); c.arc(p.x, p.y, p.size * (1 - 0.5 * p.life / p.max), 0, TAU); c.fill();
      }
    }
    c.globalAlpha = 1;
    return alive;
  }

  // ---------- figures (drawn in units where 1 = figure radius) ----------

  let g = null;     // context being drawn into
  let tint = null;  // when set, every part is this color (a silhouette)

  function circle(x, y, r, fill) {
    g.fillStyle = tint || fill;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  function oval(x, y, rx, ry, fill, rot = 0) {
    g.fillStyle = tint || fill;
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill();
  }
  function poly(pts, fill) {
    g.fillStyle = g.strokeStyle = tint || fill;
    g.lineJoin = 'round';
    g.lineWidth = 0.08;
    g.beginPath();
    pts.forEach(([x, y]) => g.lineTo(x, y));
    g.closePath(); g.fill(); g.stroke();
  }
  function box(x, y, w, h, r, fill) {
    g.fillStyle = tint || fill;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
    g.fill();
  }
  function line(x0, y0, x1, y1, w) {
    g.strokeStyle = tint || INK; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  function ring(x, y, r, w, color) {
    g.strokeStyle = tint || color; g.lineWidth = w;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  }
  function eye(x, y, r) {
    circle(x, y, r, INK);
    circle(x - r * 0.3, y - r * 0.35, r * 0.35, '#fff');
  }
  function eyes(x, y, gap, r) { eye(x - gap, y, r); eye(x + gap, y, r); }
  function smile(x, y, r, w, from = 0.15, to = 0.85) {
    g.strokeStyle = tint || INK; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.arc(x, y, r, Math.PI * from, Math.PI * to); g.stroke();
  }
  function cheeks(x, y, gap, r) {
    circle(x - gap, y, r, 'rgba(255,110,150,0.4)');
    circle(x + gap, y, r, 'rgba(255,110,150,0.4)');
  }

  const FIGURES = [
    { id: 'cat', name: 'Kitty!', noise: 'meow', word: 'Meow!', draw() {
      const fur = '#ff9f43', inner = '#ffc8d6';
      poly([[-0.72, -0.2], [-0.62, -0.95], [-0.12, -0.6]], fur);
      poly([[0.72, -0.2], [0.62, -0.95], [0.12, -0.6]], fur);
      poly([[-0.58, -0.36], [-0.56, -0.76], [-0.3, -0.56]], inner);
      poly([[0.58, -0.36], [0.56, -0.76], [0.3, -0.56]], inner);
      circle(0, 0.08, 0.76, fur);
      eyes(0, -0.04, 0.3, 0.1);
      cheeks(0, 0.2, 0.5, 0.1);
      poly([[-0.08, 0.15], [0.08, 0.15], [0, 0.24]], '#ff6f91');
      smile(-0.08, 0.24, 0.08, 0.035, 0.1, 0.9);
      smile(0.08, 0.24, 0.08, 0.035, 0.1, 0.9);
      for (const sx of [-1, 1]) {
        line(sx * 0.38, 0.2, sx * 0.95, 0.1, 0.025);
        line(sx * 0.38, 0.28, sx * 0.95, 0.34, 0.025);
      }
    } },
    { id: 'bear', name: 'Bear!', noise: 'growl', word: 'Rawr!', draw() {
      const fur = '#a86b3c', light = '#e8c39e';
      circle(-0.55, -0.52, 0.27, fur); circle(0.55, -0.52, 0.27, fur);
      circle(-0.55, -0.52, 0.14, light); circle(0.55, -0.52, 0.14, light);
      circle(0, 0.08, 0.75, fur);
      oval(0, 0.32, 0.33, 0.25, light);
      oval(0, 0.22, 0.12, 0.08, INK);
      eyes(0, -0.1, 0.3, 0.09);
      smile(0, 0.3, 0.12, 0.04);
      cheeks(0, 0.12, 0.52, 0.1);
    } },
    { id: 'fish', name: 'Fishy!', noise: 'blub', word: 'Blub blub!', draw() {
      const body = '#3a86ff', fin = '#1f5fd1';
      poly([[0.45, 0], [0.95, -0.42], [0.95, 0.42]], fin);
      poly([[-0.2, -0.42], [0.15, -0.72], [0.3, -0.38]], fin);
      oval(-0.12, 0, 0.72, 0.5, body);
      oval(0.15, 0, 0.07, 0.36, 'rgba(255,255,255,0.25)');
      oval(0.32, 0, 0.06, 0.28, 'rgba(255,255,255,0.25)');
      circle(-0.45, -0.12, 0.15, '#fff');
      eye(-0.42, -0.1, 0.08);
      smile(-0.52, 0.06, 0.13, 0.04, 0.15, 0.7);
      ring(-0.92, -0.55, 0.07, 0.03, 'rgba(58,134,255,0.6)');
      ring(-0.98, -0.8, 0.05, 0.03, 'rgba(58,134,255,0.6)');
    } },
    { id: 'sun', name: 'Sunny!', noise: 'boing', word: 'Boing!', draw() {
      for (let i = 0; i < 12; i++) {
        g.save();
        g.rotate(i * TAU / 12);
        poly([[-0.12, -0.62], [0.12, -0.62], [0, -0.95]], '#ffb703');
        g.restore();
      }
      circle(0, 0, 0.6, '#ffd60a');
      eyes(0, -0.1, 0.22, 0.08);
      cheeks(0, 0.12, 0.38, 0.09);
      smile(0, 0.04, 0.25, 0.05);
    } },
    { id: 'duck', name: 'Ducky!', noise: 'quack', word: 'Quack quack!', draw() {
      const y = '#ffd60a';
      poly([[0.7, 0.18], [0.98, 0.02], [0.86, 0.42]], y);
      oval(0.12, 0.38, 0.7, 0.42, y);
      oval(0.22, 0.38, 0.34, 0.2, '#f5b700', -0.3);
      circle(-0.3, -0.22, 0.4, y);
      oval(-0.74, -0.14, 0.24, 0.1, '#ff8c1a');
      eye(-0.38, -0.32, 0.07);
      circle(-0.2, -0.12, 0.08, 'rgba(255,110,150,0.4)');
    } },
    { id: 'frog', name: 'Froggy!', noise: 'ribbit', word: 'Ribbit!', draw() {
      const green = '#52b852';
      circle(-0.42, -0.42, 0.28, green); circle(0.42, -0.42, 0.28, green);
      oval(0, 0.12, 0.85, 0.6, green);
      circle(-0.42, -0.44, 0.18, '#fff'); circle(0.42, -0.44, 0.18, '#fff');
      eye(-0.4, -0.42, 0.09); eye(0.44, -0.42, 0.09);
      circle(-0.08, -0.02, 0.025, INK); circle(0.08, -0.02, 0.025, INK);
      cheeks(0, 0.22, 0.58, 0.1);
      smile(0, -0.02, 0.5, 0.05, 0.2, 0.8);
    } },
    { id: 'car', name: 'Car!', noise: 'honk', word: 'Beep beep!', draw() {
      const red = '#ff4d6d', glass = '#bde0fe';
      box(-0.55, -0.5, 1.0, 0.6, 0.2, red);
      box(-0.45, -0.4, 0.38, 0.32, 0.08, glass);
      box(0.0, -0.4, 0.38, 0.32, 0.08, glass);
      box(-0.95, -0.05, 1.9, 0.5, 0.2, red);
      circle(0.84, 0.1, 0.07, '#ffe066');
      for (const wx of [-0.5, 0.5]) {
        circle(wx, 0.45, 0.24, '#333');
        circle(wx, 0.45, 0.1, '#ccc');
      }
    } },
  ];

  // Draws figure i into context c, centred on the current origin with radius 1.
  function drawFigure(c, i, silhouette = null) {
    g = c;
    tint = silhouette;
    c.save();
    FIGURES[i].draw();
    c.restore();
    g = null;
    tint = null;
  }

  function otherFigure(current) {
    let n;
    do { n = Math.floor(Math.random() * FIGURES.length); } while (n === current);
    return n;
  }

  return {
    TAU, COLORS, NOTES, FIGURES, rand, pick,
    audio, popSound, chime, cheer, noise: noise_, say,
    starPath, burst, sparkle, confetti, drawParticles, drawTouches,
    drawFigure, otherFigure,
  };
})();
