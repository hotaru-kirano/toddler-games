// Auto Play: runs a random game in a full-screen frame and moves on to another random one
// at the first finished round after MIN_STAY, or after MAX_STAY no matter what.
(() => {
  'use strict';

  const GAMES = ['pop', 'wipe', 'fill', 'sounds', 'push', 'crack', 'water'];
  const MIN_STAY = 45 * 1000;
  const MAX_STAY = 120 * 1000;
  const AFTER_ROUND = 2600;  // let the celebration play before switching
  const FADE = 350;

  const frame = document.getElementById('game');
  const veil = document.getElementById('veil');
  let current = null;
  let startedAt = 0;
  let switching = false;

  function pickNext() {
    const options = GAMES.filter(g => g !== current);
    return options[Math.floor(Math.random() * options.length)];
  }

  function show(game) {
    current = game;
    // replace() keeps game switches out of history, so Back can't step through old games.
    frame.contentWindow.location.replace(`../${game}/`);
  }

  frame.addEventListener('load', () => {
    if (!current) return;
    startedAt = Date.now();
    switching = false;
    veil.style.opacity = 0;
    veil.style.pointerEvents = 'none';
  });

  function next() {
    if (switching) return;
    switching = true;
    veil.style.pointerEvents = 'auto';
    veil.style.opacity = 1;
    setTimeout(() => show(pickNext()), FADE);
  }

  setInterval(() => {
    if (!switching && current && Date.now() - startedAt >= MAX_STAY) next();
  }, 1000);

  // ---------- keeping the toddler in (the games hand this job to us when embedded) ----------

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

  // A tap inside the game also counts as a tap here, so fullscreen and history pushes are allowed.
  function unlock() {
    keepAwake();
    const active = navigator.userActivation && navigator.userActivation.isActive;
    if (!historyArmed && active) {
      historyArmed = true;
      history.pushState({ toddler: 1 }, '');
    }
    const standalone = matchMedia('(display-mode: fullscreen)').matches;
    if (active && !standalone && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
  }

  window.addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || !e.data.toddler) return;
    if (e.data.toddler === 'touch') unlock();
    if (e.data.toddler === 'round' && !switching && Date.now() - startedAt >= MIN_STAY) {
      setTimeout(next, AFTER_ROUND);
    }
  });

  window.addEventListener('popstate', () => {
    historyArmed = false;
    history.pushState({ toddler: 1 }, '');
  });
  document.addEventListener('visibilitychange', keepAwake);
  document.addEventListener('contextmenu', e => e.preventDefault());

  // One worker for the whole collection, so every game works offline from here. Look for a new
  // version every half hour too, since Auto Play may run for a long time.
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('../sw.js', { scope: '../' })
      .then(reg => setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000))
      .catch(() => {}));
  }

  show(pickNext());
})();
