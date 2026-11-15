// NEXORA Game Zone: "Bhaag Prabhat Bhaag" - 3-lane endless runner (pseudo-3D, full screen). Needs app.js globals: $, db, store, tone, esc, nm, av, people.
(function () {
  const cvC = $("#gcv"), gcC = cvC.getContext("2d"), cv = $("#gcv2"), gM = cv.getContext("2d");
  let g = gM;
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pick1 = a => a[(Math.random() * a.length) | 0];
  const EMO = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif", TXT = "'Space Grotesk','DM Sans',sans-serif";
  const ZF = 560, ZMAX = 2700, ZFAR = 20000;
  const MSGS = ["Pakda gaya! 😅", "Chashma toot gaya! 🤓", "Bas 5 minute aur... 😴", "Crocs phisal gaye! 🩴", "Mummy ne dekh liya! 😱"];
  const IT = { scooty: { t: 8, l: "Scooty!" }, crocs: { t: 10, l: "Jumping Crocs!" }, cat: { t: 12, l: "Billi aayi!" } };
  const TRAIN = [{ f: "#3b82f6", t: "#93c5fd", s: "#1d4ed8" }, { f: "#ef4444", t: "#fca5a5", s: "#b91c1c" }, { f: "#10b981", t: "#6ee7b7", s: "#047857" }];
  const BLD = [{ f: "#2c3170", t: "#4a52a8", s: "#222759" }, { f: "#3a2d6e", t: "#5a47a3", s: "#2a2054" }, { f: "#1f3b73", t: "#3a63b0", s: "#172c57" }];
  const LOWC = { f: "#f59e0b", t: "#fcd34d", s: "#b45309" }, BEAMC = { f: "#ef4444", t: "#fca5a5", s: "#991b1b" }, POSTC = { f: "#9ca3af", t: "#e5e7eb", s: "#6b7280" };
  let W = 1, H = 1, dpr = 1, L = 100, U = 1, hy = 0, gy = 0, cx = 0, skyG = null, skyline = [];
  let state = "ready", isOpen = false, raf = 0, last = 0, best = +(store.get("nx_hs_prabhat") || 0), msg = MSGS[0];
  let P, obs, coins, items, scen, fx, dist, score, coinN, speed, nextRow, shake, lastFree, flash;

  // ---------- projection ----------
  const sc = z => 1 / (1 + Math.max(z, -300) / ZF);
  const X = (x, z) => cx + x * L * sc(z);
  const Y = (y, z) => { const s = sc(z); return hy + (gy - hy) * s - y * U * s; };
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth || innerWidth || 400; H = cv.clientHeight || innerHeight || 700;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); gM.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; hy = H * .30; gy = H * .80; U = H * .0015; L = Math.min(W * .3, H * .27);
    skyG = gM.createLinearGradient(0, 0, 0, hy + 20); skyG.addColorStop(0, "#0f1240"); skyG.addColorStop(1, "#5a3590");
    skyline = Array.from({ length: 26 }, (_, i) => [i / 26, rnd(.02, .09), 1 / 26 + .004]);
  }
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.closePath(); };
  function poly(pts, fill, stroke) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); } }
  function box(x, hw, y0, y1, z0, z1, c) {
    const xl = x - hw, xr = x + hw, p = (a, b, z) => [X(a, z), Y(b, z)], ol = "rgba(0,0,0,.45)";
    if (x < -.3) poly([p(xr, y0, z0), p(xr, y0, z1), p(xr, y1, z1), p(xr, y1, z0)], c.s, ol);
    else if (x > .3) poly([p(xl, y0, z0), p(xl, y0, z1), p(xl, y1, z1), p(xl, y1, z0)], c.s, ol);
    poly([p(xl, y1, z0), p(xr, y1, z0), p(xr, y1, z1), p(xl, y1, z1)], c.t, ol);
    poly([p(xl, y0, z0), p(xr, y0, z0), p(xr, y1, z0), p(xl, y1, z0)], c.f, ol);
  }

  // ---------- world ----------
  const mkB = (side, z) => ({ side, z, w: rnd(1.1, 2.1), h: rnd(220, 620), gap: rnd(0, .5), c: pick1(BLD), seed: (Math.random() * 7) | 0 });
  function reset() {
    P = { px: 0, lane: 0, y: 0, vy: 0, roll: 0, jumps: 0, ph: 0, scooty: 0, crocs: 0, cat: 0, saves: 0, inv: 0 };
    obs = []; coins = []; items = []; fx = []; dist = 0; score = 0; coinN = 0; speed = 8; nextRow = 1100; shake = 0; lastFree = 1; flash = 0;
    scen = []; for (const s of [-1, 1]) for (let z = 0; z < ZMAX + 300; z += 230) scen.push(mkB(s, z + rnd(0, 60)));
  }
  function makeRow(z) {
    lastFree = clamp(lastFree + pick1([-1, 0, 0, 1]), 0, 2); const free = lastFree;
    const mk = (k, ln) => k === "train" ? { k, ln, z, d: 420, y0: 0, y1: 170, c: pick1(TRAIN) } : k === "low" ? { k, ln, z, d: 40, y0: 0, y1: 44 } : { k, ln, z, d: 40, y0: 72, y1: 110 };
    for (let i = 0; i < 3; i++) {
      const ln = i - 1;
      if (i === free) { if (Math.random() < .3) obs.push(mk(Math.random() < .5 ? "low" : "beam", ln)); continue; }
      const r = Math.random(); if (r < .4) obs.push(mk("train", ln)); else if (r < .68) obs.push(mk("low", ln)); else if (r < .88) obs.push(mk("beam", ln));
    }
    if (!obs.some(o => o.z === z && o.ln === free - 1)) for (let k = 0; k < 8; k++) coins.push({ ln: free - 1, z: z - 280 + k * 90 });
    if (Math.random() < .12 && !obs.some(o => o.z === z && o.ln === free - 1)) items.push({ ln: free - 1, z: z - 120, n: pick1(["scooty", "crocs", "cat"]) });
  }
  function jump() {
    if (state !== "play") return;
    const max = P.crocs > 0 ? 2 : 1;
    if (P.y <= 0) { P.vy = P.crocs > 0 ? 15.8 : 14.6; P.jumps = 1; P.roll = 0; tone([[520, .06], [700, .06]]); }
    else if (P.jumps < max) { P.vy = 14.6; P.jumps++; tone([[760, .07]]); }
  }
  function roll() { if (state !== "play") return; if (P.y > 0) P.vy -= 9; else { P.roll = 38; tone([[300, .06]]); } }
  function lane(d) { if (state !== "play") return; P.lane = clamp(P.lane + d, -1, 1); tone([[440, .03]]); }
  function start() { reset(); state = "play"; last = performance.now(); }
  function act() { if (state === "paused") { state = "play"; last = performance.now(); } else if (state !== "play") start(); }
  const pop = (x, y, txt) => fx.push({ x, y, vx: 0, vy: -.7, l: 1.5, txt });
  const burst = (x, y, c) => { for (let i = 0; i < 10; i++) fx.push({ x, y, vx: rnd(-4, 4), vy: rnd(-5, 1), l: 1, c }); };
  function die() {
    state = "over"; shake = 12; flash = 1; msg = pick1(MSGS); tone([[220, .15], [130, .3]]);
    if (score > best) { best = score; store.set("nx_hs_prabhat", best); }
    if (score > 0) db.rpc("ah_submit_score", { p_game: "prabhat", p_score: score }).then(lb, () => {});
  }
  function step(f) {
    const sp = speed * (P.scooty > 0 ? 1.35 : 1);
    dist += sp * f; score = Math.floor(dist / 80) + coinN * 5; speed = Math.min(20, 8 + dist / 9000);
    P.ph += (.16 + sp * .012) * f; P.px += (P.lane - P.px) * Math.min(1, .24 * f);
    if (P.y > 0 || P.vy !== 0) { P.vy -= .8 * f; P.y += P.vy * f; if (P.y <= 0) { P.y = 0; P.vy = 0; P.jumps = 0; } }
    P.roll = Math.max(0, P.roll - f); P.inv = Math.max(0, P.inv - f);
    ["scooty", "crocs", "cat"].forEach(n => { P[n] = Math.max(0, P[n] - f / 60); }); if (P.cat <= 0) P.saves = 0;
    nextRow -= sp * f; if (nextRow <= 0) { makeRow(ZMAX); nextRow = Math.max(760, speed * 44); }
    scen.forEach(b => { b.z -= sp * f; if (b.z < -260) Object.assign(b, mkB(b.side, b.z + ZMAX + 300)); });
    const p0 = P.y, p1 = P.y + (P.roll > 0 ? 44 : 108);
    for (const o of obs) {
      o.z -= sp * f; if (o.dead) continue;
      if (o.z < 20 && o.z + o.d > -20 && Math.abs(P.px - o.ln) < .62 && p0 < o.y1 && p1 > o.y0) {
        if (P.scooty > 0) { o.dead = true; dist += 800; burst(X(o.ln, Math.max(o.z, 0)), Y(60, Math.max(o.z, 0)), "#fff"); pop(X(o.ln, 0), Y(100, 0), "+10"); tone([[400, .05]]); }
        else if (P.saves > 0) { P.saves--; P.inv = 45; o.dead = true; pop(X(P.px, 0), Y(120, 0), "Meow!"); tone([[900, .08], [700, .1]]); }
        else if (P.inv <= 0) return die();
      }
    }
    obs = obs.filter(o => !o.dead && o.z + o.d > -150);
    for (const c of coins) { c.z -= sp * f; if (!c.got && Math.abs(c.z) < 45 && Math.abs(P.px - c.ln) < .55 && Math.abs(P.y - 36) < 80) { c.got = true; coinN++; tone([[988, .04], [1319, .06]]); } }
    coins = coins.filter(c => !c.got && c.z > -150);
    for (const it of items) { it.z -= sp * f; if (Math.abs(it.z) < 50 && Math.abs(P.px - it.ln) < .6 && P.y < 130) { it.got = true; P[it.n] = IT[it.n].t; if (it.n === "cat") P.saves = 2; dist += 800; pop(X(P.px, 0), Y(130, 0), IT[it.n].l); burst(X(P.px, 0), Y(60, 0), "#ffd166"); tone([[660, .08], [990, .1]]); } }
    items = items.filter(i => !i.got && i.z > -150);
    fx.forEach(p => { p.x += p.vx * f; p.y += p.vy * f; if (!p.txt) p.vy += .25 * f; p.l -= .03 * f; }); fx = fx.filter(p => p.l > 0);
    if (shake > 0) shake -= f * .6; if (flash > 0) flash -= .04 * f;
  }

  // ---------- characters ----------
  function croc(x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = col || "#76c442";
    g.beginPath(); g.ellipse(0, -1, 9, 6.5, 0, Math.PI, 0); g.fill(); g.fillStyle = "#5aa22c"; g.fillRect(-10, -1, 21, 3.5);
    g.fillStyle = "rgba(0,0,0,.45)"; [-4, 0, 4].forEach(dx => { g.beginPath(); g.arc(dx, -4, 1.1, 0, 6.3); g.fill(); }); g.restore();
  }
  // Prabhat seen from behind (height ~80 units). pose: 0 run, 1 air, 2 roll, 3 scooty
  function prabhatBack(x, y, S, ph, pose, crocsOn, tilt) {
    g.save(); g.translate(x, y); g.scale(S, S); g.rotate(tilt || 0);
    const skin = "#f3d5ba", short = "#c9b28a", tee = "#12a4a0", hair = "#2a1a12", a = Math.sin(ph), b = Math.sin(ph + Math.PI);
    if (pose === 2) { g.translate(0, -2); g.scale(1.15, .5); }
    if (pose === 3) {
      g.fillStyle = "#222"; g.beginPath(); g.ellipse(0, -7, 9, 8, 0, 0, 6.3); g.fill(); g.fillStyle = "#e5484d"; rr(-14, -24, 28, 18, 8); g.fill();
      g.strokeStyle = "#222"; g.lineWidth = 3; g.beginPath(); g.moveTo(-20, -28); g.lineTo(20, -28); g.stroke(); g.translate(0, -12);
    }
    const air = pose === 1 || pose === 3;
    [[-6, a], [6, b]].forEach(([lx, s]) => {
      const lift = air ? 6 : Math.max(0, s) * 10; g.lineCap = "round";
      g.strokeStyle = short; g.lineWidth = 11; g.beginPath(); g.moveTo(lx, -34); g.lineTo(lx, -24 - lift * .5); g.stroke();
      g.strokeStyle = skin; g.lineWidth = 8; g.beginPath(); g.moveTo(lx, -24 - lift * .5); g.lineTo(lx, -5 - lift); g.stroke();
      if (crocsOn) { g.shadowColor = "#b8ff4a"; g.shadowBlur = 12; }
      g.fillStyle = "#76c442"; g.beginPath(); g.ellipse(lx, -4 - lift, 8, 4.5, 0, 0, 6.3); g.fill(); g.shadowBlur = 0; g.fillStyle = "#5aa22c"; g.fillRect(lx - 7, -2 - lift, 14, 3);
    });
    g.fillStyle = short; g.fillRect(-12, -36, 24, 10);
    g.fillStyle = tee; g.beginPath(); g.moveTo(-18, -59); g.lineTo(18, -59); g.lineTo(10, -34); g.lineTo(-10, -34); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(-3, -54, 6, 18);
    [[-1, b], [1, a]].forEach(([sd, s]) => {
      const ex = sd * 22, ey = -41 + s * 4, hy2 = -30 + s * 8;
      g.strokeStyle = skin; g.lineWidth = 9; g.beginPath(); g.moveTo(sd * 17, -54); g.lineTo(ex, ey); g.stroke(); g.lineWidth = 7; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex, hy2); g.stroke();
      g.fillStyle = skin; g.beginPath(); g.arc(sd * 20, -47, 6.5, 0, 6.3); g.fill(); g.beginPath(); g.arc(ex, hy2 + 3, 4, 0, 6.3); g.fill();
    });
    g.fillStyle = skin; g.fillRect(-3, -64, 6, 7);
    [-1, 1].forEach(sd => {   // ears + thick glasses bulging past the head
      g.fillStyle = skin; g.beginPath(); g.arc(sd * 10, -66, 3.4, 0, 6.3); g.fill();
      g.fillStyle = "rgba(190,225,255,.7)"; g.strokeStyle = "#111"; g.lineWidth = 3; g.beginPath(); g.ellipse(sd * 14, -65, 4.2, 6.8, 0, 0, 6.3); g.fill(); g.stroke();
    });
    g.fillStyle = hair; g.beginPath(); g.ellipse(0, -69, 11.5, 11.5, 0, 0, 6.3); g.fill();
    g.beginPath(); g.moveTo(-12, -67); g.lineTo(-11.5, -58);
    for (let i = 0; i < 4; i++) { const x0 = -11.5 + i * 5.75; g.quadraticCurveTo(x0 + 2.9, -51 + (i % 2) * 3 + Math.sin(ph * 2 + i) * 1.2, x0 + 5.75, -58); }
    g.lineTo(12, -67); g.closePath(); g.fill();
    g.strokeStyle = "#4a2e22"; g.lineWidth = 1.2; g.beginPath(); g.arc(-3, -72, 5, 3.4, 5.2); g.arc(4, -70, 4, 3.6, 5.4); g.stroke();
    g.restore();
  }
  // side profile (menu / cover): big thick glasses, wavy hair, crocs
  function prabhatSide(x, y, S, ph) {
    g.save(); g.translate(x, y); g.scale(S, S); g.lineCap = "round";
    const skin = "#f3d5ba", skinD = "#e0b998", a = Math.sin(ph);
    const leg = (ox, q, front) => { const fx = ox + Math.sin(q) * 14, fy = -2 - Math.max(0, Math.cos(q)) * 9, kx = (ox + fx) / 2 + 5, ky = (-26 + fy) / 2;
      g.strokeStyle = "#c9b28a"; g.lineWidth = 11; g.beginPath(); g.moveTo(ox, -26); g.lineTo(kx, ky); g.stroke(); g.strokeStyle = front ? skin : skinD; g.lineWidth = 8; g.beginPath(); g.moveTo(kx, ky); g.lineTo(fx, fy); g.stroke(); croc(fx + 3, fy + 2, 1.05); };
    const arm = (q, front) => { const ex = 4 + Math.sin(q) * 11, ey = -36, hx = ex + 6 + Math.sin(q) * 6; g.strokeStyle = front ? skin : skinD; g.lineWidth = 9; g.beginPath(); g.moveTo(0, -50); g.lineTo(ex, ey); g.stroke(); g.lineWidth = 7; g.beginPath(); g.moveTo(ex, ey); g.lineTo(hx, ey + 8); g.stroke();
      g.fillStyle = front ? skin : skinD; g.beginPath(); g.arc(ex / 2 + 1, -43, 5.5, 0, 6.3); g.fill(); g.beginPath(); g.arc(hx, ey + 8, 4, 0, 6.3); g.fill(); };
    leg(-3, ph + Math.PI, false); arm(ph, false);
    g.fillStyle = "#12a4a0"; g.beginPath(); g.moveTo(-12, -52); g.lineTo(12, -52); g.lineTo(9, -26); g.lineTo(-8, -26); g.closePath(); g.fill(); g.fillStyle = "#c9b28a"; g.fillRect(-9, -29, 19, 8);
    leg(3, ph, true); arm(ph + Math.PI, true);
    g.fillStyle = skin; g.fillRect(-1, -57, 6, 7);
    g.fillStyle = "#2a1a12"; g.beginPath(); g.moveTo(-9, -72); g.quadraticCurveTo(-18, -66 + a * 1.5, -13, -60); g.quadraticCurveTo(-19, -56, -10, -52); g.quadraticCurveTo(-8, -62, -3, -66); g.closePath(); g.fill();
    g.fillStyle = skin; g.beginPath(); g.ellipse(2, -63, 9.5, 11, 0, 0, 6.3); g.fill();
    g.fillStyle = "#2a1a12"; g.beginPath(); g.moveTo(-8, -62); g.quadraticCurveTo(-8, -78, 4, -76); g.quadraticCurveTo(13, -75, 12, -66); g.quadraticCurveTo(4, -70, -1, -64); g.quadraticCurveTo(-4, -62, -8, -62); g.fill();
    [[-1, .55], [10, 1]].forEach(l => { g.fillStyle = "rgba(190,225,255," + (.55 * l[1] + .1) + ")"; g.beginPath(); g.arc(l[0], -63, 7.6, 0, 6.3); g.fill(); g.strokeStyle = "#111"; g.lineWidth = 2.6; g.stroke();
      g.strokeStyle = "rgba(60,90,130,.55)"; g.lineWidth = .8; g.beginPath(); g.arc(l[0], -63, 5.3, 0, 6.3); g.stroke(); g.fillStyle = "#fff"; g.beginPath(); g.arc(l[0] + 1, -63, 4.4, 0, 6.3); g.fill(); g.fillStyle = "#222"; g.beginPath(); g.arc(l[0] + 2.2, -63, 2.2, 0, 6.3); g.fill(); });
    g.strokeStyle = "#111"; g.lineWidth = 2; g.beginPath(); g.moveTo(6.5, -63); g.lineTo(3, -63); g.moveTo(-8, -63); g.lineTo(-10, -61); g.stroke();
    g.strokeStyle = "#a45f4a"; g.lineWidth = 1.4; g.beginPath(); g.arc(8, -56, 2.6, .2, 2.8); g.stroke(); g.restore();
  }
  const emoji = (e, x, y, size) => { g.font = size + "px " + EMO; g.textAlign = "center"; g.textBaseline = "bottom"; g.fillText(e, x, y); };

  // ---------- drawing ----------
  function drawObs(o) {
    const z = o.z, x = o.ln, rect = (hw, h0, h1) => { const a = X(x - hw, z), b = X(x + hw, z), yt = Y(h1, z), yb = Y(h0, z); return [a, yt, b - a, yb - yt]; };
    const stripes = (r, col) => { g.fillStyle = col; for (let i = 0; i < 5; i++) { const x0 = r[0] + r[2] * i * .2; g.beginPath(); g.moveTo(x0, r[1] + r[3]); g.lineTo(x0 + r[2] * .1, r[1] + r[3]); g.lineTo(x0 + r[2] * .2, r[1]); g.lineTo(x0 + r[2] * .1, r[1]); g.closePath(); g.fill(); } };
    if (o.k === "train") {
      box(x, .43, 0, 170, z, z + o.d, o.c); const [a, yt, w, h] = rect(.43, 0, 170);
      g.fillStyle = "#0b1226"; g.fillRect(a + w * .12, yt + h * .1, w * .76, h * .3); g.fillStyle = "rgba(180,220,255,.5)"; g.fillRect(a + w * .12, yt + h * .1, w * .76, h * .07);
      g.fillStyle = "#ffe08a"; [.2, .8].forEach(q => { g.beginPath(); g.arc(a + w * q, yt + h * .8, Math.max(2, w * .06), 0, 6.3); g.fill(); }); g.fillStyle = "#111"; g.fillRect(a, yt + h * .93, w, h * .07);
    } else if (o.k === "low") { box(x, .46, 0, 44, z, z + 40, LOWC); stripes(rect(.46, 0, 44), "#222"); }
    else { box(x - .44, .05, 0, 110, z, z + 40, POSTC); box(x + .44, .05, 0, 110, z, z + 40, POSTC); box(x, .5, 72, 110, z, z + 40, BEAMC); stripes(rect(.5, 72, 110), "#fff"); }
  }
  function drawBld(b) {
    const x = b.side * (1.9 + b.w / 2 + b.gap), z = b.z; box(x, b.w / 2, 0, b.h, z, z + 200, b.c);
    const a = X(x - b.w / 2, z), bb = X(x + b.w / 2, z), yt = Y(b.h, z), yb = Y(0, z), w = bb - a, h = yb - yt, rows = Math.max(2, Math.floor(b.h / 80));
    g.fillStyle = "rgba(255,214,120,.55)"; for (let r = 0; r < rows; r++) for (let c = 0; c < 3; c++) if ((r + c + b.seed) % 3) g.fillRect(a + w * (.12 + c * .3), yt + h * (.08 + r / rows * .86), w * .18, h * .5 / rows);
  }
  function hud() {
    const fs = clamp(Math.min(W, H) * .045, 15, 26), pad = Math.max(12, W * .03), ph = fs * 1.9;
    g.textBaseline = "middle"; g.textAlign = "left"; g.font = "700 " + fs + "px " + TXT;
    const pill = (y, w) => { g.fillStyle = "rgba(8,10,35,.7)"; rr(pad, y, w, ph, ph / 2); g.fill(); };
    pill(pad, fs * 8.6); g.fillStyle = "#fff"; g.fillText("SCORE " + score, pad + fs * .8, pad + ph / 2 + 1);
    const y2 = pad + ph + 6; pill(y2, fs * 8.6);
    g.fillStyle = "#ffd23f"; g.beginPath(); g.arc(pad + fs * 1.1, y2 + ph / 2, fs * .5, 0, 6.3); g.fill(); g.fillStyle = "#b7860b"; g.beginPath(); g.arc(pad + fs * 1.1, y2 + ph / 2, fs * .25, 0, 6.3); g.fill();
    g.fillStyle = "#fff"; g.fillText(coinN + "     BEST " + best, pad + fs * 1.9, y2 + ph / 2 + 1);
    let y = y2 + ph + 6;
    for (const n of ["scooty", "crocs", "cat"]) if (P[n] > 0) {
      pill(y, fs * 8.6); g.fillStyle = "rgba(255,255,255,.18)"; rr(pad + fs * 2.4, y + ph * .38, fs * 5.6, ph * .24, 4); g.fill();
      g.fillStyle = "#ffd166"; rr(pad + fs * 2.4, y + ph * .38, Math.max(4, fs * 5.6 * P[n] / IT[n].t), ph * .24, 4); g.fill();
      if (n === "crocs") croc(pad + fs * 1.2, y + ph * .72, fs / 12); else { g.fillStyle = "#fff"; emoji(n === "cat" ? "🐱" : "🛵", pad + fs * 1.2, y + ph * .86, fs * 1.1); }
      if (n === "cat") { g.fillStyle = "#fff"; g.textBaseline = "middle"; g.textAlign = "left"; g.font = "700 " + fs * .8 + "px " + TXT; g.fillText("x" + P.saves, pad + fs * 8, y + ph / 2); g.font = "700 " + fs + "px " + TXT; }
      y += ph + 6;
    }
  }
  function overlay(title, l1, l2, cta) {
    g.fillStyle = "rgba(6,8,30,.78)"; g.fillRect(0, 0, W, H);
    const wide = W > H * 1.1, pw = Math.min(W * .92, 620), ph = Math.min(H * .86, wide ? 330 : 520), px = (W - pw) / 2, py = (H - ph) / 2;
    g.fillStyle = "rgba(24,28,80,.9)"; rr(px, py, pw, ph, 22); g.fill(); g.strokeStyle = "rgba(160,150,255,.5)"; g.lineWidth = 2; g.stroke();
    const S = (wide ? ph * .62 : ph * .36) / 80, cxm = wide ? px + pw * .2 : W / 2, cym = wide ? py + ph * .8 : py + ph * .42, tx = wide ? px + pw * .4 : W / 2, ty = wide ? py + ph * .26 : py + ph * .5;
    prabhatSide(cxm, cym, S, performance.now() / 160);
    g.textAlign = wide ? "left" : "center"; g.textBaseline = "alphabetic";
    const tw = wide ? pw * .55 : pw * .9; let fs = clamp(Math.min(pw * .075, ph * .08), 18, 34);
    g.fillStyle = "#fff"; g.font = "700 " + fs + "px " + TXT; g.fillText(title, tx, ty, tw);
    g.fillStyle = "#c9ccf0"; g.font = Math.max(13, fs * .55) + "px " + TXT; g.fillText(l1, tx, ty + fs * 1.3, tw); g.fillText(l2, tx, ty + fs * 2.1, tw);
    g.fillStyle = "#ffd166"; g.font = "700 " + fs * .75 + "px " + TXT; g.fillText(cta + (((performance.now() / 500) | 0) % 2 ? " <" : ""), tx, ty + fs * 3.4, tw);
  }
  function draw() {
    const t = performance.now(); g.save(); g.textAlign = "left"; g.textBaseline = "alphabetic";
    if (shake > 0) g.translate(rnd(-shake, shake), rnd(-shake, shake));
    g.fillStyle = skyG; g.fillRect(0, 0, W, hy + 2);
    g.fillStyle = "#fff5c4"; g.beginPath(); g.arc(W * .8, hy * .45, Math.min(W, H) * .05, 0, 6.3); g.fill();
    g.fillStyle = "#1a1e52"; skyline.forEach(b => g.fillRect(b[0] * W, hy - b[1] * H, b[2] * W, b[1] * H + 2));
    g.fillStyle = "#151940"; g.fillRect(0, hy, W, H - hy);
    poly([[X(-1.55, ZFAR), Y(0, ZFAR)], [X(1.55, ZFAR), Y(0, ZFAR)], [X(1.55, -250), Y(0, -250)], [X(-1.55, -250), Y(0, -250)]], "#2b3066");
    [-1.5, 1.5].forEach(e => { g.strokeStyle = "rgba(199,210,254,.85)"; g.lineWidth = Math.max(2, W * .005); g.beginPath(); g.moveTo(X(e, ZFAR), Y(0, ZFAR)); g.lineTo(X(e, -250), Y(0, -250)); g.stroke(); });
    if (P) {
      const off = dist % 240; g.fillStyle = "rgba(255,255,255,.55)";
      for (let z = -off - 240; z < 4200; z += 240) [-.5, .5].forEach(e => { const z0 = Math.max(z, -250), z1 = z + 110; if (z1 > z0) poly([[X(e - .025, z0), Y(0, z0)], [X(e + .025, z0), Y(0, z0)], [X(e + .025, z1), Y(0, z1)], [X(e - .025, z1), Y(0, z1)]], "rgba(255,255,255,.55)"); });
      const list = [];
      scen.forEach(b => list.push({ z: b.z, f: () => drawBld(b) }));
      obs.forEach(o => list.push({ z: o.z, f: () => drawObs(o) }));
      coins.forEach(c => list.push({ z: c.z, f: () => { const s = sc(c.z), r = 13 * U * s, w = Math.max(2, Math.abs(Math.cos(t / 220 + c.z / 90)) * r), cxp = X(c.ln, c.z), cyp = Y(36, c.z);
        g.fillStyle = "#ffd23f"; g.strokeStyle = "#8a5a00"; g.lineWidth = Math.max(1, r * .15); g.beginPath(); g.ellipse(cxp, cyp, w, r, 0, 0, 6.3); g.fill(); g.stroke(); } }));
      items.forEach(it => list.push({ z: it.z, f: () => { const s = sc(it.z), cxp = X(it.ln, it.z), cyp = Y(60 + Math.sin(t / 250) * 8, it.z), r = 30 * U * s;
        g.fillStyle = "rgba(255,255,255,.22)"; g.beginPath(); g.arc(cxp, cyp - r * .3, r * 1.1, 0, 6.3); g.fill(); g.strokeStyle = "#ffd166"; g.lineWidth = 2; g.stroke();
        if (it.n === "crocs") croc(cxp, cyp + r * .2, r / 9); else { g.fillStyle = "#fff"; emoji(it.n === "cat" ? "🐱" : "🛵", cxp, cyp + r * .5, r * 1.5); } } }));
      list.push({ z: 0, f: drawPlayer }); list.sort((a, b) => b.z - a.z);
      list.forEach(d => { g.globalAlpha = clamp((ZMAX + 100 - d.z) / 500, 0, 1); d.f(); }); g.globalAlpha = 1;
      for (const p of fx) { g.globalAlpha = clamp(p.l, 0, 1); if (p.txt) { g.fillStyle = "#ffd166"; g.strokeStyle = "#000"; g.lineWidth = 3; g.font = "700 " + clamp(H * .035, 16, 28) + "px " + TXT; g.textAlign = "center"; g.strokeText(p.txt, p.x, p.y); g.fillText(p.txt, p.x, p.y); } else { g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 3, 0, 6.3); g.fill(); } }
      g.globalAlpha = 1; hud();
      if (flash > 0) { g.fillStyle = "rgba(255,60,60," + flash * .45 + ")"; g.fillRect(0, 0, W, H); }
    }
    if (state === "ready") overlay("Bhaag Prabhat Bhaag", "Swipe left/right: lane   Up: jump   Down: roll", "Coins lo, trains se bacho, power-ups pakdo!", "Tap to start");
    if (state === "over") overlay(msg, "Score " + score + "   Coins " + coinN + "   Best " + best, "Power-ups: Scooty, Jumping Crocs, Billi", "Tap to run again");
    if (state === "paused") overlay("Paused", "Game roka gaya hai.", "Wapas aane ke liye tap karo.", "Tap to continue");
    g.restore();
  }
  function drawPlayer() {
    const sx = X(P.px, 0), sy = Y(P.y, 0), S = (108 * U) / 80, pose = P.scooty > 0 ? 3 : P.y > 4 ? 1 : P.roll > 0 ? 2 : 0;
    g.fillStyle = "rgba(0,0,0," + clamp(.38 - P.y / 500, .1, .38) + ")"; g.beginPath(); g.ellipse(sx, Y(0, 0), 26 * S, 7 * S, 0, 0, 6.3); g.fill();
    if (P.cat > 0) { g.fillStyle = "#fff"; emoji("🐱", X(P.px + (P.px > 0 ? -.62 : .62), 60), Y(Math.abs(Math.sin(performance.now() / 130)) * 10, 60), 46 * U * sc(60)); }
    if (P.scooty > 0 && P.scooty < 1.5 && ((performance.now() / 100) | 0) % 2) return;
    prabhatBack(sx, sy, S, P.ph, pose, P.crocs > 0, (P.lane - P.px) * .25);
  }
  function drawCover() {
    const w = cvC.clientWidth || 600, h = Math.round(w * 9 / 16), d = Math.min(devicePixelRatio || 1, 2), o = g, c = gcC;
    cvC.width = w * d; cvC.height = h * d; c.setTransform(d, 0, 0, d, 0, 0); g = c;
    const sk = c.createLinearGradient(0, 0, 0, h); sk.addColorStop(0, "#0f1240"); sk.addColorStop(1, "#5a3590"); c.fillStyle = sk; c.fillRect(0, 0, w, h);
    c.fillStyle = "#2b3066"; c.beginPath(); c.moveTo(w * .62, h * .34); c.lineTo(w * .72, h * .34); c.lineTo(w * 1.05, h); c.lineTo(w * .3, h); c.closePath(); c.fill();
    c.strokeStyle = "rgba(255,255,255,.5)"; c.lineWidth = 2; [[.655, .3925], [.685, .5925]].forEach(l => { c.beginPath(); c.moveTo(w * l[0], h * .34); c.lineTo(w * (l[0] - .2 + l[1] * 0 + (l[0] > .67 ? .4 : 0)), h); c.stroke(); });
    prabhatSide(w * .26, h * .92, h * .72 / 80, 1);
    c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillStyle = "#fff"; c.font = "700 " + h * .13 + "px " + TXT; c.fillText("BHAAG", w * .46, h * .32); c.fillText("PRABHAT", w * .46, h * .48); c.fillStyle = "#ffd166"; c.fillText("BHAAG!", w * .46, h * .64);
    c.fillStyle = "#c9ccf0"; c.font = h * .055 + "px " + TXT; c.fillText("3-lane endless runner", w * .46, h * .76); g = o;
  }
  async function lb() {
    const r = await db.from("game_scores").select("user_id,score").eq("game", "prabhat").order("score", { ascending: false }).limit(10);
    if (r.error) { $("#glb").innerHTML = `<p class="mut">Leaderboard ke liye migration-05-game.sql run karo.</p>`; return; }
    $("#glb").innerHTML = r.data.length ? r.data.map((x, i) => `<div class="mem"><b>${i + 1}</b>${av(people[x.user_id], 32)}<div><b>${esc(nm(x.user_id))}</b></div><b>${x.score}</b></div>`).join("") : `<p class="mut">Abhi koi score nahi. Pehle tum khelo!</p>`;
  }

  // ---------- full screen shell ----------
  function loop(now) {
    if (!isOpen) { raf = 0; return; }
    raf = requestAnimationFrame(loop); const f = clamp((now - last) / 16.667 || 1, 0, 3); last = now;
    if (document.hidden && state === "play") state = "paused";
    if (state === "play") step(f); else { if (shake > 0) shake -= f * .6; if (flash > 0) flash -= .04 * f; }
    draw();
  }
  async function openGame() {
    const el = $("#gplay"); el.classList.remove("hide"); document.body.style.overflow = "hidden"; isOpen = true;
    try { if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" }); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); } catch (_) {}
    resize(); reset(); state = "ready"; last = performance.now(); if (!raf) raf = requestAnimationFrame(loop);
  }
  function closeGame() {
    isOpen = false; cancelAnimationFrame(raf); raf = 0; if (state === "play") state = "paused";
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {}
    $("#gplay").classList.add("hide"); document.body.style.overflow = ""; drawCover(); lb();
  }
  window.loadGame = function () { drawCover(); lb(); };
  window.NXG = { forceOpen() { isOpen = true; resize(); reset(); state = "ready"; }, start, step, draw, jump, roll, lane, die, state: () => state, drawCover, score: () => score, obs: () => obs, P: () => P, sp: () => speed };

  // ---------- input ----------
  $("#gplaybtn").addEventListener("click", openGame); cvC.addEventListener("click", openGame);
  $("#gx").addEventListener("click", closeGame);
  $("#gps").addEventListener("click", () => { if (state === "play") state = "paused"; else if (state === "paused") act(); });
  document.addEventListener("fullscreenchange", () => { if (isOpen && !document.fullscreenElement) closeGame(); else if (isOpen) resize(); });
  addEventListener("resize", () => { if (isOpen) resize(); }); addEventListener("orientationchange", () => setTimeout(() => { if (isOpen) resize(); }, 250));
  let sx0 = 0, sy0 = 0, acted = false;
  cv.addEventListener("pointerdown", e => { e.preventDefault(); sx0 = e.clientX; sy0 = e.clientY; acted = false; if (state !== "play") { act(); acted = true; } });
  cv.addEventListener("pointermove", e => {
    if (acted || state !== "play" || !(e.buttons & 1)) return;
    const dx = e.clientX - sx0, dy = e.clientY - sy0; if (Math.hypot(dx, dy) < 32) return;
    acted = true; if (Math.abs(dx) > Math.abs(dy)) lane(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else roll();
  });
  cv.addEventListener("pointerup", () => { if (!acted && state === "play") jump(); });
  addEventListener("keydown", e => {
    if (!isOpen) return; const c = e.code;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(c)) e.preventDefault();
    if (state !== "play") { if (c === "Space" || c === "Enter") act(); return; }
    if (c === "ArrowLeft" || c === "KeyA") lane(-1); else if (c === "ArrowRight" || c === "KeyD") lane(1);
    else if (c === "ArrowUp" || c === "KeyW" || c === "Space") jump(); else if (c === "ArrowDown" || c === "KeyS") roll(); else if (c === "KeyP") state = "paused";
  });
  reset();
})();
