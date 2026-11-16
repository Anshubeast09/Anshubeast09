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
