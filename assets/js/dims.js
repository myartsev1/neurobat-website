/* NeuroBat Lab · "Real behavior. The whole brain."
   A live illustrative simulation: a flight arena (BEHAVIOR) coupled to four
   simultaneously-recorded neural channels (BRAIN). Hovering a dimension chip
   highlights its channel and its trace back into the behavior itself. */
(function () {
  "use strict";
  const canvas = document.getElementById("dim-canvas");
  if (!canvas) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");

  const C = {
    spatial: "143,180,232",
    motor: "224,123,74",
    social: "127,212,154",
    comm: "180,154,224",
    ink: "237,233,223",
  };
  const LANES = [
    { key: "spatial", label: "SPATIAL NEURONS · POSITION & TRAJECTORY" },
    { key: "motor", label: "MOTOR CORTEX · FLIGHT DYNAMICS" },
    { key: "social", label: "SOCIAL NEURONS · OTHER INDIVIDUALS & CONTEXT" },
    { key: "comm", label: "AUDITORY & VOCAL NEURONS · ECHOLOCATION & COMMUNICATION" },
  ];

  let W = 0, H = 0, arenaH = 0, laneTop = 0, laneH = 0, traceLen = 0;
  let highlight = null; /* null | 'all' | dimension key */
  window.__dimSet = (k) => { highlight = k; if (reduced) drawFrame(0, true); };

  const traces = { spatial: [], motor: [], social: [], comm: [] };   /* spike amplitudes (0 = no spike) */
  const envs = { spatial: [], social: [] };                            /* smooth firing-rate envelopes */
  let fields = [];
  const bat = { x: 100, y: 100, a: 0.4, turn: 0 };
  const pal = { x: 300, y: 80, t: Math.random() * 100, a: 0, px: 300, py: 80 };
  const trail = [];
  const ripples = [];
  const rewardPulses = [];
  const insideField = [false, false, false];
  let wingPhase = 0, lastWingSin = 0, clickClock = 0, pendingClick = -1;
  /* behavioral state: FLY → brief REST, during which hippocampal REPLAY occurs
     (cf. Forli, Fan, Qi et al., Nature 2025) */
  let mode = "fly", modeTimer = 500 + Math.random() * 300;
  let replay = null, replayDelay = 0, savedTrail = null;
  /* nonlocal spatial coding events: CA1 encodes positions meters ahead or behind
     (cf. Dotson & Yartsev, Science 2021) */
  let nonlocal = null, nonlocalTimer = 300 + Math.random() * 200;
  /* explore-exploit foraging: the bat commutes between reward sites (exploitation)
     and takes exploratory detours through open space */
  let target = null, targetIsSite = false, targetTimeout = 0;
  let palPhase = Math.random() * 6;

  function pickTarget(afterSite) {
    const explore = afterSite ? Math.random() < 0.45 : Math.random() < 0.25;
    targetTimeout = 700;
    if (explore || fields.length === 0) {
      targetIsSite = false;
      return {
        x: 30 + Math.random() * (W - 60),
        y: 34 + Math.random() * (arenaH - 60),
      };
    }
    targetIsSite = true;
    const others = fields.filter((f) => Math.hypot(f.x - bat.x, f.y - bat.y) > f.r * 1.5);
    const f = (others.length ? others : fields)[Math.floor(Math.random() * (others.length ? others.length : fields.length))];
    return { x: f.x, y: f.y };
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w; H = h;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    arenaH = Math.round(H * 0.56);
    laneTop = arenaH + 14;
    laneH = (H - laneTop - 10) / LANES.length;
    traceLen = Math.max(60, Math.round(W - 30));
    for (const k in traces) {
      while (traces[k].length < traceLen) traces[k].unshift(0);
      if (traces[k].length > traceLen) traces[k] = traces[k].slice(-traceLen);
    }
    for (const k in envs) {
      while (envs[k].length < traceLen) envs[k].unshift(0);
      if (envs[k].length > traceLen) envs[k] = envs[k].slice(-traceLen);
    }
    fields = [
      { x: W * 0.22, y: arenaH * 0.42, r: Math.min(W, arenaH) * 0.13 },
      { x: W * 0.52, y: arenaH * 0.66, r: Math.min(W, arenaH) * 0.11 },
      { x: W * 0.78, y: arenaH * 0.36, r: Math.min(W, arenaH) * 0.12 },
    ];
    bat.x = W * 0.3; bat.y = arenaH * 0.5;
  }

  function alphaFor(key) {
    if (highlight === null) return 0.8;
    if (highlight === "all" || highlight === key) return 1;
    return 0.16;
  }

  function step(k) {
    /* behavioral state machine */
    modeTimer -= k;
    if (mode === "fly" && modeTimer <= 0) {
      mode = "rest";
      modeTimer = 200 + Math.random() * 80;
      nonlocal = null;
      replayDelay = 45;
      savedTrail = trail.slice(-110);
      replay = null;
    } else if (mode === "rest" && modeTimer <= 0) {
      mode = "fly";
      modeTimer = 480 + Math.random() * 360;
      replay = null;
    }

    if (mode === "rest") {
      /* perched: no movement, no wingbeats, no clicks */
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].r += 1.3 * k;
        if (ripples[i].r > ripples[i].max) ripples.splice(i, 1);
      }
      for (let i = rewardPulses.length - 1; i >= 0; i--) {
        rewardPulses[i].r += 1.6 * k;
        if (rewardPulses[i].r > rewardPulses[i].max) rewardPulses.splice(i, 1);
      }
      replayDelay -= k;
      if (replayDelay <= 0 && !replay && savedTrail && savedTrail.length > 10) {
        replay = { i: 0 };
      }
      if (replay) {
        replay.i += (savedTrail.length / 46) * k;   /* time-compressed sweep */
        if (replay.i >= savedTrail.length) { replay = null; replayDelay = 130 + Math.random() * 90; }
      }
      /* partner keeps flying */
      pal.t += 0.006 * k;
      pal.px = pal.x; pal.py = pal.y;
      pal.x = W * (0.5 + 0.36 * Math.sin(pal.t * 1.3 + 1));
      pal.y = arenaH * (0.5 + 0.3 * Math.sin(pal.t * 2.1));
      if (Math.hypot(pal.x - pal.px, pal.y - pal.py) > 0.05) pal.a = Math.atan2(pal.y - pal.py, pal.x - pal.px);
      const dPalR = Math.hypot(bat.x - pal.x, bat.y - pal.y);
      const socialEnvR = Math.exp(-dPalR / (W * 0.22));
      /* channels at rest: spatial = replay bursts; motor & vocal silent */
      const replayBurst = replay ? (Math.random() < 0.72 * k ? 0.7 + Math.random() * 0.35 : 0) : (Math.random() < 0.012 * k ? 0.5 : 0);
      push(traces.spatial, replayBurst);
      push(traces.motor, Math.random() < 0.004 * k ? 0.4 : 0);
      push(traces.social, Math.random() < (0.012 + socialEnvR * 0.26) * k ? 0.55 + socialEnvR * 0.35 : 0);
      push(traces.comm, 0);
      push(envs.spatial, replay ? 0.85 : 0.05);
      push(envs.social, socialEnvR);
      return;
    }

    /* explore-exploit foraging: fly to a chosen goal, then pick the next one */
    if (!target) target = pickTarget(false);
    targetTimeout -= k;
    const dGoal = Math.hypot(target.x - bat.x, target.y - bat.y);
    if (dGoal < 26 || targetTimeout <= 0) target = pickTarget(targetIsSite && dGoal < 26);
    bat.turn += (Math.random() - 0.5) * 0.025 * k;
    bat.turn *= Math.pow(0.93, k);
    const toG = Math.atan2(target.y - bat.y, target.x - bat.x);
    let da = toG - bat.a;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    /* gentler steering on exploratory legs makes the path meander */
    const steer = targetIsSite ? 0.05 : 0.028;
    bat.a += bat.turn + Math.max(-0.09 * k, Math.min(0.09 * k, da * steer * k));
    const speed = 1.5 * k;
    bat.x += Math.cos(bat.a) * speed;
    bat.y += Math.sin(bat.a) * speed;
    bat.y = Math.max(18, Math.min(arenaH - 14, bat.y));
    bat.x = Math.max(14, Math.min(W - 14, bat.x));
    wingPhase += 0.32 * k;

    trail.push({ x: bat.x, y: bat.y });
    if (trail.length > 130) trail.shift();

    /* partner bat: slow lissajous */
    pal.t += 0.006 * k;
    pal.px = pal.x; pal.py = pal.y;
    pal.x = W * (0.5 + 0.36 * Math.sin(pal.t * 1.3 + 1));
    pal.y = arenaH * (0.5 + 0.3 * Math.sin(pal.t * 2.1));
    if (Math.hypot(pal.x - pal.px, pal.y - pal.py) > 0.05) pal.a = Math.atan2(pal.y - pal.py, pal.x - pal.px);

    /* reward-site entries → pulse */
    fields.forEach((f, i) => {
      const inside = Math.hypot(bat.x - f.x, bat.y - f.y) < f.r;
      if (inside && !insideField[i]) rewardPulses.push({ x: f.x, y: f.y, r: 6, max: f.r + 16 });
      insideField[i] = inside;
    });
    for (let i = rewardPulses.length - 1; i >= 0; i--) {
      rewardPulses[i].r += 1.6 * k;
      if (rewardPulses[i].r > rewardPulses[i].max) rewardPulses.splice(i, 1);
    }

    /* nonlocal coding event: represent a position ahead on the flight path */
    nonlocalTimer -= k;
    if (!nonlocal && nonlocalTimer <= 0) {
      const ahead = 90 + Math.random() * 60;
      nonlocal = {
        x: Math.max(24, Math.min(W - 24, bat.x + Math.cos(bat.a) * ahead)),
        y: Math.max(26, Math.min(arenaH - 18, bat.y + Math.sin(bat.a) * ahead)),
        life: 85, max: 85,
      };
      nonlocalTimer = 340 + Math.random() * 260;
    }
    if (nonlocal) { nonlocal.life -= k; if (nonlocal.life <= 0) nonlocal = null; }

    /* echolocation: click pairs at ~8 Hz (Rousettus lingual clicks) */
    let commSpike = 0;
    clickClock += k;
    if (pendingClick >= 0) {
      pendingClick -= k;
      if (pendingClick <= 0) { commSpike = 0.9 + Math.random() * 0.1; pendingClick = -1; }
    }
    if (clickClock >= 7.5) {           /* 60 fps / 7.5 frames ≈ 8 pairs per second */
      clickClock -= 7.5;
      commSpike = 0.9 + Math.random() * 0.1;   /* first click of the pair */
      pendingClick = 2;                        /* second click ~33 ms later */
      ripples.push({ x: bat.x, y: bat.y, r: 3, max: 26 });
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].r += 1.3 * k;
      if (ripples[i].r > ripples[i].max) ripples.splice(i, 1);
    }

    /* firing-rate envelopes coupled to the behavior above */
    let spatialEnv = 0;
    for (const f of fields) {
      const d = Math.hypot(bat.x - f.x, bat.y - f.y);
      spatialEnv += Math.exp(-(d * d) / (2 * f.r * f.r));
    }
    spatialEnv = Math.min(1, spatialEnv);
    const dPal = Math.hypot(bat.x - pal.x, bat.y - pal.y);
    const socialEnv = Math.exp(-dPal / (W * 0.22));

    /* spikes: rate-modulated point processes */
    const wingSin = Math.sin(wingPhase);
    const motorSpike = (wingSin > 0.9 && lastWingSin <= 0.9) ? 0.85 + Math.random() * 0.15
      : (Math.random() < 0.02 * k ? 0.5 + Math.random() * 0.2 : 0);
    lastWingSin = wingSin;
    const nonlocalDrive = nonlocal ? 0.38 : 0;
    const spatialSpike = Math.random() < (0.015 + spatialEnv * 0.32 + nonlocalDrive) * k
      ? 0.55 + Math.max(spatialEnv, nonlocal ? 0.8 : 0) * 0.35 + Math.random() * 0.1 : 0;
    const socialSpike = Math.random() < (0.012 + socialEnv * 0.26) * k ? 0.55 + socialEnv * 0.35 + Math.random() * 0.1 : 0;

    push(traces.spatial, spatialSpike);
    push(traces.motor, motorSpike);
    push(traces.social, socialSpike);
    push(traces.comm, commSpike);
    push(envs.spatial, Math.max(spatialEnv, nonlocal ? 0.8 : 0));
    push(envs.social, socialEnv);
  }

  function push(buf, v) {
    buf.push(Math.max(0, Math.min(1.1, v)));
    if (buf.length > traceLen) buf.shift();
  }

  function drawFrame(t, force) {
    ctx.clearRect(0, 0, W, H);

    /* ---- arena backdrop ---- */
    const g = ctx.createLinearGradient(0, 0, 0, arenaH);
    g.addColorStop(0, "rgba(19,26,46,0.55)");
    g.addColorStop(1, "rgba(10,14,26,0.2)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, arenaH);
    ctx.strokeStyle = `rgba(${C.ink},0.1)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, arenaH - 1);

    /* section tags */
    ctx.font = "10.5px 'JetBrains Mono', monospace";
    ctx.fillStyle = `rgba(${C.ink},0.45)`;
    ctx.fillText("EXAMPLE BEHAVIOR: FORAGING IN FLIGHT", 14, 22);
    ctx.fillStyle = `rgba(232,195,74,0.75)`;
    ctx.fillText("NEURAL ACTIVITY · ONE BEHAVIOR, MANY BRAIN SYSTEMS", 14, laneTop + 4);
    ctx.fillStyle = `rgba(${C.ink},0.4)`;
    ctx.textAlign = "right";
    ctx.fillText("EACH TICK = ONE SPIKE", W - 14, laneTop + 4);
    ctx.textAlign = "left";

    /* ---- reward sites (drive spatial firing) ---- */
    const aS = alphaFor("spatial");
    fields.forEach((f, i) => {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${C.spatial},${0.05 * aS})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${C.spatial},${0.4 * aS})`;
      ctx.setLineDash([2, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      /* the reward itself */
      ctx.beginPath();
      ctx.arc(f.x, f.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232,195,74,${0.75 * Math.max(aS, 0.5)})`;
      ctx.fill();
      if (i === 0) {
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle = `rgba(${C.ink},0.4)`;
        ctx.fillText("REWARD SITES", f.x - 38, f.y - f.r - 8);
      }
    });
    /* reward-visit pulses */
    for (const p of rewardPulses) {
      const life = 1 - p.r / p.max;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(232,195,74,${0.55 * life})`;
      ctx.stroke();
    }

    /* ---- partner bat (social) ---- */
    const aG = alphaFor("social");
    palPhase += 0.3;
    const pFlap = Math.sin(palPhase);
    const pLen = 7 + pFlap * 2.4;
    const pLift = pFlap * 2.2;
    const pPerp = pal.a + Math.PI / 2;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `rgba(${C.social},${0.85 * aG})`;
    ctx.beginPath();
    ctx.moveTo(pal.x, pal.y);
    ctx.quadraticCurveTo(
      pal.x + Math.cos(pPerp) * pLen * 0.6, pal.y + Math.sin(pPerp) * pLen * 0.6 - pLift,
      pal.x + Math.cos(pPerp) * pLen, pal.y + Math.sin(pPerp) * pLen - pLift * 1.6
    );
    ctx.moveTo(pal.x, pal.y);
    ctx.quadraticCurveTo(
      pal.x - Math.cos(pPerp) * pLen * 0.6, pal.y - Math.sin(pPerp) * pLen * 0.6 - pLift,
      pal.x - Math.cos(pPerp) * pLen, pal.y - Math.sin(pPerp) * pLen - pLift * 1.6
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pal.x, pal.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${C.social},${0.95 * aG})`;
    ctx.fill();
    ctx.font = "9.5px 'JetBrains Mono', monospace";
    ctx.fillStyle = `rgba(${C.social},${0.75 * aG})`;
    ctx.fillText("ANOTHER BAT", pal.x + 12, pal.y + 3);
    const dPal = Math.hypot(bat.x - pal.x, bat.y - pal.y);
    if (dPal < W * 0.3) {
      ctx.beginPath();
      ctx.moveTo(bat.x, bat.y);
      ctx.lineTo(pal.x, pal.y);
      ctx.strokeStyle = `rgba(${C.social},${(0.35 * (1 - dPal / (W * 0.3))) * aG})`;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* ---- call ripples (comm) ---- */
    const aV = alphaFor("comm");
    for (const r of ripples) {
      const life = 1 - r.r / r.max;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${C.comm},${0.6 * life * aV})`;
      ctx.stroke();
    }

    /* ---- trail + bat (motor) ---- */
    const aM = alphaFor("motor");
    if (trail.length > 2) {
      for (let i = 1; i < trail.length; i++) {
        const f = i / trail.length;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `rgba(${C.ink},${(f * f * 0.4).toFixed(3)})`;
        ctx.lineWidth = 0.5 + f;
        ctx.stroke();
      }
    }
    /* nonlocal coding marker: the brain is "there", not here (Science 2021) */
    if (nonlocal) {
      const lifeF = nonlocal.life / nonlocal.max;
      const aN = alphaFor("spatial") * Math.min(1, lifeF * 2.2);
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(bat.x, bat.y);
      ctx.lineTo(nonlocal.x, nonlocal.y);
      ctx.strokeStyle = `rgba(${C.spatial},${0.45 * aN})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      const pr = 9 + 2.5 * Math.sin(t * 0.012);
      ctx.beginPath();
      ctx.arc(nonlocal.x, nonlocal.y, pr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${C.spatial},${0.9 * aN})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(nonlocal.x, nonlocal.y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${C.spatial},${aN})`;
      ctx.fill();
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = `rgba(${C.spatial},${0.9 * aN})`;
      ctx.fillText("NONLOCAL CODE · METERS AHEAD", nonlocal.x + 14, nonlocal.y + 3);
    }

    /* replay ghost: recent trajectory re-traversed at high speed (Nature 2025) */
    if (replay && savedTrail) {
      const n = Math.min(Math.floor(replay.i), savedTrail.length);
      for (let i = 0; i < n; i++) {
        const f = i / savedTrail.length;
        ctx.beginPath();
        ctx.arc(savedTrail[i].x, savedTrail[i].y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${C.spatial},${(0.12 + f * 0.5).toFixed(3)})`;
        ctx.fill();
      }
      if (n > 0 && n < savedTrail.length) {
        const head = savedTrail[n - 1];
        ctx.beginPath();
        ctx.arc(head.x, head.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${C.spatial},0.95)`;
        ctx.fill();
      }
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = `rgba(${C.spatial},0.9)`;
      ctx.fillText("REPLAY · TIME-COMPRESSED", bat.x + 14, bat.y - 12);
    } else if (mode === "rest") {
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = `rgba(${C.ink},0.5)`;
      ctx.fillText("RESTING", bat.x + 14, bat.y - 12);
    }

    /* flapping wings: two strokes oscillating with wingPhase (folded at rest) */
    const flap = mode === "rest" ? -0.6 : Math.sin(wingPhase);
    const wingLen = mode === "rest" ? 6 : 9 + flap * 3.2;
    const perp = bat.a + Math.PI / 2;
    const lift = flap * 3;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `rgba(${C.motor},${0.9 * aM})`;
    ctx.beginPath();
    ctx.moveTo(bat.x, bat.y);
    ctx.quadraticCurveTo(
      bat.x + Math.cos(perp) * wingLen * 0.6, bat.y + Math.sin(perp) * wingLen * 0.6 - lift,
      bat.x + Math.cos(perp) * wingLen, bat.y + Math.sin(perp) * wingLen - lift * 1.6
    );
    ctx.moveTo(bat.x, bat.y);
    ctx.quadraticCurveTo(
      bat.x - Math.cos(perp) * wingLen * 0.6, bat.y - Math.sin(perp) * wingLen * 0.6 - lift,
      bat.x - Math.cos(perp) * wingLen, bat.y - Math.sin(perp) * wingLen - lift * 1.6
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bat.x, bat.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${C.ink},0.95)`;
    ctx.fill();

    /* ---- lanes ---- */
    ctx.lineWidth = 1;
    LANES.forEach((lane, i) => {
      const y0 = laneTop + 12 + i * laneH;
      const a = alphaFor(lane.key);
      const col = C[lane.key];
      /* separator */
      ctx.strokeStyle = `rgba(${C.ink},0.06)`;
      ctx.beginPath();
      ctx.moveTo(0, y0 - 2);
      ctx.lineTo(W, y0 - 2);
      ctx.stroke();
      /* label */
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = `rgba(${col},${0.85 * a})`;
      ctx.fillText(lane.label, 14, y0 + 12);
      /* spike train */
      const tr = traces[lane.key];
      const baseY = y0 + laneH - 10;
      const amp = laneH - 26;
      /* faint firing-rate envelope (spatial & social) */
      const env = envs[lane.key];
      if (env) {
        ctx.beginPath();
        for (let x = 0; x < env.length; x++) {
          const y = baseY - env[x] * amp * 0.9;
          if (x === 0) ctx.moveTo(15 + x, y);
          else ctx.lineTo(15 + x, y);
        }
        ctx.strokeStyle = `rgba(${col},${0.22 * a})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      /* baseline */
      ctx.beginPath();
      ctx.moveTo(15, baseY);
      ctx.lineTo(15 + tr.length, baseY);
      ctx.strokeStyle = `rgba(${col},${0.28 * a})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      /* spikes */
      ctx.beginPath();
      for (let x = 0; x < tr.length; x++) {
        if (tr[x] > 0) {
          ctx.moveTo(15 + x + 0.5, baseY);
          ctx.lineTo(15 + x + 0.5, baseY - tr[x] * amp);
        }
      }
      ctx.strokeStyle = `rgba(${col},${a})`;
      ctx.lineWidth = a > 0.9 ? 1.5 : 1.1;
      ctx.stroke();
    });
  }

  /* ---- loop ---- */
  let rafId = null, lastT = null;
  function loop(t) {
    rafId = requestAnimationFrame(loop);
    if (lastT === null) lastT = t;
    const k = Math.min(Math.max((t - lastT) / 16.667, 0.25), 3);
    lastT = t;
    step(k);
    drawFrame(t, false);
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); if (reduced) prime(); }, 150);
  }, { passive: true });

  function prime() {
    /* pre-run the simulation so a static frame still tells the story */
    for (let i = 0; i < traceLen + 200; i++) step(1);
    drawFrame(0, true);
  }

  resize();
  if (reduced) {
    prime();
    return;
  }
  /* warm start so traces begin full */
  for (let i = 0; i < traceLen; i++) step(1);

  const vio = new IntersectionObserver(([en]) => {
    if (en.isIntersecting) {
      if (W !== canvas.clientWidth || H !== canvas.clientHeight) resize();
      if (rafId === null) { lastT = null; rafId = requestAnimationFrame(loop); }
    } else if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }, { threshold: 0 });
  vio.observe(canvas);
  rafId = requestAnimationFrame(loop);
})();
