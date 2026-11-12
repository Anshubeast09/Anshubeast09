// ====== PASTE YOUR PUBLISHABLE KEY BELOW (never the service_role key) ======
const SUPA_URL = "https://atygompuhmarfdorifph.supabase.co";
const SUPA_KEY = "PASTE_YOUR_PUBLISHABLE_KEY_HERE";
const db = supabase.createClient(SUPA_URL, SUPA_KEY);

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MB = 1048576, EMOJI = ["👍", "❤️", "😂"];
const PERMS = ["chat", "upload_files", "view_gallery", "upload_gallery", "change_theme"];
let me = null, people = {}, roleSel = "member", replyTo = null, msgCache = {}, rxCache = [], online = 0, timer, urlCache = {}, busy = false, again = false;

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
$("#out").onclick = async () => { await db.auth.signOut(); location.reload(); };

async function boot(user, checkRole) {
  const { data: p, error } = await db.from("profiles").select("*").eq("id", user.id).single();
  if (error || !p) { await db.auth.signOut(); return toast("Profile not found."); }
  if (!p.is_enabled) { await db.auth.signOut(); return toast("This account is disabled."); }
  if (checkRole && p.role !== roleSel) { await db.auth.signOut(); return toast(`This account is a ${p.role}. Choose the ${p.role} tab.`); }
  me = p;
  $$(".own").forEach(x => x.classList.toggle("hide", me.role !== "owner"));
  $("#gup").classList.toggle("hide", !can("upload_gallery"));
  page("app");
  await loadPeople();
  go("ov");
  startRealtime();
}
(async () => { const { data } = await db.auth.getSession(); if (data.session) boot(data.session.user, false); })();

async function loadPeople() {
  const d = must(await db.from("profiles").select("id,display_name,role,is_enabled"));
  people = {}; d.forEach(p => people[p.id] = p);
}

$$("nav button").forEach(b => b.onclick = () => { go(b.dataset.v); $("#side").classList.remove("open"); });
$("#burger").onclick = () => $("#side").classList.toggle("open");
function go(v) {
  $$("nav button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  $$("main > section").forEach(s => s.classList.toggle("hide", s.id !== "v-" + v));
  ({ ov: loadOverview, chat: loadChat, files: loadFiles, gal: loadGallery, att: loadAttendance, mem: loadMembers, set: loadSettings })[v]();
}

// ---------- realtime ----------
let rt = null;
function startRealtime() {
  const pr = db.channel("hub-presence", { config: { presence: { key: me.id } } });
  pr.on("presence", { event: "sync" }, () => { online = Object.keys(pr.presenceState()).length; if (!$("#v-ov").classList.contains("hide")) loadOverview(); })
    .subscribe(s => { if (s === "SUBSCRIBED") pr.track({ name: me.display_name, at: Date.now() }); });
  const ch = db.channel("hub-messages");
  ["messages", "chat_reactions", "chat_attachments"].forEach(t =>
    ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => {
      clearTimeout(rt); rt = setTimeout(() => { if (!$("#v-chat").classList.contains("hide")) loadChat(true); }, 120);
    }));
  ch.subscribe();
}

// ---------- overview ----------
async function loadOverview() {
  $("#hi").textContent = `Welcome, ${me.display_name}`;
  const used = await usedBytes();
  const cards = [["Role", me.role], ["Online now", online], ["Storage used", `${size(used)} of ${size(me.storage_limit_bytes || 0)}`]];
  $("#stats").innerHTML = cards.map(c => `<div class="card"><small class="mut">${c[0]}</small><h2>${esc(c[1])}</h2></div>`).join("");
}

// ---------- chat ----------
async function loadChat(keepScroll) {
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
    return `<div class="m ${x.is_pinned ? "pin" : ""}">${x.is_pinned ? "📌 " : ""}<b>${esc(nm(x.sender_id))}</b><small>${new Date(x.created_at).toLocaleString()}</small>${q}<div>${text}</div>${files}
      <div class="acts">${rb}<button data-a="reply" data-id="${x.id}">Reply</button>${canPin ? `<button data-a="pin" data-id="${x.id}" data-p="${x.is_pinned ? 1 : 0}">${x.is_pinned ? "Unpin" : "Pin"}</button>` : ""}</div></div>`;
  }).join("") : `<p class="mut">No messages yet. Say hello.</p>`;
  if (stick) box.scrollTop = box.scrollHeight;
}

$("#msgs").onclick = async e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const id = +b.dataset.id, a = b.dataset.a;
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
    $("#ci").value = ""; replyTo = null; $("#rp").classList.add("hide"); loadChat();
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
