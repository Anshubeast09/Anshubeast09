// NEXORA Game Zone: "Nail Ninja" - slice fruit with stylish nails; coins unlock nail colours & patterns.
// Needs app.js globals: $, $$, db, store, tone, esc, nm, av, people, toast, go.
(function () {
  const cvR = $("#ncvr"), gcR = cvR.getContext("2d"), cv = $("#ncv"), gM = cv.getContext("2d");
  let g = gM;
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pick1 = a => a[(Math.random() * a.length) | 0];
  const EMO = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif", TXT = "'Space Grotesk','DM Sans',sans-serif";
  const COLORS = [["c_red", "Ruby", "#e11d48", 0], ["c_pink", "Bubblegum", "#f472b6", 40], ["c_nude", "Nude", "#e8b7a0", 40], ["c_blue", "Ocean", "#3b82f6", 80], ["c_mint", "Mint", "#34d399", 80], ["c_purple", "Violet", "#8b5cf6", 120], ["c_black", "Noir", "#1f2937", 120], ["c_gold", "Gold", "#f5c542", 200]];
  const PATS = [["p_solid", "Solid", "", 0], ["p_french", "French tip", "", 100], ["p_stripes", "Stripes", "", 150], ["p_glitter", "Glitter", "", 200], ["p_hearts", "Hearts", "", 250], ["p_stars", "Stars", "", 250], ["p_ombre", "Ombre", "", 300], ["p_galaxy", "Galaxy", "", 400]];
  const FR = [{ n: "watermelon", sk: "#2f9e44", fl: "#ff4d6d", sd: "#111", r: 1.15 }, { n: "orange", sk: "#ff9f1c", fl: "#ffc857", sd: null, r: 1 }, { n: "apple", sk: "#e63946", fl: "#fff1d0", sd: "#6b3b1d", r: 1 }, { n: "kiwi", sk: "#8a6a45", fl: "#8bd450", sd: "#111", r: .9 }, { n: "lemon", sk: "#ffe14d", fl: "#fff7ae", sd: null, r: .9 }];
  const colorOf = id => (COLORS.find(c => c[0] === id) || COLORS[0])[2];
  let wallet = { coins: 0, unlocked: ["c_red", "p_solid"], color: "c_red", pattern: "p_solid", offline: true };
  let W = 1, H = 1, dpr = 1, sky = null, bokeh = [], state = "ready", isOpen = false, raf = 0, last = 0, best = +(store.get("nx_hs_nail") || 0), down = false, lastP = null;
  let items, halves, parts, pops, trail, segs, score, runCoins, lives, level, nextWave, slow, combo, comboT, shake, flash, mood, moodT;

  // ---------- nails ----------
  function nailPath(c, w, h) { c.beginPath(); c.moveTo(-w / 2, -h * .14); c.quadraticCurveTo(-w / 2, 0, 0, 0); c.quadraticCurveTo(w / 2, 0, w / 2, -h * .14); c.lineTo(w * .34, -h * .97); c.quadraticCurveTo(w * .34, -h, w * .28, -h); c.lineTo(-w * .28, -h); c.quadraticCurveTo(-w * .34, -h, -w * .34, -h * .97); c.closePath(); }
  function star(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); c.fill(); }
  function heart(c, x, y, s) { c.beginPath(); c.moveTo(x, y + s * .35); c.bezierCurveTo(x - s * .9, y - s * .3, x - s * .4, y - s * .9, x, y - s * .35); c.bezierCurveTo(x + s * .4, y - s * .9, x + s * .9, y - s * .3, x, y + s * .35); c.fill(); }
  // nail with base at (0,0) pointing up; w x h in current units
  function drawNail(c, w, h, col, pat, t) {
    c.save(); nailPath(c, w, h);
    if (pat === "p_galaxy") { const gr = c.createLinearGradient(0, 0, 0, -h); gr.addColorStop(0, "#1e1b4b"); gr.addColorStop(.5, "#6d28d9"); gr.addColorStop(1, "#ec4899"); c.fillStyle = gr; }
    else if (col === "c_gold") { const gr = c.createLinearGradient(-w / 2, 0, w / 2, -h); gr.addColorStop(0, "#b8860b"); gr.addColorStop(.5, "#ffe27a"); gr.addColorStop(1, "#c99a1e"); c.fillStyle = gr; }
    else c.fillStyle = colorOf(col);
    c.fill(); c.clip();
    const white = "rgba(255,255,255,.9)";
    if (pat === "p_french") { c.fillStyle = "#fff"; c.beginPath(); c.moveTo(-w, -h * 1.02); c.lineTo(w, -h * 1.02); c.lineTo(w, -h * .8); c.quadraticCurveTo(0, -h * .66, -w, -h * .8); c.closePath(); c.fill(); }
    else if (pat === "p_stripes") { c.strokeStyle = white; c.lineWidth = w * .13; for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(-w, -h * i * .16 + w * .5); c.lineTo(w, -h * i * .16 - w * .5); c.stroke(); } }
    else if (pat === "p_glitter") { for (let i = 0; i < 26; i++) { c.globalAlpha = .45 + .55 * Math.abs(Math.sin(t / 260 + i * 1.7)); c.fillStyle = i % 3 ? "#fff" : "#ffe27a"; c.beginPath(); c.arc((((i * 37) % 100) / 100 - .5) * w * .8, -(((i * 53) % 100) / 100) * h * .95, w * .05 * (1 + (i % 3) * .5), 0, 6.3); c.fill(); } c.globalAlpha = 1; }
    else if (pat === "p_hearts") { c.fillStyle = white; heart(c, -w * .1, -h * .3, w * .3); heart(c, w * .12, -h * .58, w * .26); heart(c, -w * .08, -h * .82, w * .22); }
    else if (pat === "p_stars") { c.fillStyle = white; star(c, -w * .1, -h * .28, w * .2); star(c, w * .12, -h * .55, w * .16); star(c, -w * .06, -h * .8, w * .14); }
    else if (pat === "p_ombre") { const gr = c.createLinearGradient(0, 0, 0, -h); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,.95)"); c.fillStyle = gr; c.fillRect(-w, -h * 1.02, w * 2, h * 1.04); }
    else if (pat === "p_galaxy") { for (let i = 0; i < 16; i++) { c.globalAlpha = .4 + .6 * Math.abs(Math.sin(t / 300 + i)); c.fillStyle = "#fff"; c.beginPath(); c.arc((((i * 41) % 100) / 100 - .5) * w * .8, -(((i * 29) % 100) / 100) * h * .95, w * .035 * (1 + i % 2), 0, 6.3); c.fill(); } c.globalAlpha = 1; }
    c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.ellipse(-w * .16, -h * .5, w * .07, h * .28, 0, 0, 6.3); c.fill();
    c.restore(); nailPath(c, w, h); c.strokeStyle = "rgba(20,10,30,.5)"; c.lineWidth = Math.max(1, w * .05); c.stroke();
  }
  function drawHand(c, w, h, S, t) {
    const skin = "#efc19e"; c.save(); c.translate(w / 2, h - 6); c.scale(S, S); c.lineCap = "round";
    c.fillStyle = skin; c.beginPath(); c.ellipse(0, -22, 36, 24, 0, 0, 6.3); c.fill();
    [{ x: -26, y: -34, a: -.55, l: 34, f: 12 }, { x: -10, y: -42, a: -.18, l: 44, f: 12 }, { x: 7, y: -43, a: .08, l: 46, f: 12 }, { x: 24, y: -38, a: .35, l: 38, f: 11 }, { x: -34, y: -16, a: -1.2, l: 26, f: 13 }].forEach(q => {
      c.save(); c.translate(q.x, q.y); c.rotate(q.a); c.strokeStyle = skin; c.lineWidth = q.f; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -q.l); c.stroke();
      c.translate(0, -q.l + q.f * .15); drawNail(c, q.f * .95, q.f * 2.2, wallet.color, wallet.pattern, t); c.restore();
    });
    c.restore();
  }
  // her: 5'3", glasses, jeans + lavender top. mood 0 normal, 1 happy, 2 oops
  function drawGirl(c, x, y, S, mood, t) {
    c.save(); c.translate(x, y); c.scale(S, S); c.lineCap = "round";
    const skin = "#efc19e", hair = "#3a2a26", top = "#b79cf0", wv = Math.sin(t / 180) * (mood === 1 ? 3 : 1.5);
    c.fillStyle = "#3d5a9a"; c.fillRect(-9, -30, 8, 30); c.fillRect(1, -30, 8, 30);
    c.fillStyle = "#fff"; c.beginPath(); c.ellipse(-6, -1, 7, 3.5, 0, 0, 6.3); c.ellipse(6, -1, 7, 3.5, 0, 0, 6.3); c.fill();
    c.fillStyle = hair; c.beginPath(); c.moveTo(-11, -74); c.quadraticCurveTo(-15, -58, -10, -52); c.lineTo(10, -52); c.quadraticCurveTo(15, -58, 11, -74); c.closePath(); c.fill();
    c.fillStyle = top; c.beginPath(); c.moveTo(-11, -56); c.lineTo(11, -56); c.lineTo(10, -30); c.lineTo(-10, -30); c.closePath(); c.fill();
    c.strokeStyle = top; c.lineWidth = 6; c.beginPath(); c.moveTo(-11, -54); c.lineTo(-15, -46); c.stroke(); c.strokeStyle = skin; c.lineWidth = 5; c.beginPath(); c.moveTo(-15, -46); c.lineTo(-17, -34); c.stroke();
    c.strokeStyle = top; c.lineWidth = 6; c.beginPath(); c.moveTo(11, -54); c.lineTo(17, -58); c.stroke(); c.strokeStyle = skin; c.lineWidth = 5; c.beginPath(); c.moveTo(17, -58); c.lineTo(22 + wv, -72); c.stroke();
    c.fillStyle = skin; c.beginPath(); c.arc(22 + wv, -74, 4.2, 0, 6.3); c.fill();
    [-1.5, -.5, .5, 1.5].forEach(i => { c.save(); c.translate(22 + wv + i * 3, -76); c.rotate(i * .22); c.strokeStyle = skin; c.lineWidth = 2.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -4); c.stroke(); c.translate(0, -3.5); drawNail(c, 2.8, 8, wallet.color, wallet.pattern, t); c.restore(); });
    c.fillStyle = skin; c.fillRect(-2.5, -60, 5, 6); c.beginPath(); c.ellipse(0, -66, 10, 11, 0, 0, 6.3); c.fill();
    c.fillStyle = hair; c.beginPath(); c.moveTo(-10.5, -66); c.quadraticCurveTo(-11, -80, 0, -79); c.quadraticCurveTo(11, -80, 10.5, -66); c.quadraticCurveTo(6, -72, 1, -73); c.quadraticCurveTo(-5, -71, -10.5, -66); c.fill();
    c.strokeStyle = "#222"; c.lineWidth = 1.4; c.fillStyle = "rgba(200,230,255,.3)"; [-4.8, 4.8].forEach(gx => { c.beginPath(); c.arc(gx, -66, 4.4, 0, 6.3); c.fill(); c.stroke(); });
    c.beginPath(); c.moveTo(-.4, -66.5); c.lineTo(.4, -66.5); c.stroke();
    c.fillStyle = "#222"; [-4.8, 4.8].forEach(gx => { c.beginPath(); c.arc(gx, -66, 1.3, 0, 6.3); c.fill(); });
    c.fillStyle = "rgba(255,120,140,.35)"; [-7, 7].forEach(bx => { c.beginPath(); c.ellipse(bx, -61.5, 2.4, 1.5, 0, 0, 6.3); c.fill(); });
    c.strokeStyle = "#a3454f"; c.lineWidth = 1.3; c.beginPath();
    if (mood === 1) c.arc(0, -62.5, 3, .1, Math.PI - .1); else if (mood === 2) c.ellipse(0, -60.5, 1.6, 2.1, 0, 0, 6.3); else c.arc(0, -63, 2.4, .25, Math.PI - .25);
    c.stroke(); c.restore();
  }

  // ---------- fruit ----------
  function fruit(c, f, r) {
    const q = r * f.r; c.fillStyle = f.sk; c.beginPath(); c.arc(0, 0, q, 0, 6.3); c.fill();
    if (f.n === "watermelon") { c.strokeStyle = "#1b6b2a"; c.lineWidth = q * .12; [-.55, 0, .55].forEach(k => { c.beginPath(); c.moveTo(k * q, -Math.sqrt(1 - k * k) * q); c.quadraticCurveTo(k * q * 1.4, 0, k * q, Math.sqrt(1 - k * k) * q); c.stroke(); }); }
    if (f.n === "apple") { c.fillStyle = "#6b3b1d"; c.fillRect(-q * .04, -q * 1.1, q * .08, q * .28); c.fillStyle = "#3aa655"; c.beginPath(); c.ellipse(q * .22, -q * .98, q * .2, q * .09, -.5, 0, 6.3); c.fill(); }
    if (f.n === "kiwi") { c.fillStyle = "rgba(0,0,0,.12)"; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(Math.cos(i * 1.7) * q * .5, Math.sin(i * 2.3) * q * .5, q * .05, 0, 6.3); c.fill(); } }
    c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.ellipse(-q * .35, -q * .4, q * .18, q * .3, -.6, 0, 6.3); c.fill();
    c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, q, 0, 6.3); c.stroke();
  }
  function half(c, f, r, side) {
    const q = r * f.r, a0 = side > 0 ? -Math.PI / 2 : Math.PI / 2, arc = rad => { c.beginPath(); c.arc(0, 0, rad, a0, a0 + Math.PI); c.closePath(); };
    c.fillStyle = f.sk; arc(q); c.fill(); c.fillStyle = f.fl; arc(q * .86); c.fill(); c.fillStyle = "rgba(255,255,255,.45)"; arc(q * .3); c.fill();
    if (f.sd) { c.fillStyle = f.sd; for (let i = 0; i < 5; i++) { const a = a0 + (i + .5) * Math.PI / 5; c.beginPath(); c.ellipse(Math.cos(a) * q * .55, Math.sin(a) * q * .55, q * .05, q * .08, a, 0, 6.3); c.fill(); } }
  }
  function bomb(c, r) {
    const gr = c.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r); gr.addColorStop(0, "#555"); gr.addColorStop(1, "#0b0b12"); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.fill();
    c.strokeStyle = "#ff4d4d"; c.lineWidth = 3; c.stroke(); c.strokeStyle = "#a16207"; c.lineWidth = 4; c.beginPath(); c.moveTo(r * .2, -r * .9); c.quadraticCurveTo(r * .5, -r * 1.3, r * .8, -r * 1.2); c.stroke();
    c.fillStyle = Math.random() < .5 ? "#ffd166" : "#ff6b35"; c.beginPath(); c.arc(r * .85, -r * 1.22, r * .16, 0, 6.3); c.fill();
    c.fillStyle = "#fff"; c.font = "700 " + r * .9 + "px " + TXT; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("X", 0, 0);
  }
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const emoji = (e, x, y, size) => { g.font = size + "px " + EMO; g.textAlign = "center"; g.textBaseline = "bottom"; g.fillText(e, x, y); };

  // ---------- game ----------
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth || innerWidth || 400; H = cv.clientHeight || innerHeight || 700;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); gM.setTransform(dpr, 0, 0, dpr, 0, 0);
    sky = gM.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#1b1038"); sky.addColorStop(1, "#46246f");
    bokeh = Array.from({ length: 14 }, () => ({ x: rnd(0, 1), y: rnd(0, 1), r: rnd(.03, .09), a: rnd(.04, .1) }));
  }
  function reset() { items = []; halves = []; parts = []; pops = []; trail = []; segs = []; score = 0; runCoins = 0; lives = 3; level = 0; nextWave = 40; slow = 0; combo = 0; comboT = 0; shake = 0; flash = 0; mood = 0; moodT = 0; down = false; lastP = null; }
  function start() { reset(); state = "play"; last = performance.now(); }
  function act() { if (state === "paused") { state = "play"; last = performance.now(); } else if (state !== "play") start(); }
  const GR = () => H * .0009;
  function launch(kind) {
    const r = clamp(H * .062, 24, 52) * (kind === "fruit" ? 1 : .85), x = rnd(W * .14, W * .86), gg = GR(), apex = H * rnd(.58, .86), vy = -Math.sqrt(2 * gg * apex), T = 2 * Math.abs(vy) / gg;
    items.push({ k: kind, x, y: H + r, vx: (rnd(-.28, .28) * W + (W / 2 - x) * .35) / T, vy, r, rot: rnd(0, 6.3), vr: rnd(-.08, .08), f: pick1(FR) });
  }
  function wave() {
    const n = 1 + ((Math.random() * (2 + Math.min(3, level))) | 0), bp = clamp(.08 + level * .012, .08, .22);
    for (let i = 0; i < n; i++) { const q = Math.random(); launch(q < bp ? "bomb" : q < bp + .02 ? "gem" : q < bp + .035 ? "slow" : (q < bp + .05 && lives < 3) ? "heart" : "fruit"); }
  }
  const pop = (x, y, txt, c) => pops.push({ x, y, txt, c: c || "#ffd166", l: 1.4 });
  const burst = (x, y, c, n) => { for (let i = 0; i < (n || 9); i++) parts.push({ x, y, vx: rnd(-4, 4), vy: rnd(-6, 1), l: 1, c }); };
  function segHit(s, it) { const vx = s.x1 - s.x0, vy = s.y1 - s.y0, l2 = vx * vx + vy * vy; if (l2 < 25) return false; const t = clamp(((it.x - s.x0) * vx + (it.y - s.y0) * vy) / l2, 0, 1); return Math.hypot(it.x - (s.x0 + vx * t), it.y - (s.y0 + vy * t)) < it.r * .95; }
  function slice(it, s) {
    it.cut = true; const dx = s.x1 - s.x0, dy = s.y1 - s.y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    if (it.k === "bomb") { lives--; combo = 0; shake = 16; flash = 1; mood = 2; moodT = 70; burst(it.x, it.y, "#ffb347", 18); tone([[160, .2], [90, .3]]); if (lives <= 0) die(); return; }
    if (it.k === "gem") { score += 5; runCoins += 10; pop(it.x, it.y, "+10 coins", "#7dd3fc"); burst(it.x, it.y, "#7dd3fc"); tone([[988, .06], [1319, .1]]); return; }
    if (it.k === "slow") { slow = 300; pop(it.x, it.y, "Slow-mo!", "#a5d8ff"); tone([[500, .1], [350, .15]]); return; }
    if (it.k === "heart") { lives = Math.min(5, lives + 1); pop(it.x, it.y, "+1 life", "#ff8fa3"); tone([[660, .08], [880, .1]]); return; }
    score++; runCoins++; combo++; comboT = 20; mood = 1; moodT = 40;
    if (combo >= 3) { score++; runCoins++; pop(it.x, it.y - it.r, "COMBO x" + combo); }
    const th = Math.atan2(ny, nx);
    halves.push({ f: it.f, r: it.r, x: it.x, y: it.y, vx: it.vx + nx * 2.4, vy: it.vy - 1, rot: th, vr: .05, side: 1, l: 1 }, { f: it.f, r: it.r, x: it.x, y: it.y, vx: it.vx - nx * 2.4, vy: it.vy - 1, rot: th, vr: -.05, side: -1, l: 1 });
    burst(it.x, it.y, it.f.fl, 8); tone([[700 + Math.min(combo, 6) * 90, .05]]);
  }
  function die() {
    state = "over"; shake = 12; tone([[220, .15], [130, .3]]);
    if (score > best) { best = score; store.set("nx_hs_nail", best); tileBests(); }
    if (score > 0 || runCoins > 0) db.rpc("ah_nail_run", { p_score: score, p_coins: Math.min(runCoins, 400) }).then(r => { if (!r.error && r.data) setWallet(r.data); lb(); }, () => {});
  }
  function step(f) {
    const dt = f * (slow > 0 ? .45 : 1), gg = GR(); slow = Math.max(0, slow - f); level = Math.floor(score / 12);
    nextWave -= dt; if (nextWave <= 0) { wave(); nextWave = Math.max(34, 80 - level * 3) * rnd(.8, 1.2); }
    const sg = segs.splice(0); for (const it of items) if (!it.cut) for (const s of sg) if (segHit(s, it)) { slice(it, s); break; }
    if (state !== "play") return;
    for (const it of items) { it.vy += gg * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt; }
    for (const it of items) if (!it.cut && !it.gone && it.y - it.r > H && it.vy > 0) {
      it.gone = true;
      if (it.k === "fruit") { lives--; mood = 2; moodT = 50; shake = 6; combo = 0; pop(clamp(it.x, 40, W - 40), H - 60, "Miss!", "#ff6b6b"); if (lives <= 0) return die(); }
    }
    items = items.filter(i => !i.cut && !i.gone);
    halves.forEach(h => { h.vy += gg * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt; h.l -= dt / 90; }); halves = halves.filter(h => h.l > 0 && h.y < H + 120);
    parts.forEach(p => { p.vy += gg * .6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt / 40; }); parts = parts.filter(p => p.l > 0);
    pops.forEach(p => { p.y -= .6 * f; p.l -= f / 50; }); pops = pops.filter(p => p.l > 0);
    const now = performance.now(); trail = trail.filter(p => now - p.t < 220);
    comboT -= f; if (comboT <= 0) combo = 0; moodT -= f; if (moodT <= 0) mood = 0; if (shake > 0) shake -= f * .6; if (flash > 0) flash -= .05 * f;
  }

  // ---------- drawing ----------
  function overlay(title, l1, l2, cta) {
    g.fillStyle = "rgba(14,8,34,.8)"; g.fillRect(0, 0, W, H);
    const wide = W > H * 1.1, pw = Math.min(W * .92, 620), ph = Math.min(H * .86, wide ? 330 : 520), px = (W - pw) / 2, py = (H - ph) / 2;
    g.fillStyle = "rgba(48,28,98,.94)"; rr(px, py, pw, ph, 22); g.fill(); g.strokeStyle = "rgba(255,160,220,.5)"; g.lineWidth = 2; g.stroke();
    const S = (wide ? ph * .66 : ph * .38) / 80, gx = wide ? px + pw * .2 : W / 2, gy = wide ? py + ph * .86 : py + ph * .42, tx = wide ? px + pw * .4 : W / 2, ty = wide ? py + ph * .26 : py + ph * .5;
    drawGirl(g, gx, gy, S * .95, state === "over" ? 2 : 1, performance.now());
    g.textAlign = wide ? "left" : "center"; g.textBaseline = "alphabetic"; const tw = wide ? pw * .55 : pw * .9, fs = clamp(Math.min(pw * .08, ph * .085), 18, 36);
    g.fillStyle = "#fff"; g.font = "700 " + fs + "px " + TXT; g.fillText(title, tx, ty, tw);
    g.fillStyle = "#d9d0f5"; g.font = Math.max(13, fs * .55) + "px " + TXT; g.fillText(l1, tx, ty + fs * 1.3, tw); g.fillText(l2, tx, ty + fs * 2.1, tw);
    g.fillStyle = "#ffd166"; g.font = "700 " + fs * .75 + "px " + TXT; g.fillText(cta + (((performance.now() / 500) | 0) % 2 ? " <" : ""), tx, ty + fs * 3.4, tw);
  }
  function hud() {
    const fs = clamp(Math.min(W, H) * .045, 15, 26), pad = Math.max(12, W * .03), ph = fs * 1.9;
    g.textBaseline = "middle"; g.textAlign = "left"; g.font = "700 " + fs + "px " + TXT;
    const pill = (y, w) => { g.fillStyle = "rgba(8,6,28,.72)"; rr(pad, y, w, ph, ph / 2); g.fill(); };
    pill(pad, fs * 8.6); g.fillStyle = "#fff"; g.fillText("SCORE " + score, pad + fs * .8, pad + ph / 2 + 1);
    const y2 = pad + ph + 6; pill(y2, fs * 8.6); g.fillStyle = "#ffd23f"; g.beginPath(); g.arc(pad + fs * 1.1, y2 + ph / 2, fs * .5, 0, 6.3); g.fill(); g.fillStyle = "#b7860b"; g.beginPath(); g.arc(pad + fs * 1.1, y2 + ph / 2, fs * .25, 0, 6.3); g.fill();
    g.fillStyle = "#fff"; g.fillText(runCoins + "     BEST " + best, pad + fs * 1.9, y2 + ph / 2 + 1);
    const y3 = y2 + ph + 6, n = Math.max(3, lives); pill(y3, fs * (n * 1.5 + 1));
    for (let i = 0; i < n; i++) { g.fillStyle = i < lives ? "#ff4d6d" : "rgba(255,255,255,.25)"; heart(g, pad + fs * (1.1 + i * 1.5), y3 + ph / 2 + fs * .1, fs * .7); }
    if (slow > 0) { const y4 = y3 + ph + 6; pill(y4, fs * 8.6); g.fillStyle = "rgba(255,255,255,.2)"; rr(pad + fs * 2.4, y4 + ph * .38, fs * 5.6, ph * .24, 4); g.fill(); g.fillStyle = "#a5d8ff"; rr(pad + fs * 2.4, y4 + ph * .38, Math.max(4, fs * 5.6 * slow / 300), ph * .24, 4); g.fill(); g.fillStyle = "#fff"; emoji("❄️", pad + fs * 1.2, y4 + ph * .86, fs * 1.1); }
  }
  function draw() {
    const t = performance.now(); g.save(); g.textAlign = "left"; g.textBaseline = "alphabetic";
    if (shake > 0) g.translate(rnd(-shake, shake), rnd(-shake, shake));
    g.fillStyle = sky; g.fillRect(-20, -20, W + 40, H + 40);
    bokeh.forEach(b => { g.fillStyle = "rgba(255,170,230," + b.a + ")"; g.beginPath(); g.arc(b.x * W, b.y * H, b.r * Math.min(W, H), 0, 6.3); g.fill(); });
    g.fillStyle = "#2d1850"; g.fillRect(0, H * .93, W, H * .07);
    if (items) {
      g.globalAlpha = .95; drawGirl(g, W * .13, H * .985, (H * .2 / 80) * .95, mood, t); g.globalAlpha = 1;
      for (const h of halves) { g.save(); g.globalAlpha = clamp(h.l * 1.5, 0, 1); g.translate(h.x, h.y); g.rotate(h.rot); half(g, h.f, h.r, h.side); g.restore(); }
      for (const it of items) {
        g.save(); g.translate(it.x, it.y);
        if (it.k === "fruit") { g.rotate(it.rot); fruit(g, it.f, it.r); } else if (it.k === "bomb") { g.rotate(it.rot * .3); bomb(g, it.r); }
        else { g.fillStyle = "rgba(255,255,255,.2)"; g.beginPath(); g.arc(0, 0, it.r * 1.05, 0, 6.3); g.fill(); g.strokeStyle = "#ffd166"; g.lineWidth = 2; g.stroke(); g.fillStyle = "#fff"; emoji(it.k === "gem" ? "💎" : it.k === "slow" ? "❄️" : "❤️", 0, it.r * .7, it.r * 1.5); }
        g.restore();
      }
      for (const p of parts) { g.globalAlpha = clamp(p.l, 0, 1); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 3.5, 0, 6.3); g.fill(); } g.globalAlpha = 1;
      // blade trail + big nail at the fingertip
      const now = performance.now(), col = colorOf(wallet.color), tr = trail;
      for (let i = 1; i < tr.length; i++) { const a = clamp(1 - (now - tr[i].t) / 220, 0, 1); g.strokeStyle = wallet.color === "c_black" ? "#c4b5fd" : col; g.globalAlpha = a; g.lineWidth = 3 + 11 * a; g.lineCap = "round"; g.shadowColor = "#fff"; g.shadowBlur = 12; g.beginPath(); g.moveTo(tr[i - 1].x, tr[i - 1].y); g.lineTo(tr[i].x, tr[i].y); g.stroke(); }
      g.globalAlpha = 1; g.shadowBlur = 0;
      if (down && tr.length > 1) { const a = tr[tr.length - 1], b = tr[Math.max(0, tr.length - 4)], ang = Math.atan2(a.y - b.y, a.x - b.x), nh = H * .13; g.save(); g.translate(a.x, a.y); g.rotate(ang + Math.PI / 2); g.translate(0, nh); drawNail(g, nh * .36, nh, wallet.color, wallet.pattern, t); g.restore(); }
      for (const p of pops) { g.globalAlpha = clamp(p.l, 0, 1); g.fillStyle = p.c; g.strokeStyle = "#000"; g.lineWidth = 3; g.font = "700 " + clamp(H * .035, 16, 30) + "px " + TXT; g.textAlign = "center"; g.strokeText(p.txt, p.x, p.y); g.fillText(p.txt, p.x, p.y); } g.globalAlpha = 1;
      if (state !== "ready") hud();
      if (flash > 0) { g.fillStyle = "rgba(255,255,255," + flash * .6 + ")"; g.fillRect(-20, -20, W + 40, H + 40); }
    }
    if (state === "ready") overlay("Daksha: The Nail Ninja", "Swipe to slice fruit. Avoid the bombs!", "Don't let fruit fall: 3 lives. Coins unlock nail styles.", "Tap to start");
    if (state === "over") overlay("Game over!", "Score " + score + "   Coins +" + runCoins + "   Best " + best, "Spend coins in Game Zone > Nail Studio", "Tap to play again");
    if (state === "paused") overlay("Paused", "Game roka gaya hai.", "Wapas aane ke liye tap karo.", "Tap to continue");
    g.restore();
  }
  function drawCover() {
    const w = cvR.clientWidth || 300, h = Math.round(w * 9 / 16), d = Math.min(devicePixelRatio || 1, 2); cvR.width = w * d; cvR.height = h * d; const c = gcR; c.setTransform(d, 0, 0, d, 0, 0);
    const o = g; g = c; const sk = c.createLinearGradient(0, 0, 0, h); sk.addColorStop(0, "#1b1038"); sk.addColorStop(1, "#46246f"); c.fillStyle = sk; c.fillRect(0, 0, w, h);
    [[.1, .2, .06], [.5, .75, .08], [.35, .1, .05]].forEach(b => { c.fillStyle = "rgba(255,170,230,.08)"; c.beginPath(); c.arc(b[0] * w, b[1] * h, b[2] * w, 0, 6.3); c.fill(); });
    c.save(); c.translate(w * .2, h * .62); c.rotate(-.5); c.translate(-h * .09, 0); half(c, FR[0], h * .17, -1); c.restore(); c.save(); c.translate(w * .2, h * .62); c.rotate(-.5); c.translate(h * .09, 0); half(c, FR[0], h * .17, 1); c.restore();
    c.save(); c.translate(w * .38, h * .32); fruit(c, FR[1], h * .12); c.restore(); c.save(); c.translate(w * .08, h * .3); fruit(c, FR[2], h * .1); c.restore();
    c.strokeStyle = colorOf(wallet.color); c.lineWidth = 6; c.lineCap = "round"; c.shadowColor = "#fff"; c.shadowBlur = 10; c.beginPath(); c.moveTo(w * .04, h * .88); c.lineTo(w * .36, h * .36); c.stroke(); c.shadowBlur = 0;
    drawGirl(c, w * .8, h * .96, h * .78 / 80, 1, 0);
    c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillStyle = "#fff"; c.font = "700 " + h * .14 + "px " + TXT; c.fillText("NAIL", w * .44, h * .46); c.fillStyle = "#ffb3e6"; c.fillText("NINJA", w * .44, h * .62);
    c.fillStyle = "#d9d0f5"; c.font = h * .055 + "px " + TXT; c.fillText("Slice fruit with style", w * .44, h * .74); g = o;
  }

  // ---------- wallet, studio, leaderboard ----------
  function tileBests() { const a = $("#dbest-prabhat"), b = $("#dbest-nail"); if (a) a.textContent = "Best " + (store.get("nx_hs_prabhat") || 0); if (b) b.textContent = "Best " + (store.get("nx_hs_nail") || 0); }
  function setWallet(r) { wallet = { coins: r.coins, unlocked: r.unlocked || ["c_red", "p_solid"], color: r.color, pattern: r.pattern, offline: false }; renderStudio(); drawCover(); }
  async function loadWallet() {
    const r = await db.rpc("ah_nail_get");
    if (r.error || !r.data) { wallet.offline = true; $("#nmsg").textContent = "Nail Studio needs migration-06-nails.sql to be run in Supabase."; renderStudio(); return; }
    $("#nmsg").textContent = ""; setWallet(r.data);
  }
  function renderStudio() {
    $("#ncoins").textContent = wallet.coins;
    const mk = (arr, cur) => arr.map(it => { const owned = wallet.unlocked.includes(it[0]), on = cur === it[0];
      return `<button type="button" class="nitem ${on ? "on" : ""} ${owned ? "" : "locked"}" data-id="${it[0]}"><canvas width="88" height="132" data-id="${it[0]}"></canvas><small>${esc(it[1])}</small><small class="pr">${on ? "Equipped" : owned ? "Owned" : "🔒 " + it[3]}</small></button>`; }).join("");
    $("#ncols").innerHTML = mk(COLORS, wallet.color); $("#npats").innerHTML = mk(PATS, wallet.pattern);
    $$("#ncols canvas,#npats canvas").forEach(k => { const c = k.getContext("2d"), id = k.dataset.id, isC = id[0] === "c"; c.clearRect(0, 0, 88, 132); c.save(); c.translate(44, 124); drawNail(c, 58, 112, isC ? id : wallet.color, isC ? wallet.pattern : id, 0); c.restore(); });
    const pv = $("#nprev"); if (pv) { const c = pv.getContext("2d"); c.clearRect(0, 0, pv.width, pv.height); drawHand(c, pv.width, pv.height, 1.55, 0); }
  }
  $("#nstudio").addEventListener("click", async e => {
    const b = e.target.closest(".nitem"); if (!b) return; const id = b.dataset.id, all = COLORS.concat(PATS), it = all.find(x => x[0] === id);
    if (wallet.offline) return toast("Run migration-06-nails.sql first.");
    try {
      if (!wallet.unlocked.includes(id)) {
        if (wallet.coins < it[3]) return toast(`Need ${it[3] - wallet.coins} more coins for ${it[1]}.`);
        if (!confirm(`Unlock ${it[1]} for ${it[3]} coins?`)) return;
        const u = await db.rpc("ah_nail_unlock", { p_item: id }); if (u.error) return toast(u.error.message); setWallet(u.data);
      }
      const q = await db.rpc("ah_nail_equip", { p_item: id }); if (q.error) return toast(q.error.message); setWallet(q.data); toast(it[1] + " equipped!");
    } catch (_) { toast("Something went wrong. Try again."); }
  });
  async function lb() {
    const r = await db.from("game_scores").select("user_id,score").eq("game", "nail").order("score", { ascending: false }).limit(10);
    if (r.error) { $("#nlb").innerHTML = `<p class="mut">Leaderboard ke liye migration-05-game.sql run karo.</p>`; return; }
    $("#nlb").innerHTML = r.data.length ? r.data.map((x, i) => `<div class="mem"><b>${i + 1}</b>${av(people[x.user_id], 32)}<div><b>${esc(nm(x.user_id))}</b></div><b>${x.score}</b></div>`).join("") : `<p class="mut">Abhi koi score nahi. Pehle tum khelo!</p>`;
  }

  // ---------- full screen shell + input ----------
  function loop(now) {
    if (!isOpen) { raf = 0; return; }
    raf = requestAnimationFrame(loop); const f = clamp((now - last) / 16.667 || 1, 0, 3); last = now;
    if (document.hidden && state === "play") state = "paused";
    if (state === "play") step(f); else { if (shake > 0) shake -= f * .6; if (flash > 0) flash -= .05 * f; }
    draw();
  }
  async function openNails() {
    const el = $("#nplay"); el.classList.remove("hide"); document.body.style.overflow = "hidden"; isOpen = true;
    try { if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" }); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); } catch (_) {}
    resize(); reset(); state = "ready"; last = performance.now(); if (!raf) raf = requestAnimationFrame(loop);
  }
  function closeNails() {
    isOpen = false; cancelAnimationFrame(raf); raf = 0; if (state === "play") state = "paused";
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {}
    $("#nplay").classList.add("hide"); document.body.style.overflow = ""; drawCover(); lb(); loadWallet();
  }
  window.openNails = openNails;
  window.loadNails = function () { drawCover(); lb(); loadWallet(); tileBests(); };
  window.NXN = { forceOpen() { isOpen = true; resize(); reset(); state = "ready"; }, start, step, draw, drawCover, renderStudio, swipe(x0, y0, x1, y1) { segs.push({ x0, y0, x1, y1 }); }, state: () => state, score: () => score, items: () => items, lives: () => lives, W: () => W, H: () => H };
  $("#nplaybtn").addEventListener("click", openNails); cvR.addEventListener("click", openNails);
  $("#nx").addEventListener("click", closeNails);
  $("#nps").addEventListener("click", () => { if (state === "play") state = "paused"; else if (state === "paused") act(); });
  document.addEventListener("fullscreenchange", () => { if (isOpen && !document.fullscreenElement) closeNails(); else if (isOpen) resize(); });
  addEventListener("resize", () => { if (isOpen) resize(); });
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / (r.width || W)), (e.clientY - r.top) * (H / (r.height || H))]; };
  cv.addEventListener("pointerdown", e => { e.preventDefault(); if (state !== "play") { act(); return; } down = true; const p = pos(e); trail = [{ x: p[0], y: p[1], t: performance.now() }]; lastP = p; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener("pointermove", e => { if (!down || state !== "play") return; const p = pos(e); if (lastP) segs.push({ x0: lastP[0], y0: lastP[1], x1: p[0], y1: p[1] }); trail.push({ x: p[0], y: p[1], t: performance.now() }); lastP = p; });
  const up = () => { down = false; lastP = null; }; ["pointerup", "pointercancel", "pointerleave"].forEach(ev => cv.addEventListener(ev, up));
  addEventListener("keydown", e => { if (!isOpen) return; if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); if (state !== "play") act(); } else if (e.code === "KeyP" && state === "play") state = "paused"; });
  $$(".gtile").forEach(b => b.addEventListener("click", () => { go("game"); (b.dataset.game === "nail" ? openNails : window.openRunner)(); }));
  tileBests(); reset();
})();
