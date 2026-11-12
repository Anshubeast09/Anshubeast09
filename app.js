/* AADARSH HUB — SUPABASE CLIENT */
const SUPABASE_URL = "https://atygompuhmarfdorifph.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_87rKjM0eqZiZlm-gIGRyGg_zd7h_Bgi";
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});
const $ = id => document.getElementById(id);
const state = {
  user: null, profile: null, role: "member", panel: "overview",
  messagesChannel: null, presenceChannel: null, online: new Set(),
  selectedLoginRole: "member", replyTo: null, membersForMentions: []
};
const PERMISSIONS = ["chat", "upload_files", "view_gallery", "upload_gallery", "change_theme"];
const PERMISSION_LABELS = {
  chat: "Group chat", upload_files: "Upload files", view_gallery: "View gallery",
  upload_gallery: "Upload gallery", change_theme: "Change theme"
};
let toastTimer;

function toast(message, error = false) {
  const el = $("toast"); if (!el) return;
  el.textContent = message; el.style.borderColor = error ? "#ff7b8b66" : "#7489ff55";
  el.classList.add("show"); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
function showView(view) {
  ["landing", "auth-view", "app-view"].forEach(id => $(id)?.classList.toggle("hidden", id !== view));
}
function initials(name = "A") {
  return name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase() || "A";
}
function bytes(n) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"]; let i = 0;
  while (n >= 1024 && i < 3) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}
function safeText(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function niceDate(s) {
  return s ? new Date(s).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "";
}
function todayIST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Kolkata", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
}
function hasPermission(key) { return state.role === "owner" || state.profile?.permissions?.[key] === true; }
function setOnlineCount() {
  const n = Math.max(state.online.size, 1);
  if ($("online-count")) $("online-count").textContent = `${n} online`;
  if ($("stat-online")) $("stat-online").textContent = n;
}

/* NAVIGATION */
function setPanel(name) {
  if (name === "chat" && !hasPermission("chat")) return toast("Chat access is disabled for this account.", true);
  if (name === "gallery" && !hasPermission("view_gallery")) return toast("Gallery access is disabled for this account.", true);
  if (["members", "chat-settings"].includes(name) && state.role !== "owner") return toast("Owner access only.", true);
  state.panel = name;
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  $(`panel-${name}`)?.classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.panel === name));
  const titles = { overview:"Your space.", chat:"Group conversation.", files:"Your personal locker.", gallery:"Shared memories.", attendance:"Attendance tracker.", members:"Member control.", "chat-settings":"Chat settings." };
  $("page-title").textContent = titles[name] || "Aadarsh Hub";
  $("current-crumb").textContent = name.toUpperCase();
  $("sidebar").classList.remove("open");
  if (name === "chat") loadMessages();
  if (name === "files") loadFiles();
  if (name === "gallery") loadGallery();
  if (name === "attendance") loadAttendance();
  if (name === "chat-settings" && state.role === "owner") loadChatSettings();
  if (name === "members" && state.role === "owner") loadMembers();
}

/* AUTH */
async function loadProfile(user) {
  const { data, error } = await db.from("profiles").select("*").eq("id", user.id).single();
  if (error) throw error;
  if (!data.is_enabled) { await db.auth.signOut(); throw new Error("This account is disabled. Contact the Hub owner."); }
  state.user = user; state.profile = data; state.role = data.role;
}
async function enterApp(user) {
  try {
    await loadProfile(user);
    const name = state.profile.display_name || user.email?.split("@")[0] || "Member";
    $("side-name").textContent = name; $("side-role").textContent = state.role.toUpperCase();
    $("side-avatar").textContent = initials(name); $("header-avatar").textContent = initials(name);
    $("welcome-name").textContent = name; $("stat-role").textContent = state.role.toUpperCase();
    $("owner-nav").classList.toggle("hidden", state.role !== "owner");
    $("gallery-upload-wrap").classList.toggle("hidden", !hasPermission("upload_gallery"));
    document.querySelector('[data-panel="chat"]').classList.toggle("hidden", !hasPermission("chat"));
    document.querySelector('[data-panel="gallery"]').classList.toggle("hidden", !hasPermission("view_gallery"));
    $("stat-storage").textContent = bytes(state.profile.storage_limit_bytes || 0);
    $("storage-sub").textContent = "Storage allowance";
    showView("app-view"); setPanel("overview"); startPresence();
    await loadMentionMembers();
  } catch (e) { toast(e.message || "Could not load your profile.", true); showView("auth-view"); }
}
async function login(e) {
  e.preventDefault(); const email = $("login-email").value.trim(), password = $("login-password").value;
  const btn = e.submitter; btn.disabled = true; btn.textContent = "Signing in…";
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  btn.disabled = false; btn.innerHTML = 'Sign in <span>→</span>';
  if (error) return toast(error.message, true);
  try {
    await loadProfile(data.user);
    if (state.selectedLoginRole !== state.profile.role) { await db.auth.signOut(); return toast("This account does not have that login role.", true); }
    await enterApp(data.user);
  } catch (err) { await db.auth.signOut(); toast(err.message, true); }
}

/* PRESENCE */
async function startPresence() {
  if (state.presenceChannel) await db.removeChannel(state.presenceChannel);
  state.online = new Set([state.user.id]);
  state.presenceChannel = db.channel("hub-presence", { config:{ presence:{ key:state.user.id } } });
  state.presenceChannel.on("presence", { event:"sync" }, () => {
    state.online = new Set(Object.keys(state.presenceChannel.presenceState())); setOnlineCount();
  });
  state.presenceChannel.subscribe(async status => {
    if (status === "SUBSCRIBED") await state.presenceChannel.track({ display_name:state.profile.display_name, online_at:new Date().toISOString() });
  });
  setOnlineCount();
}
async function stopPresence() {
  if (state.presenceChannel) { await db.removeChannel(state.presenceChannel); state.presenceChannel = null; }
  if (state.messagesChannel) { await db.removeChannel(state.messagesChannel); state.messagesChannel = null; }
}

/* CHAT */
async function loadMentionMembers() {
  const { data } = await db.from("profiles").select("id,display_name").eq("is_enabled", true).order("display_name");
  state.membersForMentions = data || [];
}
function attachmentMarkup(a) {
  const url = a.signedUrl || ""; const name = safeText(a.file_name || "Attachment");
  const mime = a.mime_type || "";
  if (mime.startsWith("image/")) return `<a class="chat-attachment" href="${url}" target="_blank" rel="noopener"><img loading="lazy" src="${url}" alt="${name}"><small>${name}</small></a>`;
  if (mime.startsWith("video/")) return `<div class="chat-attachment"><video controls preload="metadata" src="${url}"></video><small>${name}</small></div>`;
  if (mime.startsWith("audio/")) return `<div class="chat-attachment"><audio controls src="${url}"></audio><small>${name}</small></div>`;
  return `<a class="chat-file-link" href="${url}" target="_blank" rel="noopener" download>📎 ${name} <small>${bytes(a.file_size)}</small></a>`;
}
function renderMessage(m) {
  const mine = m.sender_id === state.user.id;
  const sender = m.profiles?.display_name || (mine ? state.profile.display_name : "Member");
  const reactions = (m.reactions || []).reduce((acc, r) => { acc[r.emoji] ||= []; acc[r.emoji].push(r); return acc; }, {});
  const reply = m.replyMessage ? `<div class="reply-preview"><b>Replying to ${safeText(m.replyMessage.sender || "member")}</b><span>${safeText(m.replyMessage.content || "Attachment")}</span></div>` : "";
  const attachments = (m.attachments || []).map(attachmentMarkup).join("");
  const reactionHtml = Object.entries(reactions).map(([emoji, rows]) => `<button class="reaction-chip ${rows.some(r => r.user_id === state.user.id) ? "selected" : ""}" data-react="${safeText(emoji)}" data-message="${m.id}">${safeText(emoji)} ${rows.length}</button>`).join("");
  const canPin = state.role === "owner" || mine;
  return `<article class="message ${mine ? "mine" : ""} ${m.is_pinned ? "pinned-message" : ""}" data-message-card="${m.id}" data-sender="${m.sender_id}">
    <div class="message-meta">${safeText(sender)} ${m.is_pinned ? '<span class="pin-label">📌 PINNED</span>' : ""}</div>
    ${reply}<div class="message-bubble">${safeText(m.content || "")}</div>
    ${attachments ? `<div class="message-attachments">${attachments}</div>` : ""}
    ${reactionHtml ? `<div class="message-reactions">${reactionHtml}</div>` : ""}
    <div class="message-tools"><button data-reply="${m.id}">Reply</button><button data-react="👍" data-message="${m.id}">👍</button><button data-react="❤️" data-message="${m.id}">❤️</button><button data-react="😂" data-message="${m.id}">😂</button>${canPin ? `<button data-pin="${m.id}" data-pinned="${m.is_pinned ? "true" : "false"}">${m.is_pinned ? "Unpin" : "Pin"}</button>` : ""}</div>
    <div class="message-time">${niceDate(m.created_at)}</div></article>`;
}
async function enrichMessages(rows) {
  if (!rows.length) return rows;
  const ids = rows.map(m => m.id);
  const [attRes, reactRes] = await Promise.all([
    db.from("chat_attachments").select("id,message_id,uploader_id,bucket_id,object_path,file_name,mime_type,file_size,is_pinned").in("message_id", ids),
    db.from("chat_reactions").select("id,message_id,user_id,emoji").in("message_id", ids)
  ]);
  const attachments = attRes.data || [], reactions = reactRes.data || [];
  for (const a of attachments) {
    const { data } = await db.storage.from(a.bucket_id || "chat-attachments").createSignedUrl(a.object_path, 3600);
    a.signedUrl = data?.signedUrl || "";
  }
  const byId = new Map(rows.map(m => [m.id, m]));
  for (const m of rows) { m.attachments = []; m.reactions = []; }
  attachments.forEach(a => byId.get(a.message_id)?.attachments.push(a));
  reactions.forEach(r => byId.get(r.message_id)?.reactions.push(r));
  for (const m of rows) {
    if (m.reply_to_id) {
      const reply = rows.find(x => x.id === m.reply_to_id);
      if (reply) m.replyMessage = { sender:reply.profiles?.display_name, content:reply.content };
      else {
        const { data } = await db.from("messages").select("content,profiles!messages_sender_id_fkey(display_name)").eq("id", m.reply_to_id).maybeSingle();
        if (data) m.replyMessage = { sender:data.profiles?.display_name, content:data.content };
      }
    }
  }
  return rows;
}
async function loadMessages() {
  if (!hasPermission("chat")) return;
  const box = $("chat-messages"); box.innerHTML = '<div class="empty-state">Loading conversation…</div>';
  const { data, error } = await db.from("messages").select("id,sender_id,content,created_at,message_type,reply_to_id,is_pinned,profiles!messages_sender_id_fkey(display_name)").order("created_at", { ascending:true }).limit(100);
  if (error) { box.innerHTML = `<div class="empty-state">${safeText(error.message)}</div>`; return; }
  const rows = await enrichMessages(data || []);
  box.innerHTML = rows.length ? rows.map(renderMessage).join("") : '<div class="empty-state">No messages yet. Start the conversation.</div>';
  box.scrollTop = box.scrollHeight;
  if (state.messagesChannel) await db.removeChannel(state.messagesChannel);
  state.messagesChannel = db.channel("hub-messages")
    .on("postgres_changes", { event:"*", schema:"public", table:"messages" }, () => { if (state.panel === "chat") loadMessages(); })
    .on("postgres_changes", { event:"*", schema:"public", table:"chat_reactions" }, () => { if (state.panel === "chat") loadMessages(); })
    .on("postgres_changes", { event:"*", schema:"public", table:"chat_attachments" }, () => { if (state.panel === "chat") loadMessages(); })
    .subscribe();
}
async function sendMessage(e) {
  e.preventDefault(); if (!hasPermission("chat")) return toast("Chat permission is disabled.", true);
  const input = $("chat-input"), content = input.value.trim();
  if (!content) return;
  if (content.length > 4000) return toast("Message cannot exceed 4000 characters.", true);
  const btn = $("chat-send"); if (btn) btn.disabled = true;
  const payload = { sender_id:state.user.id, content, message_type:"text", reply_to_id:state.replyTo?.id || null };
  const { data, error } = await db.from("messages").insert(payload).select("id").single();
  if (btn) btn.disabled = false;
  if (error) return toast(error.message, true);
  await saveMentions(data.id, content);
  input.value = ""; clearReply();
  if (state.panel === "chat") loadMessages();
}

function updateMentionSuggestions() {
  const input = $("chat-input"), box = $("mention-suggestions");
  const before = input.value.slice(0, input.selectionStart || 0);
  const at = before.lastIndexOf("@");
  if (at < 0 || before.slice(at).includes("\n")) { box.classList.add("hidden"); box.innerHTML = ""; return; }
  const query = before.slice(at + 1).toLocaleLowerCase();
  const matches = state.membersForMentions.filter(m => m.display_name.toLocaleLowerCase().includes(query)).slice(0, 6);
  if (!matches.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
  box.innerHTML = matches.map(m => `<button type="button" data-mention-id="${m.id}">${safeText(m.display_name)}</button>`).join("");
  box.classList.remove("hidden");
}
function chooseMention(e) {
  const btn = e.target.closest("[data-mention-id]"); if (!btn) return;
  const member = state.membersForMentions.find(m => m.id === btn.dataset.mentionId); if (!member) return;
  const input = $("chat-input"), start = input.selectionStart || 0, end = input.selectionEnd || start;
  const before = input.value.slice(0, start), at = before.lastIndexOf("@");
  if (at < 0) return;
  input.value = input.value.slice(0, at) + `@${member.display_name} ` + input.value.slice(end);
  const pos = at + member.display_name.length + 2; input.setSelectionRange(pos, pos); input.focus();
  $("mention-suggestions").classList.add("hidden");
}

async function saveMentions(messageId, content) {
  const lower = content.toLocaleLowerCase();
  const found = new Set();
  for (const member of state.membersForMentions) {
    const tag = `@${member.display_name}`.toLocaleLowerCase();
    if (member.id !== state.user.id && lower.includes(tag)) found.add(member.id);
  }
  if (found.size) {
    const { error } = await db.from("chat_mentions").insert([...found].map(id => ({ message_id:messageId, mentioned_user_id:id })));
    if (error) console.warn("Mention records could not be saved:", error.message);
  }
}
function clearReply() {
  state.replyTo = null; const bar = $("replying-to"); if (bar) { bar.classList.add("hidden"); bar.textContent = ""; }
}
async function uploadChatAttachment(file) {
  if (!file || !hasPermission("chat")) return;
  if (file.size > 50 * 1024 * 1024) { toast("Chat attachments must be 50 MB or smaller.", true); return; }
  const safeName = file.name.replace(/[^\w.\-() ]/g, "_").slice(0, 120);
  const type = file.type.startsWith("image/") ? (file.type === "image/gif" ? "gif" : "image") : "file";
  const { data: message, error: msgError } = await db.from("messages").insert({ sender_id:state.user.id, content:`Shared ${safeName}`, message_type:type, reply_to_id:state.replyTo?.id || null }).select("id").single();
  if (msgError) return toast(msgError.message, true);
  const path = `${state.user.id}/${message.id}-${Date.now()}-${safeName}`;
  const { error: uploadError } = await db.storage.from("chat-attachments").upload(path, file, { upsert:false, contentType:file.type || "application/octet-stream" });
  if (uploadError) {
    await db.from("messages").delete().eq("id", message.id);
    return toast(uploadError.message, true);
  }
  const { error: rowError } = await db.from("chat_attachments").insert({ message_id:message.id, uploader_id:state.user.id, bucket_id:"chat-attachments", object_path:path, file_name:file.name, mime_type:file.type || "application/octet-stream", file_size:file.size });
  if (rowError) {
    await db.storage.from("chat-attachments").remove([path]);
    await db.from("messages").delete().eq("id", message.id);
    return toast(rowError.message, true);
  }
  clearReply(); toast("Attachment shared."); $("chat-file-input").value = ""; loadMessages();
}
async function handleChatAction(e) {
  const replyBtn = e.target.closest("[data-reply]");
  const pinBtn = e.target.closest("[data-pin]");
  const reactBtn = e.target.closest("[data-react]");
  if (replyBtn) {
    const id = Number(replyBtn.dataset.reply);
    const card = replyBtn.closest("[data-message-card]");
    const text = card?.querySelector(".message-bubble")?.textContent || "Attachment";
    state.replyTo = { id, content:text.slice(0,100) };
    const bar = $("replying-to"); bar.textContent = `Replying to: ${text.slice(0,100)}`; bar.classList.remove("hidden"); $("chat-input").focus();
  }
  if (pinBtn) {
    const id = Number(pinBtn.dataset.pin), pinned = pinBtn.dataset.pinned === "true";
    const card = pinBtn.closest("[data-message-card]");
    const ownerId = card?.dataset.sender;
    if (state.role !== "owner" && ownerId && ownerId !== state.user.id) return toast("You can pin only your own messages.", true);
    const { error } = await db.from("messages").update({ is_pinned:!pinned, pinned_at:!pinned ? new Date().toISOString() : null, pinned_by:!pinned ? state.user.id : null }).eq("id", id);
    if (error) toast(error.message, true); else loadMessages();
  }
  if (reactBtn) {
    const id = Number(reactBtn.dataset.message), emoji = reactBtn.dataset.react;
    const { data: existing, error: findError } = await db.from("chat_reactions").select("id").eq("message_id", id).eq("user_id", state.user.id).eq("emoji", emoji).maybeSingle();
    if (findError) return toast(findError.message, true);
    const result = existing
      ? await db.from("chat_reactions").delete().eq("id", existing.id)
      : await db.from("chat_reactions").insert({ message_id:id, user_id:state.user.id, emoji });
    if (result.error) toast(result.error.message, true); else loadMessages();
  }
}

/* PERSONAL FILES */
async function loadFiles() {
  const box = $("my-files"); box.innerHTML = '<div class="empty-state">Loading your files…</div>';
  const { data, error } = await db.storage.from("member-files").list(state.user.id, { limit:100, sortBy:{ column:"created_at", order:"desc" } });
  if (error) { box.innerHTML = `<div class="empty-state">${safeText(error.message)}</div>`; return; }
  const files = (data || []).filter(f => f.name && !f.id?.endsWith("/"));
  const used = files.reduce((n,f) => n + (f.metadata?.size || 0), 0);
  const limit = Number(state.profile.storage_limit_bytes || 104857600);
  $("quota-text").textContent = `${bytes(used)} used of ${bytes(limit)} allowance`;
  $("quota-progress").style.width = `${Math.min(100, limit ? used / limit * 100 : 0)}%`;
  if (!files.length) { box.innerHTML = '<div class="empty-state">Your locker is empty. Upload your first file.</div>'; return; }
  box.innerHTML = files.map(f => `<div class="file-row"><div class="file-icon">📄</div><div class="file-info"><b>${safeText(f.name)}</b><small>${bytes(f.metadata?.size || 0)} · ${f.created_at ? niceDate(f.created_at) : "Stored in your locker"}</small></div><div class="file-actions"><button data-download="${safeText(f.name)}">Open</button><button data-delete="${safeText(f.name)}">Delete</button></div></div>`).join("");
}
async function uploadPersonalFile(file) {
  if (!hasPermission("upload_files")) return toast("File upload permission is disabled.", true);
  if (!file) return;
  const { data:existing, error:listError } = await db.storage.from("member-files").list(state.user.id, { limit:100 });
  if (listError) return toast(listError.message, true);
  const used = (existing || []).reduce((n,f) => n + (f.metadata?.size || 0), 0);
  const limit = Number(state.profile.storage_limit_bytes || 104857600);
  if (used + file.size > limit) return toast("Storage allowance exceeded. Contact the owner.", true);
  const safeName = file.name.replace(/[^\w.\-() ]/g, "_").slice(0,120), path = `${state.user.id}/${Date.now()}-${safeName}`;
  const { error } = await db.storage.from("member-files").upload(path, file, { upsert:false, contentType:file.type || "application/octet-stream" });
  if (error) toast(error.message, true); else { toast("File uploaded."); loadFiles(); }
  $("file-upload").value = "";
}
async function handleFileAction(e) {
  const dl = e.target.closest("[data-download]")?.dataset.download, del = e.target.closest("[data-delete]")?.dataset.delete;
  if (dl) {
    const { data,error } = await db.storage.from("member-files").createSignedUrl(`${state.user.id}/${dl}`, 60);
    if (error) toast(error.message,true); else window.open(data.signedUrl,"_blank","noopener");
  }
  if (del) {
    if (!confirm(`Delete ${del}?`)) return;
    const { error } = await db.storage.from("member-files").remove([`${state.user.id}/${del}`]);
    if (error) toast(error.message,true); else { toast("File deleted."); loadFiles(); }
  }
}

/* COMMON GALLERY — ACCEPT ANY FILE TYPE */
async function loadGallery() {
  const box = $("gallery-grid"); box.innerHTML = '<div class="empty-state">Loading gallery…</div>';
  const { data:profiles,error:pErr } = await db.from("profiles").select("id,display_name").eq("is_enabled",true);
  if (pErr) { box.innerHTML = `<div class="empty-state">${safeText(pErr.message)}</div>`; return; }
  const all = [];
  for (const p of profiles || []) {
    const { data, error } = await db.storage.from("common-gallery").list(p.id,{limit:100,sortBy:{column:"created_at",order:"desc"}});
    if (error) { console.warn(error.message); continue; }
    for (const f of data || []) {
      if (!f.name || f.name.startsWith(".") || f.id === null) continue;
      const path = `${p.id}/${f.name}`;
      const { data:signed } = await db.storage.from("common-gallery").createSignedUrl(path,3600);
      if (signed) all.push({ name:f.name,path,url:signed.signedUrl,owner:p.display_name,mime:f.metadata?.mimetype || f.metadata?.mimeType || "",size:f.metadata?.size || 0 });
    }
  }
  if (!all.length) { box.innerHTML = '<div class="empty-state">No shared files yet.</div>'; return; }
  box.innerHTML = all.map(f => {
    const mime = f.mime || "", ext = f.name.split(".").pop().toLowerCase();
    let preview = `<div class="gallery-file-preview"><span>📄</span><b>${safeText(f.name)}</b><a href="${f.url}" target="_blank" rel="noopener" download>Open / download</a></div>`;
    if (mime.startsWith("image/") || /^(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(ext)) preview = `<a href="${f.url}" target="_blank" rel="noopener"><img loading="lazy" src="${f.url}" alt="${safeText(f.name)}"></a>`;
    else if (mime.startsWith("video/") || /^(mp4|webm|mov|m4v|ogv)$/.test(ext)) preview = `<video controls preload="metadata" src="${f.url}"></video>`;
    else if (mime.startsWith("audio/") || /^(mp3|wav|ogg|m4a|aac|flac)$/.test(ext)) preview = `<div class="gallery-file-preview"><span>🎵</span><b>${safeText(f.name)}</b><audio controls src="${f.url}"></audio></div>`;
    return `<article class="gallery-item">${preview}<small>${safeText(f.owner)} · ${safeText(f.name)} · ${bytes(f.size)}</small></article>`;
  }).join("");
}
async function uploadGalleryFile(file) {
  if (!hasPermission("upload_gallery")) return toast("Gallery upload permission is disabled.",true);
  if (!file) return;
  const name = file.name.replace(/[^\w.\-() ]/g,"_").slice(0,120), path = `${state.user.id}/${Date.now()}-${name}`;
  const { error } = await db.storage.from("common-gallery").upload(path,file,{upsert:false,contentType:file.type || "application/octet-stream"});
  if (error) toast(error.message,true); else { toast("File shared to the gallery."); loadGallery(); }
  $("gallery-upload").value = "";
}

/* ATTENDANCE */
async function loadAttendance() {
  const today = todayIST(); $("attendance-today").textContent = `Today · ${today}`;
  const { data:mine,error:mineError } = await db.from("attendance").select("id,status,note").eq("member_id",state.user.id).eq("attendance_date",today).maybeSingle();
  if (mineError) { $("attendance-current").textContent = mineError.message; return; }
  $("attendance-current").textContent = mine ? `Your status today: ${mine.status.toUpperCase()}` : "You have not marked attendance today.";
  const { data,error } = await db.from("attendance").select("id,member_id,attendance_date,status,note,marked_at,profiles!attendance_member_id_fkey(display_name)").order("attendance_date",{ascending:false}).limit(100);
  const box = $("attendance-list");
  if (error) { box.innerHTML = `<div class="empty-state">${safeText(error.message)}</div>`; return; }
  if (!data?.length) { box.innerHTML = '<div class="empty-state">No attendance records yet.</div>'; return; }
  box.innerHTML = data.map(r => `<div class="attendance-row"><b>${safeText(r.profiles?.display_name || "Member")}</b><span>${safeText(r.attendance_date)}</span><span class="attendance-badge ${safeText(r.status)}">${safeText(r.status.toUpperCase())}</span><small>${safeText(r.note || "")}</small></div>`).join("");
}
async function markAttendance(status) {
  const note = $("attendance-note").value.trim();
  const payload = { member_id:state.user.id, attendance_date:todayIST(), status, note:note || null, marked_at:new Date().toISOString(), updated_at:new Date().toISOString() };
  const { error } = await db.from("attendance").upsert(payload,{onConflict:"member_id,attendance_date"});
  if (error) toast(error.message,true); else { toast(`Attendance marked ${status}.`); $("attendance-note").value = ""; loadAttendance(); }
}

/* CHAT RETENTION SETTINGS */
async function loadChatSettings() {
  if (state.role !== "owner") return;
  const status = $("chat-settings-status"), limitInput = $("retention-limit"), enabledInput = $("cleanup-enabled");
  status.textContent = "Loading settings…";
  const { data,error } = await db.from("chat_settings").select("retention_limit,cleanup_enabled").eq("id",true).single();
  if (error) { status.textContent = error.message; toast(error.message,true); return; }
  limitInput.value = data.retention_limit ?? 500; enabledInput.checked = data.cleanup_enabled === true;
  status.textContent = `Loaded. Current limit: ${data.retention_limit}.`;
}
async function saveChatSettings() {
  if (state.role !== "owner") return toast("Owner access only.",true);
  const limitInput = $("retention-limit"), enabledInput = $("cleanup-enabled"), btn = $("save-chat-settings"), status = $("chat-settings-status");
  const limit = Number(limitInput.value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) { status.textContent = "Enter a whole number between 1 and 10000."; return toast("Retention limit must be between 1 and 10000.",true); }
  btn.disabled = true; btn.textContent = "Saving…"; status.textContent = "Saving and verifying…";
  try {
    const { data,error } = await db.from("chat_settings").update({ retention_limit:limit, cleanup_enabled:enabledInput.checked, updated_at:new Date().toISOString(), updated_by:state.user.id }).eq("id",true).select("retention_limit,cleanup_enabled").single();
    if (error) throw error;
    if (!data) throw new Error("No settings row was updated. Check the owner update policy.");
    status.textContent = `Saved and verified · Keep ${data.retention_limit} messages · Cleanup ${data.cleanup_enabled ? "ON" : "OFF"}.`;
    toast("Chat settings saved and verified.");
  } catch (err) { status.textContent = err.message || "Could not save settings."; toast(err.message || "Could not save settings.",true); }
  finally { btn.disabled = false; btn.textContent = "Save settings"; }
}

/* OWNER / MEMBER MANAGEMENT */
async function invokeOwnerFunction(name,body) {
  const { data,error } = await db.functions.invoke(name,{body});
  if (error) throw error; if (data?.error) throw new Error(data.error); return data;
}
async function createMember(e) {
  e.preventDefault(); const btn = e.submitter; btn.disabled = true; btn.textContent = "Creating…";
  try {
    const result = await invokeOwnerFunction("admin-create-member",{display_name:$("new-name").value.trim(),email:$("new-email").value.trim(),password:$("new-password").value});
    toast(result.message || "Member created."); $("create-member-form").reset(); $("create-member-form").classList.add("hidden"); loadMembers();
  } catch (err) { toast(err.message || "Could not create member.",true); }
  btn.disabled = false; btn.textContent = "Create account";
}
async function loadMembers() {
  const box = $("members-list"); box.innerHTML = '<div class="empty-state">Loading members…</div>';
  const { data,error } = await db.from("profiles").select("id,display_name,role,is_enabled,permissions,storage_limit_bytes,created_at").order("created_at",{ascending:false});
  if (error) { box.innerHTML = `<div class="empty-state">${safeText(error.message)}</div>`; return; }
  const members = (data || []).filter(m => m.role === "member");
  if (!members.length) { box.innerHTML = '<div class="empty-state">No member accounts yet. Create your first member.</div>'; return; }
  box.innerHTML = members.map(m => `<article class="member-card glass" data-member="${m.id}"><div class="member-top"><div class="avatar">${initials(m.display_name)}</div><div class="member-detail"><b>${safeText(m.display_name)}</b><small>${m.id}</small></div><span class="member-status ${m.is_enabled ? "" : "off"}">${m.is_enabled ? "ACTIVE" : "DISABLED"}</span></div><div class="member-controls"><label class="permission"><input type="checkbox" data-enabled ${m.is_enabled ? "checked" : ""}>Account enabled</label>${PERMISSIONS.map(k => `<label class="permission"><input type="checkbox" data-permission="${k}" ${m.permissions?.[k] === true ? "checked" : ""}>${PERMISSION_LABELS[k]}</label>`).join("")}<label class="limit-control">Quota MB<input type="number" min="0" max="5120" step="1" data-quota value="${Math.round((m.storage_limit_bytes || 0)/1048576)}"></label><button class="save-member" data-save-member>Save changes</button></div></article>`).join("");
}
async function saveMember(e) {
  const btn = e.target.closest("[data-save-member]"); if (!btn) return;
  const card = btn.closest("[data-member]"), memberId = card.dataset.member, permissions = {};
  card.querySelectorAll("[data-permission]").forEach(i => permissions[i.dataset.permission] = i.checked);
  const quotaMb = Number(card.querySelector("[data-quota]").value);
  if (!Number.isFinite(quotaMb) || quotaMb < 0 || quotaMb > 5120) return toast("Quota must be between 0 and 5120 MB.",true);
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    await invokeOwnerFunction("admin-update-member",{member_id:memberId,is_enabled:card.querySelector("[data-enabled]").checked,permissions,storage_limit_bytes:Math.round(quotaMb*1048576)});
    toast("Member settings updated."); loadMembers();
  } catch (err) { toast(err.message || "Update failed.",true); }
  btn.disabled = false; btn.textContent = "Save changes";
}
async function signOut() {
  await stopPresence(); await db.auth.signOut(); state.user = null; state.profile = null; showView("landing"); toast("Signed out.");
}

/* EVENT WIRING */
$("open-login").addEventListener("click",() => showView("auth-view"));
$("back-home").addEventListener("click",() => showView("landing"));
document.querySelectorAll("[data-role]").forEach(b => b.addEventListener("click",() => {
  state.selectedLoginRole = b.dataset.role; document.querySelectorAll("[data-role]").forEach(x => x.classList.toggle("active",x === b));
}));
$("login-form").addEventListener("submit",login); $("logout").addEventListener("click",signOut);
document.querySelectorAll("[data-panel]").forEach(b => b.addEventListener("click",() => setPanel(b.dataset.panel)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click",() => setPanel(b.dataset.go)));
$("chat-form").addEventListener("submit",sendMessage); $("chat-messages").addEventListener("click",handleChatAction);
$("chat-input").addEventListener("input",updateMentionSuggestions);
$("mention-suggestions").addEventListener("click",chooseMention);
$("chat-file-input").addEventListener("change",e => uploadChatAttachment(e.target.files[0]));
$("cancel-reply").addEventListener("click",clearReply);
$("file-upload").addEventListener("change",e => uploadPersonalFile(e.target.files[0])); $("my-files").addEventListener("click",handleFileAction);
$("gallery-upload").addEventListener("change",e => uploadGalleryFile(e.target.files[0]));
$("show-create-member").addEventListener("click",() => $("create-member-form").classList.remove("hidden"));
$("hide-create-member").addEventListener("click",() => $("create-member-form").classList.add("hidden"));
$("create-member-form").addEventListener("submit",createMember); $("members-list").addEventListener("click",saveMember);
$("save-chat-settings").addEventListener("click",saveChatSettings);
$("mobile-menu").addEventListener("click",() => $("sidebar").classList.toggle("open"));
$("attendance-actions").addEventListener("click",e => { const b = e.target.closest("[data-attendance]"); if (b) markAttendance(b.dataset.attendance); });

/* SESSION RESTORE */
db.auth.onAuthStateChange((event,session) => {
  if (event === "SIGNED_IN" && session?.user && !state.user) enterApp(session.user);
  if (event === "SIGNED_OUT") { state.user = null; state.profile = null; stopPresence(); }
});
(async () => { const { data:{session} } = await db.auth.getSession(); if (session?.user) await enterApp(session.user); })();

/* PARTICLE BACKGROUND */
(() => {
  const canvas = $("particles"); if (!canvas) return; const ctx = canvas.getContext("2d");
  let w,h,points=[];
  const resize = () => { w=canvas.width=innerWidth; h=canvas.height=innerHeight; points=Array.from({length:Math.min(65,Math.floor(w/22))},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.22,vy:(Math.random()-.5)*.22,r:Math.random()*1.5+.4})); };
  resize(); addEventListener("resize",resize); let mouse={x:-1000,y:-1000};
  addEventListener("mousemove",e=>{mouse.x=e.clientX;mouse.y=e.clientY;});
  function draw(){ctx.clearRect(0,0,w,h);for(let i=0;i<points.length;i++){const p=points[i];p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;const dx=p.x-mouse.x,dy=p.y-mouse.y,d=Math.hypot(dx,dy);if(d<130&&d>0){p.x+=dx/d*.12;p.y+=dy/d*.12;}ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle="#829aff";ctx.fill();for(let j=i+1;j<points.length;j++){const q=points[j],dist=Math.hypot(p.x-q.x,p.y-q.y);if(dist<105){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=`rgba(113,137,255,${(1-dist/105)*.12})`;ctx.stroke();}}}requestAnimationFrame(draw);}
  draw();
})();
