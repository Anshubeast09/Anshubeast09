// ====== PASTE YOUR PUBLISHABLE KEY BELOW (never the service_role key) ======
const SUPA_URL = "https://atygompuhmarfdorifph.supabase.co";
const SUPA_KEY = "sb_publishable_87rKjM0eqZiZlm-gIGRyGg_zd7h_Bgi";
const db = supabase.createClient(SUPA_URL, SUPA_KEY);

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MB = 1048576, EMOJI = ["👍", "❤️", "😂"];
const PERMS = ["chat", "upload_files", "view_gallery", "upload_gallery", "change_theme"];
let me = null, people = {}, roleSel = "member", replyTo = null, msgCache = {}, rxCache = [], online = 0, onlineIds = new Set(), timer, urlCache = {}, busy = false, again = false;

function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(timer); timer = setTimeout(() => t.classList.remove("show"), 4000); }
function must(r) { if (r.error) { console.error(r.error); toast(r.error.message); throw r.error; } return r.data; }
const can = k => me && (me.role === "owner" || (me.permissions && me.permissions[k]));
const safe = n => n.replace(/[^\w.\-]/g, "_");
const nm = id => (people[id] && people[id].display_name) || "Member";
const size = b => b > MB ? (b / MB).toFixed(1) + " MB" : Math.ceil(b / 1024) + " KB";
function media(url, mime, name) {
  if (!url) return "";
  mime = mime || "";
  if (mime.startsWith("image/")) return `<img src="${url}" alt="${esc(name)}" loading="lazy">`;
  if (mime.startsWith("video/")) return `<video src="${url}" controls preload="metadata"></video>`;
  if (mime.startsWith("audio/")) return `<audio src="${url}" controls></audio>`;
  return `<a href="${url}" target="_blank" rel="noopener">${esc(name)}</a>`;
}

// ---------- navigation & auth ----------
function page(id) { ["landing", "login", "app"].forEach(x => $("#" + x).classList.toggle("hide", x !== id)); }
$("#enter").onclick = () => page("login");
$("#back").onclick = () => page("landing");
$$(".tabs button").forEach(b => b.onclick = () => { roleSel = b.dataset.r; $$(".tabs button").forEach(x => x.classList.toggle("on", x === b)); });

$("#lf").onsubmit = async e => {
  e.preventDefault();
  const { data, error } = await db.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value });
  if (error) return toast(error.message);
  await boot(data.user, true);
};
$("#out").onclick = async () => { await pushDropDb().catch(() => {}); await db.auth.signOut(); location.reload(); };

async function boot(user, checkRole) {
  const { data: p, error } = await db.from("profiles").select("*").eq("id", user.id).single();
  if (error || !p) { await db.auth.signOut(); return toast("Profile not found."); }
  if (!p.is_enabled) { await db.auth.signOut(); return toast("This account is disabled."); }
  if (checkRole && p.role !== roleSel) { await db.auth.signOut(); return toast(`This account is a ${p.role}. Choose the ${p.role} tab.`); }
  me = p;
  applyTheme();
  $$(".own").forEach(x => x.classList.toggle("hide", me.role !== "owner"));
  $("#gup").classList.toggle("hide", !can("upload_gallery"));
  page("app");
  await loadPeople();
  paintMe();
  paintStorage();
  go("ov");
  startRealtime();
  initUnread();
  if (notifOn() && "PushManager" in window) pushOn().catch(console.error);
}
(async () => { const { data } = await db.auth.getSession(); if (data.session) boot(data.session.user, false); })();

async function loadPeople() {
  let q = await db.from("profiles").select("id,display_name,role,is_enabled,avatar_url,bio");
  if (q.error) q = await db.from("profiles").select("id,display_name,role,is_enabled");
  const d = must(q);
  people = {}; d.forEach(p => people[p.id] = p);
}

$$("nav button").forEach(b => b.onclick = () => { go(b.dataset.v); toggleSide(false); });
$("#burger").onclick = () => toggleSide();
$("#scrim").onclick = () => toggleSide(false);
function go(v) {
  $$("nav button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  $$("main > section").forEach(s => s.classList.toggle("hide", s.id !== "v-" + v));
  ({ ov: loadOverview, chat: loadChat, files: loadFiles, gal: loadGallery, att: loadAttendance, mem: loadMembers, set: loadSettings, prof: loadProfile, acct: () => { loadProfile(); notifUI(); applyTheme(); $("#snd").checked = soundOn(); }, own: () => { loadMembers(); loadSettings(); } })[v]();
}

// ---------- realtime ----------
let rt = null;
function startRealtime() {
  const pr = db.channel("hub-presence", { config: { presence: { key: me.id } } });
  pr.on("presence", { event: "sync" }, () => { onlineIds = new Set(Object.keys(pr.presenceState())); online = onlineIds.size; if (!$("#v-ov").classList.contains("hide")) paintMembers(); })
    .subscribe(s => { if (s === "SUBSCRIBED") pr.track({ name: me.display_name, at: Date.now() }); });
  const ch = db.channel("hub-messages");
  ["messages", "chat_reactions", "chat_attachments"].forEach(t =>
    ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => {
      clearTimeout(rt); rt = setTimeout(() => { if (!$("#v-chat").classList.contains("hide")) loadChat(true); }, 120);
    }));
  ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, p => onNewMsg(p.new));
  ch.subscribe();
}

// ---------- overview ----------
function setStorage(used) {
  const lim = me.storage_limit_bytes || 0, pct = lim ? Math.min(100, used / lim * 100) : 0;
  $("#stor").innerHTML = `<div class="row"><small>Storage</small><small>${size(used)} of ${size(lim)}</small></div><div class="bar"><i style="width:${pct}%"></i></div>`;
}
async function paintStorage() { setStorage(await usedBytes()); }
function paintMembers() {
  const list = Object.values(people).filter(p => p.is_enabled).sort((a, b) => (onlineIds.has(b.id) - onlineIds.has(a.id)) || a.display_name.localeCompare(b.display_name));
  $("#mcount").textContent = `${list.length} members · ${onlineIds.size} online`;
  $("#mlist2").innerHTML = list.map(p => `<div class="mem">${av(p, 38)}<div><b>${esc(p.display_name)}${p.id === me.id ? " (you)" : ""}</b><small class="mut">${p.role === "owner" ? "Owner" : "Member"}${p.bio ? " · " + esc(p.bio) : ""}</small></div><span class="dot ${onlineIds.has(p.id) ? "on" : ""}" title="${onlineIds.has(p.id) ? "Online" : "Offline"}"></span></div>`).join("");
}
async function loadOverview() {
  $("#hi").textContent = `Welcome, ${nm(me.id)}`;
  await loadPeople(); paintMembers(); paintStorage();
  if (!can("chat")) { $("#cprev").textContent = "You do not have chat access."; return; }
  const q = await db.from("messages").select("sender_id,content").order("created_at", { ascending: false }).limit(1);
  const m = q.data && q.data[0];
  $("#cprev").innerHTML = m ? `<b>${esc(nm(m.sender_id))}:</b> ${esc(m.content.slice(0, 90))}` : "No messages yet.";
}

// ---------- chat ----------
async function loadChat(keepScroll) {
  if (searching) { if (keepScroll) return; searching = false; $("#csearch").value = ""; }
  if (busy) { again = true; return; }
  busy = true;
  try { await drawChat(keepScroll); } finally { busy = false; if (again) { again = false; loadChat(true); } }
}
async function drawChat(keepScroll) {
  const box = $("#msgs");
  if (!can("chat")) { box.innerHTML = `<p class="mut">You do not have chat access.</p>`; return; }
  const stick = !keepScroll || box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
  const m = must(await db.from("messages").select("*").order("created_at", { ascending: false }).limit(100)).reverse();
  const ids = m.map(x => x.id);
  let atts = [], rx = [];
  if (ids.length) {
    [rx, atts] = await Promise.all([
      db.from("chat_reactions").select("*").in("message_id", ids).then(r => r.data || []),
      db.from("chat_attachments").select("*").in("message_id", ids).then(r => r.data || [])
    ]);
  }
  rxCache = rx; msgCache = {}; m.forEach(x => msgCache[x.id] = x);
  const need = atts.filter(a => !(urlCache[a.object_path] && urlCache[a.object_path].exp > Date.now()));
  if (need.length) {
    const sg = await db.storage.from("chat-attachments").createSignedUrls(need.map(a => a.object_path), 3600);
    (sg.data || []).forEach(u => { if (u.signedUrl) urlCache[u.path] = { url: u.signedUrl, exp: Date.now() + 3300000 }; });
  }
  const urls = {}; atts.forEach(a => { const c = urlCache[a.object_path]; urls[a.id] = c && c.url; });
  box.innerHTML = m.length ? m.map(x => {
    const q = x.reply_to_id && msgCache[x.reply_to_id] ? `<div class="q">${esc(nm(msgCache[x.reply_to_id].sender_id))}: ${esc(msgCache[x.reply_to_id].content.slice(0, 80))}</div>` : "";
    const files = atts.filter(a => a.message_id === x.id).map(a => media(urls[a.id], a.mime_type, a.file_name)).join("");
    const text = x.message_type !== "text" && files ? "" : esc(x.content);
    const rb = EMOJI.map(em => {
      const list = rx.filter(r => r.message_id === x.id && r.emoji === em), mine = list.some(r => r.user_id === me.id);
      return `<button data-a="rx" data-id="${x.id}" data-e="${em}" class="${mine ? "me" : ""}">${em} ${list.length || ""}</button>`;
    }).join("");
    const canPin = x.sender_id === me.id || me.role === "owner";
    const mine = x.sender_id === me.id;
    return `<div class="m ${mine ? "mine" : "other"} ${x.is_pinned ? "pin" : ""} ${!mine && mentionsMe(x.content) ? "ment" : ""}">${mine ? "" : av(people[x.sender_id], 34)}<div class="bub">${x.is_pinned ? "📌 " : ""}<b>${mine ? "You" : esc(nm(x.sender_id))}</b><small>${new Date(x.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</small>${q}<div>${text}${x.edited_at ? " <small>(edited)</small>" : ""}</div>${files}
      <div class="acts">${rb}<button data-a="reply" data-id="${x.id}">Reply</button>${canPin ? `<button data-a="pin" data-id="${x.id}" data-p="${x.is_pinned ? 1 : 0}">${x.is_pinned ? "Unpin" : "Pin"}</button>` : ""}${mine && x.message_type === "text" ? `<button data-a="edit" data-id="${x.id}">Edit</button>` : ""}${mine || me.role === "owner" ? `<button data-a="del" data-id="${x.id}">Delete</button>` : ""}</div></div></div>`;
  }).join("") : `<p class="mut">No messages yet. Say hello.</p>`;
  if (stick) box.scrollTop = box.scrollHeight;
  if (!document.hidden) markSeen();
}

$("#msgs").onclick = async e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const id = +b.dataset.id, a = b.dataset.a;
  if (a === "edit") return editMsg(id);
  if (a === "del") return delMsg(id);
  if (a === "reply") { replyTo = id; const r = $("#rp"); r.textContent = "Replying to " + nm(msgCache[id].sender_id) + " (click to cancel)"; r.classList.remove("hide"); $("#ci").focus(); }
  if (a === "pin") {
    const on = b.dataset.p === "0";
    must(await db.from("messages").update({ is_pinned: on, pinned_at: on ? new Date().toISOString() : null, pinned_by: on ? me.id : null }).eq("id", id).select().single());
    loadChat(true);
  }
  if (a === "rx") {
    const ex = rxCache.find(r => r.message_id === id && r.user_id === me.id && r.emoji === b.dataset.e);
    if (ex) must(await db.from("chat_reactions").delete().eq("id", ex.id).select());
    else must(await db.from("chat_reactions").insert({ message_id: id, user_id: me.id, emoji: b.dataset.e }).select());
    loadChat(true);
  }
};
$("#rp").onclick = () => { replyTo = null; $("#rp").classList.add("hide"); };
$("#cf").onchange = () => { const f = $("#cf").files[0]; $("#cfn").textContent = f ? "Attached: " + f.name : ""; };

$("#ci").oninput = () => {
  const m = $("#ci").value.match(/@(\w*)$/), box = $("#sug");
  if (!m) return box.classList.add("hide");
  const q = m[1].toLowerCase();
  const hits = Object.values(people).filter(p => p.is_enabled && p.display_name.replace(/\s+/g, "").toLowerCase().startsWith(q)).slice(0, 5);
  box.innerHTML = hits.map(p => `<div data-n="${esc(p.display_name.replace(/\s+/g, ""))}">@${esc(p.display_name)}</div>`).join("");
  box.classList.toggle("hide", !hits.length);
};
$("#sug").onclick = e => {
  const d = e.target.closest("[data-n]"); if (!d) return;
  $("#ci").value = $("#ci").value.replace(/@\w*$/, "@" + d.dataset.n + " "); $("#sug").classList.add("hide"); $("#ci").focus();
};
$("#ci").onkeydown = e => { if (e.key === "Enter") sendMsg(); };
$("#send").onclick = sendMsg;

async function sendMsg() {
  const text = $("#ci").value.trim(), file = $("#cf").files[0];
  if (!text && !file) return;
  if (file && file.size > 50 * MB) return toast("Attachment must be 50 MB or smaller.");
  const type = !file ? "text" : file.type === "image/gif" ? "gif" : file.type.startsWith("image/") ? "image" : "file";
  $("#send").disabled = true;
  try {
    const row = must(await db.from("messages").insert({ sender_id: me.id, content: (text || "📎 " + file.name).slice(0, 4000), message_type: type, reply_to_id: replyTo }).select().single());
    $("#ci").value = ""; replyTo = null; $("#rp").classList.add("hide"); loadChat(); sndSend();
    if (file) {
      const path = `${me.id}/${Date.now()}-${safe(file.name)}`;
      must(await db.storage.from("chat-attachments").upload(path, file, { contentType: file.type || "application/octet-stream" }));
      must(await db.from("chat_attachments").insert({ message_id: row.id, uploader_id: me.id, bucket_id: "chat-attachments", object_path: path, file_name: file.name, mime_type: file.type || "application/octet-stream", file_size: file.size }).select());
    }
    const ment = Object.values(people).filter(p => p.id !== me.id && text.toLowerCase().includes("@" + p.display_name.replace(/\s+/g, "").toLowerCase()));
    if (ment.length) await db.from("chat_mentions").insert(ment.map(p => ({ message_id: row.id, mentioned_user_id: p.id })));
    $("#ci").value = ""; $("#cf").value = ""; $("#cfn").textContent = ""; replyTo = null; $("#rp").classList.add("hide");
    loadChat();
  } finally { $("#send").disabled = false; }
}

// ---------- personal files ----------
async function listFolder(bucket, uid) {
  const r = await db.storage.from(bucket).list(uid, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (r.error) { toast(r.error.message); return []; }
  return r.data.filter(f => f.id);
}
async function usedBytes() { return (await listFolder("member-files", me.id)).reduce((s, f) => s + ((f.metadata && f.metadata.size) || 0), 0); }

async function loadFiles() {
  const l = await listFolder("member-files", me.id);
  const used = l.reduce((s, f) => s + ((f.metadata && f.metadata.size) || 0), 0);
  $("#quota").textContent = `Using ${size(used)} of ${size(me.storage_limit_bytes || 0)}`;
  setStorage(used);
  $("#flist").innerHTML = l.length ? l.map(f => `<div><span>${esc(f.name.replace(/^\d+-/, ""))} <small class="mut">${size(f.metadata.size || 0)}</small></span>
    <span><button class="btn alt" data-o="${esc(f.name)}">Open</button> <button class="btn alt" data-d="${esc(f.name)}">Delete</button></span></div>`).join("") : `<p class="mut">No files yet. Upload your first one.</p>`;
}
$("#flist").onclick = async e => {
  const o = e.target.dataset.o, d = e.target.dataset.d;
  if (o) { const s = must(await db.storage.from("member-files").createSignedUrl(`${me.id}/${o}`, 60)); window.open(s.signedUrl, "_blank"); }
  if (d && confirm("Delete this file?")) { must(await db.storage.from("member-files").remove([`${me.id}/${d}`])); loadFiles(); }
};
$("#mf").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  if (!can("upload_files")) return toast("You do not have upload permission.");
  const used = await usedBytes();
  if (used + f.size > (me.storage_limit_bytes || 0)) { e.target.value = ""; return toast("Storage allowance exceeded."); }
  must(await db.storage.from("member-files").upload(`${me.id}/${Date.now()}-${safe(f.name)}`, f));
  e.target.value = ""; toast("Uploaded."); loadFiles();
};

// ---------- gallery ----------
async function loadGallery() {
  const box = $("#glist");
  if (!can("view_gallery")) { box.innerHTML = `<p class="mut">You do not have gallery access.</p>`; return; }
  const out = [];
  for (const p of Object.values(people).filter(p => p.is_enabled)) {
    const l = await listFolder("common-gallery", p.id); if (!l.length) continue;
    const s = await db.storage.from("common-gallery").createSignedUrls(l.map(f => `${p.id}/${f.name}`), 3600);
    (s.data || []).forEach((u, i) => out.push({ uid: p.id, name: l[i].name, url: u.signedUrl, mime: (l[i].metadata && l[i].metadata.mimetype) || "" }));
  }
  box.innerHTML = out.length ? out.map(f => `<div class="card g">${media(f.url, f.mime, f.name.replace(/^\d+-/, ""))}<small class="mut">${esc(nm(f.uid))}</small>
    ${f.uid === me.id || me.role === "owner" ? `<button class="btn alt" data-p="${f.uid}/${esc(f.name)}">Delete</button>` : ""}</div>`).join("") : `<p class="mut">The gallery is empty.</p>`;
}
$("#glist").onclick = async e => {
  const p = e.target.dataset.p;
  if (p && confirm("Delete this file?")) { must(await db.storage.from("common-gallery").remove([p])); loadGallery(); }
};
$("#gf").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  if (!can("upload_gallery")) return toast("You do not have gallery upload permission.");
  must(await db.storage.from("common-gallery").upload(`${me.id}/${Date.now()}-${safe(f.name)}`, f));
  e.target.value = ""; toast("Uploaded."); loadGallery();
};

// ---------- attendance ----------
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
async function loadAttendance() {
  $("#today").textContent = "Today (India): " + today();
  const d = must(await db.from("attendance").select("*").order("attendance_date", { ascending: false }).limit(100));
  const mine = d.find(x => x.member_id === me.id && x.attendance_date === today());
  if (mine) { $("#as").value = mine.status; $("#an").value = mine.note || ""; }
  $("#alist").innerHTML = d.length ? d.map(x => `<div><span><b>${esc(nm(x.member_id))}</b> <small class="mut">${x.attendance_date}</small></span><span>${esc(x.status)}${x.note ? " · " + esc(x.note) : ""}</span></div>`).join("") : `<p class="mut">No attendance marked yet.</p>`;
}
$("#asave").onclick = async () => {
  must(await db.from("attendance").upsert({ member_id: me.id, attendance_date: today(), status: $("#as").value, note: $("#an").value.trim() || null, updated_at: new Date().toISOString() }, { onConflict: "member_id,attendance_date" }).select());
  toast("Attendance saved."); loadAttendance();
};

// ---------- owner: members ----------
async function loadMembers() {
  const d = must(await db.from("profiles").select("*").order("created_at"));
  $("#mlist").innerHTML = d.map(p => `<div class="card mrow" data-id="${p.id}"><b>${esc(p.display_name)}</b><small class="mut">${p.role}</small>
    <label><input type="checkbox" class="en" ${p.is_enabled ? "checked" : ""}> enabled</label>
    ${PERMS.map(k => `<label><input type="checkbox" data-k="${k}" ${p.permissions && p.permissions[k] ? "checked" : ""}> ${k}</label>`).join("")}
    <label>MB <input type="number" class="q" min="0" max="5120" value="${Math.round((p.storage_limit_bytes || 0) / MB)}"></label>
    <button class="btn" data-x="save">Save</button><button class="btn alt" data-x="edit">Edit</button>${p.role !== "owner" ? '<button class="btn alt" data-x="del">Delete</button>' : ""}</div>`).join("");
}
$("#mlist").onclick = async e => {
  if (e.target.tagName !== "BUTTON") return;
  const r = e.target.closest("[data-id]"), perms = {}, act = e.target.dataset.x;
  if (act === "edit") return editMember(r.dataset.id);
  if (act === "del") return delMember(r.dataset.id);
  r.querySelectorAll("[data-k]").forEach(c => perms[c.dataset.k] = c.checked);
  const mb = Math.min(5120, Math.max(0, +r.querySelector(".q").value || 0));
  const res = await db.functions.invoke("admin-update-member", { body: { member_id: r.dataset.id, is_enabled: r.querySelector(".en").checked, permissions: perms, storage_limit_bytes: mb * MB } });
  if (res.error) return toast("Update failed: " + res.error.message);
  toast("Member updated."); await loadPeople();
};
$("#mf2").onsubmit = async e => {
  e.preventDefault();
  const res = await db.functions.invoke("admin-create-member", { body: { display_name: $("#mn").value.trim(), email: $("#me").value.trim(), password: $("#mp").value } });
  if (res.error) return toast("Create failed: " + res.error.message);
  e.target.reset(); toast("Member created."); await loadPeople(); loadMembers();
};

// ---------- owner: chat settings ----------
async function loadSettings() {
  const s = must(await db.from("chat_settings").select("retention_limit,cleanup_enabled").eq("id", true).single());
  $("#sc").checked = s.cleanup_enabled; $("#sr").value = s.retention_limit;
}
$("#ssave").onclick = async () => {
  const n = +$("#sr").value;
  if (!Number.isInteger(n) || n < 1 || n > 10000) return toast("Enter a number from 1 to 10000.");
  must(await db.from("chat_settings").update({ retention_limit: n, cleanup_enabled: $("#sc").checked, updated_by: me.id, updated_at: new Date().toISOString() }).eq("id", true).select("retention_limit,cleanup_enabled").single());
  toast("Settings saved.");
};

async function fnErr(res) { try { const j = await res.error.context.json(); return j.error || res.error.message; } catch (_) { return res.error.message; } }
async function editMember(id) {
  const name = prompt("Display name:", nm(id)); if (name === null) return;
  const email = prompt("New email (leave empty to keep current):", ""); if (email === null) return;
  const pw = prompt("New password, minimum 8 characters (leave empty to keep current):", ""); if (pw === null) return;
  const res = await db.functions.invoke("admin-manage-member", { body: { action: "edit", member_id: id, display_name: name.trim(), email: email.trim(), password: pw } });
  if (res.error) return toast(await fnErr(res));
  toast("Member updated."); await loadPeople(); loadMembers();
}
async function delMember(id) {
  if (prompt(`This permanently deletes ${nm(id)}, their messages and their files. Type DELETE to confirm:`) !== "DELETE") return;
  const res = await db.functions.invoke("admin-manage-member", { body: { action: "delete", member_id: id } });
  if (res.error) return toast(await fnErr(res));
  toast("Member deleted."); await loadPeople(); loadMembers();
}

// ---------- change password ----------
$("#pwf").onsubmit = async e => {
  e.preventDefault();
  const p0 = $("#p0").value, p1 = $("#p1").value, p2 = $("#p2").value;
  if (p1.length < 8) return toast("New password must be at least 8 characters.");
  if (p1 !== p2) return toast("New passwords do not match.");
  if (p1 === p0) return toast("New password must be different from the current one.");
  const { data: u } = await db.auth.getUser();
  const chk = await db.auth.signInWithPassword({ email: u.user.email, password: p0 });
  if (chk.error) return toast("Current password is incorrect.");
  const r = await db.auth.updateUser({ password: p1 });
  if (r.error) return toast(r.error.message);
  e.target.reset(); toast("Password updated.");
};

// ---------- background particles ----------
(function () {
  const c = $("#bg"), x = c.getContext("2d");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { c.remove(); return; }
  let w, h, P = [], m = { x: -999, y: -999 };
  const rs = () => { w = c.width = innerWidth; h = c.height = innerHeight; P = Array.from({ length: Math.min(70, Math.floor(w * h / 18000)) }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3 })); };
  addEventListener("resize", rs); addEventListener("pointermove", e => { m.x = e.clientX; m.y = e.clientY; }); rs();
  (function f() {
    x.clearRect(0, 0, w, h);
    for (const p of P) {
      p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1;
      const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < 110) { p.x += dx / d * 1.2; p.y += dy / d * 1.2; }
      x.fillStyle = "rgba(140,130,255,.7)"; x.beginPath(); x.arc(p.x, p.y, 1.6, 0, 6.3); x.fill();
    }
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const d = Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y);
      if (d < 110) { x.strokeStyle = `rgba(124,108,255,${.18 * (1 - d / 110)})`; x.beginPath(); x.moveTo(P[i].x, P[i].y); x.lineTo(P[j].x, P[j].y); x.stroke(); }
    }
    requestAnimationFrame(f);
  })();
})();

// ---------- installable app (PWA) ----------
let installEvt = null;
const showInst = on => $$(".inst").forEach(b => b.classList.toggle("hide", !on));
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; showInst(true); });
$$(".inst").forEach(b => b.onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; showInst(false); });
addEventListener("appinstalled", () => showInst(false));
if (/iphone|ipad/i.test(navigator.userAgent) && !navigator.standalone) $("#ioshint").classList.remove("hide");
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.error));

// ---------- avatars, sidebar, mobile menu ----------
const av = (p, sz = 34) => {
  p = p || {}; const st = `--s:${sz}px`;
  return p.avatar_url && p.avatar_url.startsWith("data:image/jpeg;base64,")
    ? `<img class="av" style="${st}" src="${esc(p.avatar_url)}" alt="">`
    : `<span class="av" style="${st}">${esc((p.display_name || "?").trim().charAt(0).toUpperCase())}</span>`;
};
function paintMe() {
  const p = { ...me, ...(people[me.id] || {}) };
  $("#chip").innerHTML = `${av(p, 38)}<div><b>${esc(p.display_name)}</b><small>${esc(p.role)}</small></div>`;
  $("#topav").innerHTML = av(p, 32);
}
function toggleSide(on) { const o = $("#side").classList.toggle("open", on); $("#scrim").classList.toggle("hide", !o); }

// ---------- update profile ----------
let newAvatar = null, clearAv = false;
async function loadProfile() {
  newAvatar = null; clearAv = false;
  const p = { ...me, ...(people[me.id] || {}) };
  $("#pn").value = p.display_name || ""; $("#pb").value = p.bio || ""; $("#pav").innerHTML = av(p, 84);
  const u = await db.auth.getUser(); $("#pe").textContent = (u.data.user && u.data.user.email) || "";
}
function resizeImg(file, n) {
  return new Promise((ok, no) => {
    const u = URL.createObjectURL(file), i = new Image();
    i.onload = () => { const c = document.createElement("canvas"); c.width = c.height = n; const m = Math.min(i.width, i.height);
      c.getContext("2d").drawImage(i, (i.width - m) / 2, (i.height - m) / 2, m, m, 0, 0, n, n); URL.revokeObjectURL(u); ok(c.toDataURL("image/jpeg", 0.8)); };
    i.onerror = () => no(new Error("Could not read this image")); i.src = u;
  });
}
$("#paf").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  if (!f.type.startsWith("image/")) return toast("Please choose an image file.");
  try { newAvatar = await resizeImg(f, 160); clearAv = false; $("#pav").innerHTML = av({ avatar_url: newAvatar, display_name: $("#pn").value }, 84); }
  catch (err) { toast(err.message); }
};
$("#prm").onclick = () => { newAvatar = null; clearAv = true; $("#pav").innerHTML = av({ display_name: $("#pn").value }, 84); };
$("#pf").onsubmit = async e => {
  e.preventDefault();
  const row = must(await db.rpc("ah_update_my_profile", { p_display_name: $("#pn").value.trim(), p_bio: $("#pb").value, p_avatar_url: newAvatar, p_clear_avatar: clearAv }));
  me = { ...me, ...row }; await loadPeople(); paintMe(); toast("Profile updated.");
};

// ---------- version ----------
const APP_VERSION = "V.01.01";
$$(".ver").forEach(e => e.textContent = APP_VERSION);

// ---------- local preferences ----------
const store = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };

// ---------- theme ----------
function applyTheme() {
  const ok = !me || can("change_theme");
  const t = ok ? store.get("nx_theme") || "dark" : "dark", a = ok ? store.get("nx_accent") || "purple" : "purple";
  document.documentElement.dataset.theme = t; document.documentElement.dataset.accent = a;
  $('meta[name="theme-color"]').content = t === "light" ? "#f3f5ff" : "#0a0d1c";
  $$("#thm button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
  $$("#acc button").forEach(b => b.classList.toggle("on", b.dataset.a === a));
  $("#thmnote").textContent = ok ? "Saved on this device." : "The owner has not allowed theme changes for your account.";
}
$("#thm").onclick = e => { const t = e.target.dataset.t; if (t && can("change_theme")) { store.set("nx_theme", t); applyTheme(); } };
$("#acc").onclick = e => { const a = e.target.dataset.a; if (a && can("change_theme")) { store.set("nx_accent", a); applyTheme(); } };
applyTheme();

// ---------- unread + notifications ----------
let unread = 0, searching = false;
const seenKey = () => "nx_seen_" + me.id;
function setUnread(n) { unread = n; const b = $("#cb"); b.textContent = n > 99 ? "99+" : n; b.classList.toggle("hide", !n); document.title = (n ? `(${n}) ` : "") + "NEXORA"; if (navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); }
function markSeen() { store.set(seenKey(), new Date().toISOString()); setUnread(0); clearNotifs(); }
async function initUnread() {
  if (!can("chat")) return;
  const last = store.get(seenKey()); if (!last) return markSeen();
  const r = await db.from("messages").select("id", { count: "exact", head: true }).gt("created_at", last).neq("sender_id", me.id);
  setUnread(r.count || 0);
}
const mentionsMe = t => !!t && t.toLowerCase().includes("@" + nm(me.id).replace(/\s+/g, "").toLowerCase());
const notifOn = () => store.get("nx_notif") === "1" && "Notification" in window && Notification.permission === "granted";
function notify(title, body, tag) {
  if (!notifOn()) return;
  const o = { body, icon: "icon-192.png", badge: "icon-192.png", tag };
  const fb = () => { try { new Notification(title, o); } catch (_) {} };
  if (navigator.serviceWorker) navigator.serviceWorker.ready.then(r => r.showNotification(title, o)).catch(fb); else fb();
}
function onNewMsg(m) {
  if (!me || !can("chat") || m.sender_id === me.id) return;
  sndRecv();
  if (!$("#v-chat").classList.contains("hide") && !document.hidden) return;
  setUnread(unread + 1);
  if (!pushActive) notify(mentionsMe(m.content) ? `${nm(m.sender_id)} mentioned you` : nm(m.sender_id), (m.content || "").slice(0, 120), "nx-" + m.id);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && me && !$("#v-chat").classList.contains("hide")) markSeen(); });
function notifUI() {
  const st = $("#nstat"), b = $("#nbtn");
  if (!("Notification" in window)) { st.textContent = "This browser does not support notifications. On iPhone, add the app to the Home Screen first."; b.classList.add("hide"); return; }
  const on = notifOn(), denied = Notification.permission === "denied";
  st.textContent = denied ? "Blocked. Allow notifications for this site in browser settings." : on ? "On: you get a notification for every new message, even when the app is closed." : "Off.";
  b.textContent = on ? "Turn off" : "Enable notifications"; b.disabled = denied;
  if (on && "serviceWorker" in navigator && "PushManager" in window) navigator.serviceWorker.ready.then(x => x.pushManager.getSubscription()).then(sb => { st.textContent += sb ? " This device is registered for push." : " This device is NOT registered for push yet: tap Turn off, then Enable again."; });
}
$("#nbtn").onclick = async () => {
  if (notifOn()) { store.set("nx_notif", "0"); await pushOff().catch(() => {}); return notifUI(); }
  const p = await Notification.requestPermission();
  store.set("nx_notif", p === "granted" ? "1" : "0");
  if (p === "granted") { try { await pushOn(); } catch (e) { toast("Push setup failed: " + (e.message || e)); } notify("NEXORA", "Notifications are on.", "nx-test"); }
  notifUI();
};

// ---------- chat edit / delete / search ----------
async function editMsg(id) {
  const old = msgCache[id]; if (!old) return;
  const t = prompt("Edit message:", old.content); if (t === null) return;
  const v = t.trim(); if (!v || v === old.content) return;
  must(await db.rpc("ah_edit_message", { p_id: id, p_content: v.slice(0, 4000) })); loadChat(true);
}
async function delMsg(id) {
  if (!confirm("Delete this message?")) return;
  const paths = must(await db.rpc("ah_delete_message", { p_id: id }));
  if (paths && paths.length) await db.storage.from("chat-attachments").remove(paths);
  loadChat(true);
}
$("#csearch").onkeydown = async e => {
  if (e.key !== "Enter") return;
  const q = e.target.value.trim();
  if (!q) { if (searching) { searching = false; loadChat(); } return; }
  searching = true;
  const d = must(await db.from("messages").select("*").ilike("content", `%${q}%`).order("created_at", { ascending: false }).limit(50));
  $("#msgs").innerHTML = `<p class="mut">${d.length} result(s). Clear the box and press Enter to go back.</p>` +
    d.map(x => `<div class="sr"><b>${esc(nm(x.sender_id))}</b> <small class="mut">${new Date(x.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</small><div>${esc(x.content)}</div></div>`).join("");
};
$("#csearch").oninput = e => { if (!e.target.value && searching) { searching = false; loadChat(); } };

// ---------- web push (works when the app is closed) ----------
const VAPID_PUBLIC = "BLaZa8XZu3ozfv5d8lrMU74yJPwChKRfcxXI2sbTa0qSrtZyO_A_-83maNK_WXhtScSB81nyw7bW4NeNgdkqiY0";
const b64 = v => Uint8Array.from(atob((v + "=".repeat((4 - v.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
async function pushOn() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Push is not supported here. On iPhone, add the app to the Home Screen.");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) });
  const k = sub.toJSON();
  must(await db.rpc("ah_save_push_sub", { p_endpoint: k.endpoint, p_p256dh: k.keys.p256dh, p_auth: k.keys.auth }));
  pushActive = true;
}
async function pushDropDb() {
  if (!("serviceWorker" in navigator)) return;
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (sub) await db.rpc("ah_remove_push_sub", { p_endpoint: sub.endpoint });
}
async function pushOff() {
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (sub) { await db.rpc("ah_remove_push_sub", { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
  pushActive = false;
}

// ---------- sounds ----------
let actx = null;
const soundOn = () => store.get("nx_sound") !== "0";
const AC = window.AudioContext || window.webkitAudioContext;
addEventListener("pointerdown", () => { try { actx = actx || new AC(); actx.resume(); } catch (_) {} }, { once: true });
function tone(seq) {
  if (!soundOn() || !AC) return;
  try {
    actx = actx || new AC(); if (actx.state === "suspended") actx.resume();
    let t = actx.currentTime;
    for (const [f, d] of seq) {
      const o = actx.createOscillator(), g = actx.createGain(); o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.8;
    }
  } catch (_) {}
}
const sndSend = () => tone([[660, 0.09], [880, 0.09]]);
const sndRecv = () => tone([[880, 0.12], [1175, 0.16]]);
$("#snd").onchange = e => { store.set("nx_sound", e.target.checked ? "1" : "0"); if (e.target.checked) sndRecv(); };

// ---------- WhatsApp-style notification helpers ----------
let pushActive = false;
function clearNotifs() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.ready.then(r => r.getNotifications({ tag: "nx-chat" })).then(l => l.forEach(n => n.close())).catch(() => {});
}

// ---------- dashboard shortcuts & settings sub-tabs ----------
document.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (g) go(g.dataset.go); });
$$(".subtabs").forEach(t => t.addEventListener("click", e => {
  const b = e.target.closest("button[data-p]"); if (!b) return;
  [...t.children].forEach(x => { x.classList.toggle("on", x === b); $("#" + x.dataset.p).classList.toggle("hide", x !== b); });
}));
