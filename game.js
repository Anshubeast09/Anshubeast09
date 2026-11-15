// NEXORA Game Zone: "Bhaag Prabhat Bhaag" (endless dodge runner). Needs app.js globals: $, db, store, tone, esc, nm, av, people.
(function () {
  const GW = 560, GH = 300, GROUND = 252, PX = 90;
  const cv = $("#gcv"), g = cv.getContext("2d"), rnd = (a, b) => a + Math.random() * (b - a);
  const EMO = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif", TXT = "'Space Grotesk','DM Sans',sans-serif";
  const MSGS = ["Pakda gaya! 😅", "Chashma toot gaya! 🤓", "Bas 5 minute aur... 😴", "Crocs phisal gaye! 🩴", "Mummy ne dekh liya! 😱"];
  const IT = { scooty: { t: 8, l: "Scooty!" }, crocs: { t: 10, l: "Jumping Crocs!" }, cat: { t: 12, l: "Billi aayi!" } };
  let k = 1, state = "ready", last = 0, raf = 0, duck = false, best = +(store.get("nx_hs_prabhat") || 0), msg = MSGS[0];
  let P, obs, items, fx, dist, score, speed, nextObs, nextItem, shake, bg, sky;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2); k = cv.clientWidth / GW || 1;
    cv.width = Math.round(GW * k * dpr); cv.height = Math.round(GH * k * dpr);
    g.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
    sky = g.createLinearGradient(0, 0, 0, GROUND); sky.addColorStop(0, "#12154a"); sky.addColorStop(1, "#4b2f7a");
  }
  function reset() {
    P = { y: GROUND, vy: 0, ground: true, jumps: 0, ph: 0, scooty: 0, crocs: 0, cat: 0, saves: 0 };
    obs = []; items = []; fx = []; dist = 0; score = 0; speed = 5.5; nextObs = 320; nextItem = 1000; shake = 0;
    bg = Array.from({ length: 9 }, (_, i) => ({ x: i * 80, w: rnd(40, 80), h: rnd(40, 110) }));
  }
  function start() { reset(); state = "play"; }
  function jump() {
    if (state !== "play") { if (state === "paused") { state = "play"; return; } return start(); }
    const max = P.crocs > 0 ? 2 : 1;
    if (P.ground) { P.vy = -(P.crocs > 0 ? 14.4 : 13.2); P.ground = false; P.jumps = 1; puff(); tone([[520, .06], [700, .06]]); }
    else if (P.jumps < max) { P.vy = -13.6; P.jumps++; puff(); tone([[760, .07]]); }
  }
  const puff = () => { for (let i = 0; i < 5; i++) fx.push({ x: PX - 6, y: P.y - 3, vx: rnd(-2, .5), vy: rnd(-1.5, 0), l: 1, c: "rgba(255,255,255,.6)" }); };
  const pop = (x, y, txt) => fx.push({ x, y, vx: 0, vy: -.6, l: 1.4, txt });
  const burst = (x, y, c) => { for (let i = 0; i < 9; i++) fx.push({ x, y, vx: rnd(-4, 4), vy: rnd(-5, 1), l: 1, c }); };

  function spawnObs() {
    const x = GW + 40;
    if (score > 150 && Math.random() < .28) obs.push({ x, y: GROUND - 44, w: 36, h: 36, e: Math.random() < .5 ? "⏰" : "🩴" });
    else {
      const e = ["📚", "🐕", "📦"][(Math.random() * 3) | 0], w = e === "🐕" ? 44 : 34;
      obs.push({ x, y: GROUND, w, h: 34, e });
      if (Math.random() < .25) obs.push({ x: x + w + 8, y: GROUND, w: 34, h: 34, e: "📚" });
    }
  }
  function spawnItem() { items.push({ x: GW + 30, y: GROUND - rnd(55, 100), n: ["scooty", "crocs", "cat"][(Math.random() * 3) | 0] }); }
  function pick(n) { P[n] = IT[n].t; if (n === "cat") P.saves = 2; dist += 100; pop(PX, P.y - 84, IT[n].l); burst(PX, P.y - 30, "#ffd166"); tone([[660, .08], [990, .1]]); }
  function die() {
    state = "over"; shake = 10; msg = MSGS[(Math.random() * MSGS.length) | 0]; tone([[220, .15], [130, .3]]);
    if (score > best) { best = score; store.set("nx_hs_prabhat", best); }
    if (score > 0) db.rpc("ah_submit_score", { p_game: "prabhat", p_score: score }).then(lb, () => {});
  }

  function step(f) {
    const sp = speed * (P.scooty > 0 ? 1.45 : 1);
    dist += sp * f; score = Math.floor(dist / 10); speed = Math.min(12, 5.5 + score / 350);
    P.ph += .22 * (sp / 6) * f;
    if (!P.ground) { P.vy += (.75 + (duck ? .9 : 0)) * f; P.y += P.vy * f; if (P.y >= GROUND) { P.y = GROUND; P.vy = 0; P.ground = true; P.jumps = 0; } }
    ["scooty", "crocs", "cat"].forEach(n => { P[n] = Math.max(0, P[n] - f / 60); }); if (P.cat <= 0) P.saves = 0;
    nextObs -= sp * f; if (nextObs <= 0) { spawnObs(); nextObs = Math.max(170, sp * rnd(30, 56)); }
    nextItem -= sp * f; if (nextItem <= 0) { spawnItem(); nextItem = rnd(1500, 2800); }
    bg.forEach(b => { b.x -= sp * .3 * f; if (b.x + b.w < 0) { b.x = GW + rnd(0, 40); b.w = rnd(40, 80); b.h = rnd(40, 110); } });
    const h = duck && P.ground ? 34 : 60, bx = PX - 13 + 6, bw = 26 - 12, by = P.y - h + 6, bh = h - 12;
    for (const o of obs) {
      o.x -= sp * f; if (o.dead) continue;
      if (bx < o.x + o.w - 6 && bx + bw > o.x + 6 && by < o.y - 6 && by + bh > o.y - o.h + 6) {
        o.dead = true; burst(o.x + o.w / 2, o.y - o.h / 2, "#ffffff");
        if (P.scooty > 0) { dist += 50; pop(o.x, o.y - 40, "+5"); tone([[400, .05]]); }
        else if (P.saves > 0) { P.saves--; pop(PX - 30, P.y - 50, "Meow!"); tone([[900, .08], [700, .1]]); }
        else return die();
      }
    }
    obs = obs.filter(o => !o.dead && o.x + o.w > -30);
    for (const it of items) { it.x -= sp * f; if (Math.hypot(it.x - PX, it.y - (P.y - 30)) < 34) { it.got = true; pick(it.n); } }
    items = items.filter(it => !it.got && it.x > -30);
    fx.forEach(p => { p.x += p.vx * f; p.y += p.vy * f; if (!p.txt) p.vy += .25 * f; p.l -= .03 * f; }); fx = fx.filter(p => p.l > 0);
    if (shake > 0) shake -= f * .5;
  }

  // ---- drawing ----
  function croc(x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = col || "#76c442";
    g.beginPath(); g.ellipse(0, -1, 9, 6.5, 0, Math.PI, 0); g.fill(); g.fillStyle = "#5aa22c"; g.fillRect(-10, -1, 21, 3.5);
    g.fillStyle = "rgba(0,0,0,.45)"; [-4, 0, 4].forEach(dx => { g.beginPath(); g.arc(dx, -4, 1.1, 0, 6.3); g.fill(); }); g.restore();
  }
  // pose: 0 run, 1 air, 2 duck, 3 on scooty
  function prabhat(x, y, ph, pose, s, crocsOn) {
    g.save(); g.translate(x, y); g.scale(s, s);
    if (pose === 3) {
      g.fillStyle = "#e5484d"; g.beginPath(); g.moveTo(-26, -14); g.quadraticCurveTo(-6, -6, 18, -16); g.lineTo(26, -34); g.lineTo(31, -34); g.lineTo(24, -12); g.lineTo(-22, -6); g.closePath(); g.fill();
      g.strokeStyle = "#222"; g.lineWidth = 3; g.beginPath(); g.moveTo(26, -34); g.lineTo(20, -48); g.stroke();
      g.fillStyle = "#222"; [[-20, -7], [24, -7]].forEach(w => { g.beginPath(); g.arc(w[0], w[1], 8, 0, 6.3); g.fill(); g.fillStyle = "#999"; g.beginPath(); g.arc(w[0], w[1], 3, 0, 6.3); g.fill(); g.fillStyle = "#222"; });
      g.translate(0, -12);
    }
    if (pose === 2) { g.translate(4, 0); g.scale(1.1, .62); }
    const air = pose === 1 || pose === 3, skin = "#f3d5ba", skinD = "#e0b998";
    const leg = (ox, a, front) => {
      const hx = ox, hy = -26, fx = air ? hx + (front ? 11 : -6) : hx + Math.sin(a) * 14, fy = air ? -9 : -2 - Math.max(0, Math.cos(a)) * 9;
      const kx = (hx + fx) / 2 + 5, ky = (hy + fy) / 2;
      g.lineCap = "round"; g.strokeStyle = "#c9b28a"; g.lineWidth = 11; g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.stroke();
      g.strokeStyle = front ? skin : skinD; g.lineWidth = 8; g.beginPath(); g.moveTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      if (crocsOn) { g.shadowColor = "#b8ff4a"; g.shadowBlur = 12; } croc(fx + 3, fy + 2, 1.05); g.shadowBlur = 0;
    };
    leg(-3, ph + Math.PI, false);
    const arm = (a, front) => {
      const sx = 0, sy = -50, ex = sx + 4 + Math.sin(a) * 11, ey = sy + 14, hx2 = ex + 6 + Math.sin(a) * 6, hy2 = ey + 8;
      g.strokeStyle = front ? skin : skinD; g.lineWidth = 9; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
      g.lineWidth = 7; g.beginPath(); g.moveTo(ex, ey); g.lineTo(hx2, hy2); g.stroke();
      g.fillStyle = front ? skin : skinD; g.beginPath(); g.arc((sx + ex) / 2 + 1, (sy + ey) / 2, 5.5, 0, 6.3); g.fill(); g.beginPath(); g.arc(hx2, hy2, 4, 0, 6.3); g.fill();
    };
    arm(air ? 1.2 : ph, false);
    g.fillStyle = "#12a4a0"; g.beginPath(); g.moveTo(-12, -52); g.lineTo(12, -52); g.lineTo(9, -26); g.lineTo(-8, -26); g.closePath(); g.fill();
    g.fillStyle = "#c9b28a"; g.fillRect(-9, -29, 19, 8);
    g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(-2, -46, 7, 3);
    leg(3, ph, true);
    arm(air ? -.8 : ph + Math.PI, true);
    g.fillStyle = skin; g.fillRect(-1, -57, 6, 7);
    // wavy hair (back) + head
    g.fillStyle = "#2a1a12"; g.beginPath(); g.moveTo(-9, -72); g.quadraticCurveTo(-18, -66 + Math.sin(ph * 2) * 1.5, -13, -60); g.quadraticCurveTo(-19, -56, -10, -52); g.quadraticCurveTo(-8, -62, -3, -66); g.closePath(); g.fill();
    g.fillStyle = skin; g.beginPath(); g.ellipse(2, -63, 9.5, 11, 0, 0, 6.3); g.fill();
    g.fillStyle = "#2a1a12"; g.beginPath(); g.moveTo(-8, -62); g.quadraticCurveTo(-8, -78, 4, -76); g.quadraticCurveTo(13, -75, 12, -66); g.quadraticCurveTo(4, -70, -1, -64); g.quadraticCurveTo(-4, -62, -8, -62); g.fill();
    g.beginPath(); g.arc(-6, -56, 3, 0, 6.3); g.fill();
    // thick glasses: two big lenses, magnified eye, rings
    [[-1, .55], [10, 1]].forEach(l => {
      g.fillStyle = "rgba(190,225,255," + (.55 * l[1] + .1) + ")"; g.beginPath(); g.arc(l[0], -63, 7.6, 0, 6.3); g.fill();
      g.strokeStyle = "#111"; g.lineWidth = 2.6; g.stroke();
      g.strokeStyle = "rgba(60,90,130,.55)"; g.lineWidth = .8; g.beginPath(); g.arc(l[0], -63, 5.3, 0, 6.3); g.stroke();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(l[0] + 1, -63, 4.4, 0, 6.3); g.fill(); g.fillStyle = "#222"; g.beginPath(); g.arc(l[0] + 2.2, -63, 2.2, 0, 6.3); g.fill();
    });
    g.strokeStyle = "#111"; g.lineWidth = 2; g.beginPath(); g.moveTo(6.5, -63); g.lineTo(3, -63); g.moveTo(-8, -63); g.lineTo(-10, -61); g.stroke();
    g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 1.2; g.beginPath(); g.arc(8, -66, 4, 3.6, 4.5); g.stroke();
    g.strokeStyle = "#a45f4a"; g.lineWidth = 1.4; g.beginPath(); g.arc(8, -56, 2.6, .2, 2.8); g.stroke();
    g.restore();
  }
  function emoji(e, x, y, size) { g.font = size + "px " + EMO; g.textAlign = "center"; g.textBaseline = "bottom"; g.fillText(e, x, y); }
  function overlay(title, l1, l2) {
    g.fillStyle = "rgba(8,10,35,.74)"; g.fillRect(0, 0, GW, GH);
    prabhat(105, 215, performance.now() / 160, 0, 2, false);
    g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillStyle = "#fff"; g.font = "700 30px " + TXT; g.fillText(title, 205, 112);
    g.font = "16px " + TXT; g.fillStyle = "#c9ccf0"; g.fillText(l1, 205, 148); g.fillText(l2, 205, 172);
    g.fillStyle = "#ffd166"; g.font = "700 16px " + TXT; g.fillText("Tap / Space to " + (state === "paused" ? "continue" : state === "over" ? "retry" : "start"), 205, 212);
  }
  function draw() {
    const t = performance.now();
    g.save(); if (shake > 0) g.translate(rnd(-shake, shake) / 2, rnd(-shake, shake) / 2);
    g.fillStyle = sky; g.fillRect(0, 0, GW, GH);
    g.fillStyle = "#fff5c4"; g.beginPath(); g.arc(470, 50, 18, 0, 6.3); g.fill();
    (bg || []).forEach((b, i) => { g.fillStyle = "#232868"; g.fillRect(b.x, GROUND - b.h, b.w, b.h); g.fillStyle = "rgba(255,214,120,.35)"; for (let y = GROUND - b.h + 8; y < GROUND - 10; y += 16) for (let x = b.x + 7; x < b.x + b.w - 8; x += 14) if ((i + x + y) % 3) g.fillRect(x, y, 5, 7); });
    g.fillStyle = "#2b2760"; g.fillRect(0, GROUND, GW, GH - GROUND); g.fillStyle = "#4b3f8f"; g.fillRect(0, GROUND, GW, 3);
    g.fillStyle = "rgba(255,255,255,.14)"; for (let x = -((dist || 0) % 46); x < GW; x += 46) g.fillRect(x, GROUND + 18, 20, 3);
    if (P) {
      for (const it of items) {
        const y = it.y + Math.sin(t / 250 + it.x) * 4; g.fillStyle = "rgba(255,255,255,.16)"; g.beginPath(); g.arc(it.x, y, 21, 0, 6.3); g.fill();
        if (it.n === "crocs") croc(it.x, y + 6, 1.9); else emoji(it.n === "cat" ? "🐱" : "🛵", it.x, y + 14, 30);
      }
      for (const o of obs) emoji(o.e, o.x + o.w / 2, o.y, o.h * 1.1);
      if (P.cat > 0) { const cy = P.ground ? GROUND : GROUND - 4 - Math.abs(Math.sin(t / 120)) * 8; emoji("🐱", PX - 50, cy, 30); }
      const pose = P.scooty > 0 ? 3 : !P.ground ? 1 : duck ? 2 : 0;
      if (!(P.scooty > 0 && P.scooty < 1.5 && ((t / 100) | 0) % 2)) prabhat(PX, P.y, P.ph, pose, 1, P.crocs > 0);
      for (const p of fx) {
        g.globalAlpha = Math.max(0, Math.min(1, p.l));
        if (p.txt) { g.fillStyle = "#ffd166"; g.font = "700 16px " + TXT; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillText(p.txt, p.x, p.y); }
        else { g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 2.5, 0, 6.3); g.fill(); }
      }
      g.globalAlpha = 1;
      g.fillStyle = "#fff"; g.font = "700 18px " + TXT; g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText("SCORE " + score, 14, 28);
      g.textAlign = "right"; g.fillStyle = "#c9ccf0"; g.font = "14px " + TXT; g.fillText("BEST " + best, GW - 14, 26);
      g.textAlign = "left"; g.fillStyle = "#ffd166"; g.font = "700 13px " + TXT;
      const tags = [P.scooty > 0 && "Scooty " + Math.ceil(P.scooty) + "s", P.crocs > 0 && "Crocs " + Math.ceil(P.crocs) + "s", P.cat > 0 && "Billi x" + P.saves].filter(Boolean);
      tags.forEach((s, i) => g.fillText(s, 14, 48 + i * 16));
    }
    if (state === "ready") overlay("Bhaag Prabhat Bhaag", "Obstacles se bacho, jitna ho sake bhaago!", "Jump: tap / Space   Duck: hold / Down");
    if (state === "over") overlay(msg, "Score " + score + "   Best " + best, "Power-ups: Scooty, Jumping Crocs, Billi");
    if (state === "paused") overlay("Paused", "Game roka gaya hai.", "Wapas aane ke liye tap karo.");
    g.restore();
  }
  function loop(now) {
    if ($("#v-game").classList.contains("hide")) { raf = 0; if (state === "play") state = "paused"; return; }
    raf = requestAnimationFrame(loop);
    const f = Math.min(3, (now - last) / 16.667 || 1); last = now;
    if (document.hidden && state === "play") state = "paused";
    if (state === "play") step(f); else if (shake > 0) shake -= f * .5;
    draw();
  }
  async function lb() {
    const r = await db.from("game_scores").select("user_id,score").eq("game", "prabhat").order("score", { ascending: false }).limit(10);
    if (r.error) { $("#glb").innerHTML = `<p class="mut">Leaderboard ke liye migration-05-game.sql run karo.</p>`; return; }
    $("#glb").innerHTML = r.data.length ? r.data.map((x, i) => `<div class="mem"><b>${i + 1}</b>${av(people[x.user_id], 32)}<div><b>${esc(nm(x.user_id))}</b></div><b>${x.score}</b></div>`).join("") : `<p class="mut">Abhi koi score nahi. Pehle tum khelo!</p>`;
  }
  window.loadGame = function () { reset(); resize(); lb(); if (!raf) raf = requestAnimationFrame(loop); };
  window.NXG = { reset, start, step, draw, jump, resize, setDuck: v => { duck = v; }, state: () => state };

  // ---- input ----
  cv.addEventListener("pointerdown", e => { e.preventDefault(); jump(); });
  const hold = (el, on) => { ["pointerdown"].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); on(true); })); ["pointerup", "pointerleave", "pointercancel"].forEach(ev => el.addEventListener(ev, () => on(false))); };
  $("#gjp").addEventListener("pointerdown", e => { e.preventDefault(); jump(); });
  hold($("#gdk"), v => { duck = v; });
  const typing = () => /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "");
  addEventListener("keydown", e => {
    if ($("#v-game").classList.contains("hide") || typing()) return;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); if (!e.repeat) jump(); }
    if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); duck = true; }
  });
  addEventListener("keyup", e => { if (e.code === "ArrowDown" || e.code === "KeyS") duck = false; });
  addEventListener("resize", () => { if (!$("#v-game").classList.contains("hide")) resize(); });
  reset();
})();
