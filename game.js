// NEXORA Game Zone: "Bhaag Prabhat Bhaag" - 3-lane endless runner (pseudo-3D), full screen. Needs app.js globals: $, db, store, tone, esc, nm, av, people.
(function () {
  const fs = $("#gfs"), cv = $("#gcv"), g = cv.getContext("2d"), gps = $("#gps"), rnd = (a, b) => a + Math.random() * (b - a);
  const D = 8, ZMAX = 80, EMO = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif", TXT = "'Space Grotesk','DM Sans',sans-serif";
  const MSGS = ["Pakda gaya! 😅", "Chashma toot gaya! 🤓", "Bas 5 minute aur... 😴", "Crocs phisal gaye! 🩴", "Mummy ne dekh liya! 😱"];
  const IT = { scooty: { t: 8, l: "Scooty!", e: "🛵" }, crocs: { t: 10, l: "Jumping Crocs!" }, cat: { t: 12, l: "Billi aayi!", e: "🐱" } };
  const COL = ["#e5484d", "#3b82f6", "#f59e0b", "#10b981", "#a855f7"];
  let W = 390, H = 800, laneW = 110, horizon = 270, bottom = 670, cx = 195, safeTop = 0, sky = null, skyline = [];
  let st = "ready", last = 0, raf = 0, best = +(store.get("nx_hs_prabhat3d") || 0), msg = MSGS[0], sx = 0, sy = 0, sid = null, sdone = false, tt = 0;
  let pl, obs, coins, items, fx, dist, score, nCoins, speed, nextRow, nextItem, shake, bld;
  const probe = document.createElement("div"); probe.style.cssText = "position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);visibility:hidden"; document.body.appendChild(probe);

  // ---------- projection ----------
  const P_ = z => D / (D + z), sc = z => laneW * P_(z), gx = (x, z) => cx + x * laneW * P_(z);
  const gy = (z, h = 0) => horizon + (bottom - horizon) * P_(z) - h * laneW * P_(z);
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2); W = fs.clientWidth || innerWidth; H = fs.clientHeight || innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    laneW = Math.min(W / 3.5, H * .22); horizon = H * .34; bottom = H * .84; cx = W / 2; safeTop = probe.offsetHeight || 0;
    sky = g.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, "#241a6b"); sky.addColorStop(.65, "#a24bb0"); sky.addColorStop(1, "#ff9a6b");
    skyline = Array.from({ length: Math.ceil(W / 26) }, (_, i) => ({ x: i * 26, w: rnd(20, 40), h: rnd(.02, .11) * H }));
  }

  // ---------- characters ----------
  function croc(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = "#76c442"; c.beginPath(); c.ellipse(0, -1, 9, 6.5, 0, Math.PI, 0); c.fill();
    c.fillStyle = "#5aa22c"; c.fillRect(-10, -1, 21, 3.5); c.fillStyle = "rgba(0,0,0,.45)"; [-4, 0, 4].forEach(d => { c.beginPath(); c.arc(d, -4, 1.1, 0, 6.3); c.fill(); }); c.restore();
  }
  function hero(c, x, y, s, ph, o) { // back view, feet at (x,y), ~125 units tall
    c.save(); c.translate(x, y); c.scale(s, s); c.rotate(o.lean * .35); if (o.roll) c.scale(1.15, .55);
    const skin = "#f1d2b6", skinD = "#dcb593", tee = "#12a4a0", sh = "#c9b28a", sw = o.air ? 0 : Math.sin(ph); c.lineCap = "round";
    [-1, 1].forEach(sd => {
      const lift = o.air ? 14 : Math.max(0, sd * sw) * 12, fx = sd * 9, fy = -4 - lift;
      c.strokeStyle = sh; c.lineWidth = 16; c.beginPath(); c.moveTo(sd * 8, -46); c.lineTo(sd * 8.5, -28); c.stroke();
      c.strokeStyle = skinD; c.lineWidth = 12; c.beginPath(); c.moveTo(sd * 8.5, -28); c.lineTo(fx, fy - 4); c.stroke();
      if (o.crocs) { c.shadowColor = "#b8ff4a"; c.shadowBlur = 16; }
      c.fillStyle = "#76c442"; c.beginPath(); c.ellipse(fx, fy, 10.5, 6.5, 0, 0, 6.3); c.fill(); c.shadowBlur = 0;
      c.fillStyle = "#5aa22c"; c.fillRect(fx - 10, fy + 2, 20, 4); c.fillStyle = "rgba(0,0,0,.4)"; [-3.5, 3.5].forEach(d => { c.beginPath(); c.arc(fx + d, fy - 1, 1.3, 0, 6.3); c.fill(); });
    });
    c.fillStyle = sh; c.fillRect(-16, -52, 32, 12);
    c.fillStyle = tee; c.beginPath(); c.moveTo(-26, -88); c.lineTo(26, -88); c.lineTo(16, -46); c.lineTo(-16, -46); c.closePath(); c.fill();
    c.fillStyle = "rgba(0,0,0,.14)"; c.fillRect(-1, -86, 2, 38); c.fillStyle = "rgba(255,255,255,.22)"; c.fillRect(-22, -80, 44, 4);
    [-1, 1].forEach(sd => {
      const w2 = o.air ? .6 * sd : -sd * sw * .9, ex = sd * 31 + w2 * 4, ey = -62, hx = sd * 30 + w2 * 9, hy = -42 - (o.air ? 6 : 0);
      c.strokeStyle = skin; c.lineWidth = 13; c.beginPath(); c.moveTo(sd * 24, -82); c.lineTo(ex, ey); c.stroke(); c.lineWidth = 10; c.beginPath(); c.moveTo(ex, ey); c.lineTo(hx, hy); c.stroke();
      c.fillStyle = skin; c.beginPath(); c.arc(ex - sd, ey + 2, 8, 0, 6.3); c.fill(); c.beginPath(); c.arc(hx, hy + 2, 5.5, 0, 6.3); c.fill();
      c.fillStyle = tee; c.beginPath(); c.arc(sd * 25, -82, 9.5, 0, 6.3); c.fill();
    });
    c.fillStyle = skin; c.fillRect(-5, -97, 10, 11); [-1, 1].forEach(sd => { c.beginPath(); c.ellipse(sd * 16, -102, 3.5, 5, 0, 0, 6.3); c.fill(); });
    c.fillStyle = "#2a1a12"; c.beginPath(); c.ellipse(0, -106, 17, 19, 0, 0, 6.3); c.fill();
    c.beginPath(); c.moveTo(-17, -104); c.quadraticCurveTo(-23, -92 + Math.sin(ph * 2) * 2, -15, -86); c.quadraticCurveTo(-8, -80, 0, -87); c.quadraticCurveTo(8, -80, 15, -86); c.quadraticCurveTo(23, -92 + Math.cos(ph * 2) * 2, 17, -104); c.closePath(); c.fill();
    c.strokeStyle = "rgba(255,255,255,.14)"; c.lineWidth = 1.5; [-8, 0, 8].forEach(d => { c.beginPath(); c.moveTo(d - 4, -118); c.quadraticCurveTo(d + 4, -106, d - 3, -92); c.stroke(); });
    c.strokeStyle = "#0b0b0b"; c.lineWidth = 3.2; [-1, 1].forEach(sd => { c.beginPath(); c.moveTo(sd * 17, -104); c.lineTo(sd * 24, -108); c.stroke(); c.beginPath(); c.arc(sd * 24, -109, 5, 0, 6.3); c.stroke(); });
    c.restore();
  }
  function scooty(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = "#1c1c1c"; c.beginPath(); c.ellipse(0, -15, 8, 16, 0, 0, 6.3); c.fill();
    c.fillStyle = "#e5484d"; c.beginPath(); c.moveTo(-24, -24); c.lineTo(24, -24); c.lineTo(18, -48); c.lineTo(-18, -48); c.closePath(); c.fill();
    c.fillStyle = "#ffd166"; c.fillRect(-9, -38, 18, 6); c.fillStyle = "#111"; c.fillRect(-34, -64, 14, 4); c.fillRect(20, -64, 14, 4); c.restore();
  }
  function bust(c, x, y, s) { // front view portrait
    c.save(); c.translate(x, y); c.scale(s, s); const sk = "#f1d2b6", tee = "#12a4a0";
    c.fillStyle = tee; c.beginPath(); c.moveTo(-60, 72); c.quadraticCurveTo(-62, 38, -34, 32); c.lineTo(34, 32); c.quadraticCurveTo(62, 38, 60, 72); c.closePath(); c.fill();
    [-1, 1].forEach(sd => { c.fillStyle = sk; c.beginPath(); c.arc(sd * 63, 60, 14, 0, 6.3); c.fill(); c.fillStyle = tee; c.beginPath(); c.arc(sd * 58, 42, 13, 0, 6.3); c.fill(); });
    c.fillStyle = sk; c.fillRect(-9, 18, 18, 18);
    c.fillStyle = "#2a1a12"; c.beginPath(); c.moveTo(-34, -10); c.quadraticCurveTo(-48, 10, -36, 32); c.quadraticCurveTo(-30, 22, -26, 28); c.lineTo(26, 28); c.quadraticCurveTo(30, 22, 36, 32); c.quadraticCurveTo(48, 10, 34, -10); c.closePath(); c.fill();
    c.fillStyle = "#f4d7bd"; c.beginPath(); c.ellipse(0, 0, 29, 34, 0, 0, 6.3); c.fill();
    c.fillStyle = "#2a1a12"; c.beginPath(); c.moveTo(-31, -6); c.quadraticCurveTo(-34, -38, 0, -38); c.quadraticCurveTo(34, -38, 31, -6); c.quadraticCurveTo(26, -22, 16, -18); c.quadraticCurveTo(8, -30, 0, -20); c.quadraticCurveTo(-8, -30, -16, -18); c.quadraticCurveTo(-26, -22, -31, -6); c.fill();
    [-1, 1].forEach(sd => {
      const lx = sd * 14.5; c.fillStyle = "rgba(200,230,255,.6)"; c.beginPath(); c.arc(lx, 3, 15, 0, 6.3); c.fill(); c.strokeStyle = "#0b0b0b"; c.lineWidth = 4.5; c.stroke();
      c.strokeStyle = "rgba(70,100,140,.6)"; c.lineWidth = 1.4; c.beginPath(); c.arc(lx, 3, 11, 0, 6.3); c.stroke();
      c.fillStyle = "#fff"; c.beginPath(); c.arc(lx, 3, 8.5, 0, 6.3); c.fill(); c.fillStyle = "#2a2a2a"; c.beginPath(); c.arc(lx, 3, 4.8, 0, 6.3); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.arc(lx - 1.6, 1, 1.6, 0, 6.3); c.fill();
    });
    c.strokeStyle = "#0b0b0b"; c.lineWidth = 3; c.beginPath(); c.moveTo(-29, 1); c.lineTo(-35, -2); c.moveTo(29, 1); c.lineTo(35, -2); c.stroke();
    c.strokeStyle = "#9a5a46"; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 17, 9, .25, 2.9); c.stroke(); c.restore();
  }
  function txt(s, x, y, size, col, al) { g.textAlign = al || "center"; g.textBaseline = "middle"; g.font = `700 ${size}px ${TXT}`; g.lineJoin = "round"; g.lineWidth = size * .24; g.strokeStyle = "rgba(0,0,0,.75)"; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); }
  function emoji(e, x, y, size) { g.font = size + "px " + EMO; g.textAlign = "center"; g.textBaseline = "bottom"; g.fillStyle = "#fff"; g.fillText(e, x, y); }

  // ---------- game state ----------
  function reset() {
    pl = { lane: 0, x: 0, y: 0, vy: 0, air: false, jumps: 0, roll: 0, ph: 0, scooty: 0, crocs: 0, cat: 0, saves: 0, inv: 0, fall: false };
    obs = []; coins = []; items = []; fx = []; dist = 0; score = 0; nCoins = 0; speed = 13; nextRow = 40; nextItem = 260; shake = 0;
    bld = []; for (let i = 0; i < 14; i++) [-1, 1].forEach(sd => bld.push({ z: i * 9 - 4, sd, h: rnd(2.5, 7), c: (i + sd + 9) % 4 }));
  }
  function start() { reset(); st = "play"; }
  function move(d) { if (st !== "play") return; const n = Math.max(-1, Math.min(1, pl.lane + d)); if (n !== pl.lane) { pl.lane = n; tone([[420, .04]]); } }
  function jump() {
    if (st !== "play") return tap();
    if (!pl.air) { pl.vy = pl.crocs > 0 ? 12.6 : 10.3; pl.air = true; pl.jumps = 1; pl.roll = 0; tone([[520, .06], [700, .06]]); }
    else if (pl.crocs > 0 && pl.jumps < 2) { pl.vy = 10.5; pl.jumps = 2; tone([[800, .07]]); }
  }
  function roll() { if (st !== "play") return; if (pl.air) { pl.vy = -17; pl.fall = true; } else pl.roll = .65; }
  function tap() { if (st === "paused") st = "play"; else if (st === "ready" || st === "over") start(); }
  const pop = (x, y, txtv) => fx.push({ x, y, vx: 0, vy: -40, l: 1.3, txt: txtv });
  const burst = (x, y, col) => { for (let i = 0; i < 10; i++) fx.push({ x, y, vx: rnd(-160, 160), vy: rnd(-200, 40), l: .7, c: col }); };
  const heroXY = () => [gx(pl.x, 0), gy(0, pl.y)];
  function die() {
    st = "over"; shake = 16; msg = MSGS[(Math.random() * MSGS.length) | 0]; tone([[220, .15], [130, .3]]);
    if (score > best) { best = score; store.set("nx_hs_prabhat3d", best); }
    if (score > 0) db.rpc("ah_submit_score", { p_game: "prabhat3d", p_score: score }).then(lb, () => {});
  }
  function mk(l, z, kind) {
    if (kind === "bar") return { l, z, kind, len: .8, hb: 0, ht: .75 };
    if (kind === "gantry") return { l, z, kind, len: .8, hb: 1.1, ht: 2.5 };
    return { l, z, kind: "train", len: rnd(5, 9), hb: 0, ht: 1.9, col: COL[(Math.random() * COL.length) | 0] };
  }
  function spawnRow() {
    const lanes = [-1, 0, 1].sort(() => Math.random() - .5), add = (l, k) => obs.push(mk(l, ZMAX, k));
    const kind = score < 150 ? (Math.random() < .6 ? "bar1" : "train1") : ["bar1", "bar3", "train1", "train2", "gantry", "mix"][(Math.random() * 6) | 0];
    if (kind === "bar1") { add(lanes[0], "bar"); if (Math.random() < .4) add(lanes[1], "bar"); }
    else if (kind === "bar3") lanes.forEach(l => add(l, "bar"));
    else if (kind === "train1") add(lanes[0], "train");
    else if (kind === "train2") { add(lanes[0], "train"); add(lanes[1], "train"); }
    else if (kind === "gantry") lanes.forEach(l => add(l, "gantry"));
    else { add(lanes[0], "train"); add(lanes[1], "bar"); }
    const used = new Set(obs.filter(o => o.z >= ZMAX - .1).map(o => o.l)), free = lanes.filter(l => !used.has(l)), cl = free.length ? free[0] : lanes[0];
    for (let i = 0; i < 5; i++) coins.push({ l: cl, z: ZMAX + (free.length ? 1 : 6) + i * 1.7 });
    const ln = Math.max(...obs.filter(o => o.z >= ZMAX - .1).map(o => o.len));
    return Math.max(12, ln + speed * rnd(.9, 1.4));
  }

  function step(dt) {
    const spd = speed * (pl.scooty > 0 ? 1.4 : 1);
    dist += spd * dt; speed = 13 + Math.min(13, dist / 90); score = Math.floor(dist) + nCoins * 10;
    pl.ph += dt * (7 + spd * .45); pl.x += (pl.lane - pl.x) * Math.min(1, dt * 14);
    if (pl.air) { pl.vy -= (pl.crocs > 0 ? 28 : 32) * dt; pl.y += pl.vy * dt; if (pl.y <= 0) { pl.y = 0; pl.vy = 0; pl.air = false; pl.jumps = 0; if (pl.fall) { pl.roll = .5; pl.fall = false; } } }
    if (pl.roll > 0) pl.roll -= dt;
    ["scooty", "crocs", "cat", "inv"].forEach(n => { pl[n] = Math.max(0, pl[n] - dt); }); if (pl.cat <= 0) pl.saves = 0;
    nextRow -= spd * dt; if (nextRow <= 0) nextRow = spawnRow();
    nextItem -= spd * dt;
    if (nextItem <= 0) {
      let l = [-1, 0, 1][(Math.random() * 3) | 0]; for (let i = 0; i < 3 && obs.some(o => o.l === l && o.z + o.len > ZMAX - 10); i++) l = [-1, 0, 1][(l + 2) % 3];
      items.push({ l, z: ZMAX, n: ["scooty", "crocs", "cat"][(Math.random() * 3) | 0] }); nextItem = rnd(380, 700);
    }
    bld.forEach(b => { b.z -= spd * dt; if (b.z < -9) { b.z += 126; b.h = rnd(2.5, 7); b.c = (Math.random() * 4) | 0; } });
    const ph = pl.roll > 0 && !pl.air ? .6 : 1.6, [hx, hy] = heroXY();
    for (const o of obs) {
      o.z -= spd * dt; if (o.dead) continue;
      if (Math.abs(pl.x - o.l) < .55 && o.z < .4 && o.z + o.len > -.4 && pl.y < o.ht && pl.y + ph > o.hb) {
        if (pl.scooty > 0) { o.dead = true; dist += 40; burst(gx(o.l, 0), gy(0, 1), "#fff"); pop(hx, hy - laneW * 2, "+40"); tone([[400, .05]]); }
        else if (pl.saves > 0 && pl.inv <= 0) { o.dead = true; pl.saves--; pl.inv = .6; burst(gx(o.l, 0), gy(0, 1), "#ffd166"); pop(hx, hy - laneW * 2, "Meow!"); tone([[900, .08], [700, .1]]); }
        else if (pl.inv <= 0) return die();
      }
    }
    obs = obs.filter(o => !o.dead && o.z + o.len > -7);
    for (const c of coins) { c.z -= spd * dt; if (!c.got && Math.abs(c.z) < 1 && Math.abs(pl.x - c.l) < (pl.scooty > 0 ? 1.8 : .6) && pl.y < 1.5) { c.got = true; nCoins++; tone([[1180, .04]]); } }
    coins = coins.filter(c => !c.got && c.z > -3);
    for (const it of items) { it.z -= spd * dt; if (Math.abs(it.z) < 1.1 && Math.abs(pl.x - it.l) < .65 && pl.y < 2.2) { it.got = true; pl[it.n] = IT[it.n].t; if (it.n === "cat") pl.saves = 2; dist += 60; burst(hx, hy - laneW, "#ffd166"); pop(hx, hy - laneW * 2.1, IT[it.n].l); tone([[660, .08], [990, .1]]); } }
    items = items.filter(it => !it.got && it.z > -3);
    fx.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; if (!p.txt) p.vy += 500 * dt; p.l -= dt; }); fx = fx.filter(p => p.l > 0);
  }

  // ---------- drawing ----------
  const qd = (a, col, stroke, lw) => { g.fillStyle = col; g.beginPath(); g.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) g.lineTo(a[i], a[i + 1]); g.closePath(); g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 2; g.stroke(); } };
  const fog = z => Math.max(0, Math.min(1, (ZMAX + 8 - z) / 22));
  function drawBar(o) {
    const z = o.z, x0 = gx(o.l - .42, z), x1 = gx(o.l + .42, z), yb = gy(z, 0), yt = gy(z, o.ht), s = sc(z), pw = Math.max(2, s * .09), bb = gy(z, o.ht - .32), bt = yt;
    g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(x0, yb - 1, x1 - x0, 3 + s * .05); g.fillStyle = "#2d2d2d"; g.fillRect(x0, yt, pw, yb - yt); g.fillRect(x1 - pw, yt, pw, yb - yt);
    g.save(); g.beginPath(); g.rect(x0, bt, x1 - x0, bb - bt); g.clip(); g.fillStyle = "#fff"; g.fillRect(x0, bt, x1 - x0, bb - bt); g.fillStyle = "#ff6b1a";
    const n = 8, w = (x1 - x0) / n, sk = (bb - bt) * .6; for (let i = -1; i < n; i += 2) { g.beginPath(); g.moveTo(x0 + i * w, bb); g.lineTo(x0 + (i + 1) * w, bb); g.lineTo(x0 + (i + 1) * w + sk, bt); g.lineTo(x0 + i * w + sk, bt); g.closePath(); g.fill(); }
    g.restore(); g.strokeStyle = "#111"; g.lineWidth = Math.max(1.5, s * .035); g.strokeRect(x0, bt, x1 - x0, bb - bt);
  }
  function drawGantry(o) {
    const z = o.z, x0 = gx(o.l - .5, z), x1 = gx(o.l + .5, z), yt = gy(z, o.ht), yb = gy(z, o.hb), y0 = gy(z, 0), s = sc(z), pw = Math.max(2, s * .08);
    g.fillStyle = "#2d2d2d"; g.fillRect(x0, yt, pw, y0 - yt); g.fillRect(x1 - pw, yt, pw, y0 - yt);
    g.fillStyle = "#ffc400"; g.fillRect(x0, yt, x1 - x0, yb - yt); g.fillStyle = "#151515"; const n = 8, w = (x1 - x0) / n; for (let i = 0; i < n; i += 2) g.fillRect(x0 + i * w, yb - (yb - yt) * .18, w, (yb - yt) * .18);
    g.strokeStyle = "#111"; g.lineWidth = Math.max(1.5, s * .035); g.strokeRect(x0, yt, x1 - x0, yb - yt); emoji("⚠️", (x0 + x1) / 2, yb - (yb - yt) * .12, (yb - yt) * .62);
  }
  function drawTrain(o) {
    const z = Math.max(o.z, -2.5), zf = o.z + o.len, x0 = gx(o.l - .45, z), x1 = gx(o.l + .45, z), yb = gy(z, 0), yt = gy(z, o.ht), s = sc(z);
    const fx0 = gx(o.l - .45, zf), fx1 = gx(o.l + .45, zf), fyt = gy(zf, o.ht), fyb = gy(zf, 0), sd = -Math.sign(o.l), lw = Math.max(1.5, s * .03);
    if (sd) { const xn = sd > 0 ? x1 : x0, xf = sd > 0 ? fx1 : fx0; qd([xn, yb, xn, yt, xf, fyt, xf, fyb], "rgba(0,0,0,.35)"); qd([xn, yb, xn, yt, xf, fyt, xf, fyb], o.col, "#111", lw); g.fillStyle = "rgba(0,0,0,.45)"; qd([xn, yb, xn, yt, xf, fyt, xf, fyb], "rgba(0,0,0,.38)"); }
    qd([x0, yt, x1, yt, fx1, fyt, fx0, fyt], "#e9ecff", "#111", lw);
    qd([x0, yb, x1, yb, x1, yt, x0, yt], o.col, "#111", lw);
    g.fillStyle = "#16224a"; g.fillRect(x0 + (x1 - x0) * .1, gy(z, 1.7), (x1 - x0) * .8, gy(z, 1.25) - gy(z, 1.7));
    g.fillStyle = "#ffe27a"; [.25, .75].forEach(f => { g.beginPath(); g.arc(x0 + (x1 - x0) * f, gy(z, .5), s * .09, 0, 6.3); g.fill(); });
    g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(x0, gy(z, .22), x1 - x0, gy(z, .1) - gy(z, .22));
  }
  function drawCoin(c) {
    const x = gx(c.l, c.z), y = gy(c.z, .6), s = sc(c.z), r = s * .2, w = Math.max(.25, Math.abs(Math.cos(tt * 6 + c.z)));
    g.fillStyle = "#ffcc00"; g.beginPath(); g.ellipse(x, y, r * w, r, 0, 0, 6.3); g.fill(); g.strokeStyle = "#8a5a00"; g.lineWidth = Math.max(1.5, s * .035); g.stroke();
    g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.ellipse(x - r * w * .3, y - r * .3, r * w * .25, r * .3, 0, 0, 6.3); g.fill();
  }
  function drawItem(it) {
    const x = gx(it.l, it.z), y = gy(it.z, 1 + Math.sin(tt * 4 + it.z) * .08), s = sc(it.z), r = s * .42;
    g.fillStyle = "rgba(255,255,255,.2)"; g.beginPath(); g.arc(x, y, r * 1.4, 0, 6.3); g.fill(); g.fillStyle = "#ffd666"; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.strokeStyle = "#7a5200"; g.lineWidth = Math.max(2, s * .045); g.stroke();
    if (it.n === "crocs") croc(g, x, y + r * .3, r / 9 * 1.5); else emoji(IT[it.n].e, x, y + r * .62, r * 1.35);
  }
  function drawWorld() {
    g.fillStyle = sky; g.fillRect(0, 0, W, horizon + 2);
    const sr = Math.min(W, H) * .13, sg = g.createRadialGradient(cx, horizon - sr * .6, 2, cx, horizon - sr * .6, sr); sg.addColorStop(0, "#fff3b0"); sg.addColorStop(1, "rgba(255,170,90,0)"); g.fillStyle = sg; g.fillRect(cx - sr, horizon - sr * 1.6, sr * 2, sr * 1.6);
    g.fillStyle = "#1d1a52"; skyline.forEach(b => g.fillRect(b.x, horizon - b.h, b.w, b.h + 1));
    g.fillStyle = "#171a3d"; g.fillRect(0, horizon, W, H - horizon);
    qd([gx(-2.4, -4), gy(-4), gx(2.4, -4), gy(-4), gx(2.4, ZMAX + 40), gy(ZMAX + 40), gx(-2.4, ZMAX + 40), gy(ZMAX + 40)], "#3a3f78");
    qd([gx(-1.5, -4), gy(-4), gx(1.5, -4), gy(-4), gx(1.5, ZMAX + 40), gy(ZMAX + 40), gx(-1.5, ZMAX + 40), gy(ZMAX + 40)], "#2a2d57");
    const off = dist % 6; g.globalAlpha = .75;
    for (let z = -off - 2; z < ZMAX; z += 6) [-.5, .5].forEach(x => qd([gx(x - .03, z), gy(z), gx(x + .03, z), gy(z), gx(x + .03, z + 2.6), gy(z + 2.6), gx(x - .03, z + 2.6), gy(z + 2.6)], "#fff"));
    g.globalAlpha = 1;
    [-1, 1].forEach(sd => qd([gx(sd * 1.5, -4), gy(-4), gx(sd * 1.56, -4), gy(-4), gx(sd * 1.56, ZMAX), gy(ZMAX), gx(sd * 1.5, ZMAX), gy(ZMAX)], "#ffd166"));
  }
  const bcol = ["#34408f", "#4a3a8c", "#2f5a8f", "#6b3f8f"];
  function drawBld(b) {
    const z = b.z, d = 4, xa = b.sd * 2.5, xb = b.sd * 6, yb = gy(z, 0), yt = gy(z, b.h), fz = z + d; if (z < -8) return;
    g.globalAlpha = fog(z); const xn = b.sd > 0 ? xa : xb;
    qd([gx(xn, z), gy(z, 0), gx(xn, z), gy(z, b.h), gx(xn, fz), gy(fz, b.h), gx(xn, fz), gy(fz, 0)], "#1e2260", "#0d0f30", 1.5);
    const x0 = Math.min(gx(xa, z), gx(xb, z)), x1 = Math.max(gx(xa, z), gx(xb, z)); qd([x0, yb, x1, yb, x1, yt, x0, yt], bcol[b.c], "#0d0f30", 1.5);
    g.fillStyle = "rgba(255,225,140,.55)"; const s = sc(z); for (let h = .8; h < b.h - .4; h += 1) for (let w = .25; w < .85; w += .3) g.fillRect(x0 + (x1 - x0) * w, gy(z, h + .5), (x1 - x0) * .14, s * .5);
    g.globalAlpha = 1;
  }
  function draw() {
    g.save(); if (shake > 0) g.translate(rnd(-shake, shake) / 2, rnd(-shake, shake) / 2);
    drawWorld();
    if (pl) {
      const list = [];
      bld.forEach(b => list.push([b.z + 4, () => drawBld(b)])); obs.forEach(o => list.push([o.z, () => { g.globalAlpha = fog(o.z); (o.kind === "bar" ? drawBar : o.kind === "gantry" ? drawGantry : drawTrain)(o); g.globalAlpha = 1; }]));
      coins.forEach(c => list.push([c.z, () => { g.globalAlpha = fog(c.z); drawCoin(c); g.globalAlpha = 1; }])); items.forEach(it => list.push([it.z, () => { g.globalAlpha = fog(it.z); drawItem(it); g.globalAlpha = 1; }]));
      list.push([0, drawPlayer]); list.sort((a, b) => b[0] - a[0]); list.forEach(e => e[1]());
      fx.forEach(p => { g.globalAlpha = Math.max(0, Math.min(1, p.l)); if (p.txt) txt(p.txt, p.x, p.y, Math.max(18, laneW * .24), "#ffd166"); else { g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 3.5, 0, 6.3); g.fill(); } }); g.globalAlpha = 1;
      hud();
    }
    if (st === "ready") overlay("Bhaag Prabhat Bhaag", ["Swipe ← → : lane badlo", "Swipe ↑ : jump   Swipe ↓ : roll"], "Tap to run");
    if (st === "over") overlay(msg, ["Score " + score, "🪙 " + nCoins + "     Best " + best], "Tap to run again");
    if (st === "paused") overlay("Paused", ["Game roka gaya hai"], "Tap to continue");
    g.restore();
  }
  function drawPlayer() {
    const [x, y0] = heroXY(), s = laneW * 1.75 / 125, rid = pl.scooty > 0, y = y0 - (rid ? laneW * .38 : 0), blink = rid && pl.scooty < 1.5 && ((tt * 10) | 0) % 2;
    g.fillStyle = "rgba(0,0,0,.38)"; const rx = laneW * .34 / (1 + pl.y * .4); g.beginPath(); g.ellipse(x, gy(0, 0), rx, rx * .28, 0, 0, 6.3); g.fill();
    if (pl.cat > 0) { const cxp = pl.x + (pl.x > 0 ? -.85 : .85); emoji("🐱", gx(cxp, .6), gy(.6, Math.abs(Math.sin(tt * 9)) * .18), sc(.6) * .75); }
    if (blink) return;
    if (rid) scooty(g, x, y0, s * 1.15);
    hero(g, x, y, s, pl.ph, { air: pl.air || rid, roll: pl.roll > 0 && !pl.air, lean: (pl.lane - pl.x), crocs: pl.crocs > 0 });
  }
  function hud() {
    const u = Math.max(14, Math.min(W, H) * .045), y = safeTop + u * 1.9;
    txt(String(score), W / 2, y, u * 1.9, "#fff"); txt("🪙 " + nCoins, 66, y, u * 1.1, "#ffd166", "left"); txt("BEST " + best, W - 66, y, u * .95, "#d7daf7", "right");
    const tags = []; if (pl.scooty > 0) tags.push(["🛵", pl.scooty]); if (pl.crocs > 0) tags.push(["C", pl.crocs]); if (pl.cat > 0) tags.push(["🐱", pl.cat, pl.saves]);
    const cw = u * 4.6, x0 = W / 2 - tags.length * cw / 2;
    tags.forEach((t, i) => {
      const x = x0 + i * cw + cw / 2, yy = y + u * 2.3; g.fillStyle = "rgba(10,12,40,.72)"; g.beginPath(); g.ellipse(x, yy, cw * .46, u * .95, 0, 0, 6.3); g.fill(); g.strokeStyle = "#ffd166"; g.lineWidth = 2; g.stroke();
      if (t[0] === "C") croc(g, x - cw * .24, yy + u * .5, u / 9 * 1.25); else emoji(t[0], x - cw * .24, yy + u * .6, u * 1.15);
      txt(Math.ceil(t[1]) + "s" + (t[2] != null ? " x" + t[2] : ""), x + cw * .12, yy, u * .85, "#fff");
    });
  }
  function overlay(title, lines, cta) {
    g.fillStyle = "rgba(8,10,35,.8)"; g.fillRect(0, 0, W, H); const s = Math.min(W / 300, H / 520) * 1.1, u = Math.max(16, Math.min(W, H) * .05);
    bust(g, W / 2, H * .25, s); txt(title, W / 2, H * .45, Math.min(u * 1.7, W / 11), "#fff");
    lines.forEach((l, i) => txt(l, W / 2, H * .53 + i * u * 1.6, u * .95, "#d7daf7")); txt(cta, W / 2, H * .53 + lines.length * u * 1.6 + u * 1.5, u * 1.15, "#ffd166");
  }
  function loop(now) {
    if (fs.classList.contains("hide")) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; tt += dt;
    if (document.hidden && st === "play") st = "paused";
    if (st === "play") step(dt); else if (st !== "play" && shake > 0) shake = Math.max(0, shake - dt * 40);
    if (st === "play" && shake > 0) shake = Math.max(0, shake - dt * 40);
    draw();
  }

  // ---------- poster, leaderboard, open/close ----------
  function drawPoster() {
    if (!gps) return; const c = gps.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2), w = gps.clientWidth || 640, h = gps.clientHeight || 360;
    gps.width = Math.round(w * dpr); gps.height = Math.round(h * dpr); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#241a6b"); gr.addColorStop(.6, "#a24bb0"); gr.addColorStop(1, "#ff9a6b"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = "#2a2d57"; c.beginPath(); c.moveTo(w * .7, h * .62); c.lineTo(w * .92, h * .62); c.lineTo(w * 1.2, h); c.lineTo(w * .42, h); c.closePath(); c.fill();
    c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 2; c.setLineDash([8, 9]); c.beginPath(); c.moveTo(w * .81, h * .62); c.lineTo(w * .81, h); c.stroke(); c.setLineDash([]);
    bust(c, w * .24, h * .5, Math.min(w * .5, h * 1.6) / 300);
    c.textAlign = "left"; c.textBaseline = "middle"; c.font = `700 ${h * .13}px ${TXT}`; c.lineWidth = h * .03; c.lineJoin = "round"; c.strokeStyle = "rgba(0,0,0,.7)";
    ["BHAAG", "PRABHAT", "BHAAG"].forEach((s, i) => { c.strokeText(s, w * .46, h * (.24 + i * .17)); c.fillStyle = i === 1 ? "#ffd166" : "#fff"; c.fillText(s, w * .46, h * (.24 + i * .17)); });
  }
  async function lb() {
    const r = await db.from("game_scores").select("user_id,score").eq("game", "prabhat3d").order("score", { ascending: false }).limit(10), box = $("#glb");
    if (r.error) { box.innerHTML = `<p class="mut">Leaderboard ke liye migration-05-game.sql dobara run karo.</p>`; return; }
    box.innerHTML = r.data.length ? r.data.map((x, i) => `<div class="mem"><b>${i + 1}</b>${av(people[x.user_id], 32)}<div><b>${esc(nm(x.user_id))}</b></div><b>${x.score}</b></div>`).join("") : `<p class="mut">Abhi koi score nahi. Pehle tum khelo!</p>`;
  }
  function open() {
    fs.classList.remove("hide"); document.body.style.overflow = "hidden";
    const rq = fs.requestFullscreen || fs.webkitRequestFullscreen;
    try { const p = rq && rq.call(fs); if (p && p.catch) p.catch(() => {}); } catch (_) {}
    resize(); reset(); st = "ready"; last = performance.now(); if (!raf) raf = requestAnimationFrame(loop);
  }
  function close() {
    try { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (_) {}
    fs.classList.add("hide"); document.body.style.overflow = ""; cancelAnimationFrame(raf); raf = 0; st = "ready"; lb();
  }
  window.loadGame = function () { drawPoster(); lb(); };
  window.NXG = { reset, start, step, draw, jump, move, roll, resize, state: () => st };

  // ---------- input ----------
  $("#gposter").addEventListener("click", open);
  $("#gposter").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  $("#gx").addEventListener("click", close);
  $("#gpause").addEventListener("click", () => { if (st === "play") st = "paused"; else if (st === "paused") st = "play"; });
  cv.addEventListener("pointerdown", e => { e.preventDefault(); sid = e.pointerId; sx = e.clientX; sy = e.clientY; sdone = false; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener("pointermove", e => {
    if (e.pointerId !== sid || sdone || st !== "play") return;
    const dx = e.clientX - sx, dy = e.clientY - sy, th = Math.max(22, Math.min(W, H) * .045);
    if (Math.abs(dx) > th || Math.abs(dy) > th) { sdone = true; if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else roll(); }
  });
  cv.addEventListener("pointerup", e => { if (e.pointerId !== sid) return; sid = null; if (!sdone) { if (st === "play") jump(); else tap(); } });
  cv.addEventListener("pointercancel", () => { sid = null; });
  cv.addEventListener("contextmenu", e => e.preventDefault());
  addEventListener("keydown", e => {
    if (fs.classList.contains("hide")) return; const k = e.code;
    if (k === "ArrowLeft" || k === "KeyA") { e.preventDefault(); move(-1); }
    else if (k === "ArrowRight" || k === "KeyD") { e.preventDefault(); move(1); }
    else if (k === "ArrowUp" || k === "KeyW" || k === "Space") { e.preventDefault(); if (!e.repeat) jump(); }
    else if (k === "ArrowDown" || k === "KeyS") { e.preventDefault(); roll(); }
    else if (k === "KeyP") { if (st === "play") st = "paused"; else if (st === "paused") st = "play"; }
    else if (k === "Escape" && !document.fullscreenElement) close();
  });
  const rs = () => { if (!fs.classList.contains("hide")) resize(); };
  addEventListener("resize", rs); addEventListener("orientationchange", () => setTimeout(rs, 200)); document.addEventListener("fullscreenchange", () => setTimeout(rs, 100));
  reset();
})();
