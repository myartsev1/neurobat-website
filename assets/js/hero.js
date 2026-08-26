/* NeuroBat Lab · signature hero: a flight path through a field of place cells */
(function () {
  "use strict";
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");

  let W = 0, H = 0, bgGrad = null, glowGrad = null, rafId = null, inView = true;

  function makeGradients() {
    bgGrad = ctx.createRadialGradient(W * 0.68, H * 0.32, 0, W * 0.68, H * 0.32, Math.max(W, H) * 0.75);
    bgGrad.addColorStop(0, "rgba(19,26,46,0.85)");
    bgGrad.addColorStop(1, "rgba(8,11,20,0)");
    glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
    glowGrad.addColorStop(0, "rgba(237,233,223,0.85)");
    glowGrad.addColorStop(0.25, "rgba(232,195,74,0.35)");
    glowGrad.addColorStop(1, "rgba(232,195,74,0)");
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === W && h === H && canvas.width === Math.round(w * dpr)) return false;
    W = w; H = h;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeGradients();
    seedCells();
    return true;
  }

  /* ---- Place-cell field ---- */
  const COLORS = ["224,108,66", "127,212,154", "180,154,224", "232,195,74"];
  let cells = [];
  function seedCells() {
    const n = Math.round((W * H) / 16000);
    cells = [];
    for (let i = 0; i < n; i++) {
      cells.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1 + Math.random() * 1.6,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        base: 0.06 + Math.random() * 0.1,
        act: 0,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }

  /* ---- Bat trajectory (smooth wander) ---- */
  const bat = { x: 0, y: 0, a: -0.3, turn: 0 };
  const trail = [];
  const TRAIL_MAX = 240;

  /* ---- Sonar rings ---- */
  const rings = [];
  function ping(x, y, strong) {
    rings.push({ x, y, r: 2, max: strong ? 170 : 90, sp: strong ? 1.6 : 1.05, alpha: strong ? 0.5 : 0.3 });
    if (rings.length > 40) rings.shift();
  }

  /* ---- Pointer ---- */
  let lastMove = 0;
  canvas.parentElement.addEventListener("pointermove", (e) => {
    const now = performance.now();
    if (now - lastMove > 420) {
      lastMove = now;
      const r = canvas.getBoundingClientRect();
      ping(e.clientX - r.left, e.clientY - r.top, false);
    }
  }, { passive: true });
  canvas.parentElement.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    ping(e.clientX - r.left, e.clientY - r.top, true);
  });

  function stepBat(k) {
    bat.turn += (Math.random() - 0.5) * 0.02 * k;
    bat.turn *= Math.pow(0.965, k);
    const cx = W * 0.55, cy = H * 0.45;
    const toC = Math.atan2(cy - bat.y, cx - bat.x);
    let da = toC - bat.a;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const dist = Math.hypot(cx - bat.x, cy - bat.y);
    const bound = Math.min(W, H) * 0.4;
    bat.a += bat.turn + da * (dist > bound ? 0.03 : 0.0015) * k;
    bat.x += Math.cos(bat.a) * 1.35 * k;
    bat.y += Math.sin(bat.a) * 1.35 * k;
    trail.push({ x: bat.x, y: bat.y });
    if (trail.length > TRAIL_MAX) trail.shift();
    for (const c of cells) {
      const d = Math.hypot(c.x - bat.x, c.y - bat.y);
      if (d < 70) c.act = Math.min(1, c.act + (1 - d / 70) * 0.35);
      c.act *= Math.pow(0.975, k);
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    for (const c of cells) {
      const twinkle = 0.5 + 0.5 * Math.sin(t * 0.0009 + c.tw);
      const a = c.base * twinkle + c.act * 0.85;
      if (a < 0.02) continue;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r + c.act * 2.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${c.c},${a.toFixed(3)})`;
      ctx.fill();
      if (c.act > 0.25) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, (c.r + c.act * 2.4) * 2.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.c},${(c.act * 0.08).toFixed(3)})`;
        ctx.fill();
      }
    }

    if (trail.length > 2) {
      for (let i = 1; i < trail.length; i++) {
        const p0 = trail[i - 1], p1 = trail[i];
        const f = i / trail.length;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = `rgba(232,195,74,${(f * f * 0.55).toFixed(3)})`;
        ctx.lineWidth = 0.5 + f * 1.6;
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(bat.x, bat.y);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(bat.x, bat.y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,252,244,0.95)";
      ctx.fill();
    }

    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      const life = 1 - r.r / r.max;
      if (life <= 0) { rings.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(201,180,120,${(r.alpha * life).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /* ---- Static composition for reduced motion (redrawable on resize) ---- */
  function drawStatic() {
    trail.length = 0;
    bat.x = W * 0.15; bat.y = H * 0.55; bat.a = -0.3; bat.turn = 0;
    for (let i = 0; i < 500; i++) {
      stepBat(1.5);
      bat.x = Math.max(40, Math.min(W - 40, bat.x));
      bat.y = Math.max(40, Math.min(H - 40, bat.y));
    }
    rings.length = 0;
    ping(bat.x, bat.y, false);
    rings[0].r = 40;
    draw(0);
  }

  /* ---- Animated loop (time-based) ---- */
  let lastPing = 0, lastT = null;
  function loop(t) {
    rafId = requestAnimationFrame(loop);
    if (lastT === null) lastT = t;
    const k = Math.min(Math.max((t - lastT) / 16.667, 0.25), 3);
    lastT = t;
    stepBat(k);
    if (t - lastPing > 1900) { lastPing = t; ping(bat.x, bat.y, false); }
    for (const r of rings) r.r += r.sp * k;
    draw(t);
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const changed = resize();
      if (changed && reduced) drawStatic();
    }, 150);
  }, { passive: true });

  resize();
  bat.x = W * 0.15; bat.y = H * 0.55;

  if (reduced) {
    drawStatic();
    return;
  }

  const vio = new IntersectionObserver(([en]) => {
    inView = en.isIntersecting;
    if (inView) {
      resize();
      if (rafId === null) { lastT = null; rafId = requestAnimationFrame(loop); }
    } else if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }, { threshold: 0 });
  vio.observe(canvas);
  rafId = requestAnimationFrame(loop);
})();
