/* AADARSH HUB — SUPABASE CONNECTION */

const SUPABASE_URL = "https://atygompuhmarfdorifph.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_87rKjM0eqZiZlm-gIGRyGg_zd7h_Bgi";

const { createClient } = window.supabase;

const db = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

const $ = id => document.getElementById(id);

const state = {
  user: null,
  profile: null,
  role: "member",
  panel: "overview",
  messagesChannel: null,
  presenceChannel: null,
  online: new Set(),
  selectedLoginRole: "member"
};

const PERMISSIONS = [
  "chat",
  "upload_files",
  "view_gallery",
  "upload_gallery",
  "change_theme"
];

const PERMISSION_LABELS = {
  chat: "Group chat",
  upload_files: "Upload files",
  view_gallery: "View gallery",
  upload_gallery: "Upload gallery",
  change_theme: "Change theme"
};

let toastTimer;


/* GENERAL HELPERS */

function toast(message, error = false) {
  const el = $("toast");

  el.textContent = message;
  el.style.borderColor = error ? "#ff7b8b66" : "#7489ff55";

  el.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 3200);
}

function showView(view) {
  ["landing", "auth-view", "app-view"].forEach(id => {
    $(id).classList.toggle("hidden", id !== view);
  });
}

function initials(name = "A") {
  return name.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(x => x[0])
    .join("")
    .toUpperCase() || "A";
}

function bytes(n) {
  if (!n) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let i = 0;

  while (n >= 1024 && i < 3) {
    n /= 1024;
    i++;
  }

  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function safeText(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function niceDate(s) {
  return new Date(s).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function hasPermission(key) {
  return state.role === "owner" ||
    state.profile?.permissions?.[key] === true;
}

function setOnlineCount() {
  const n = Math.max(state.online.size, 1);

  $("online-count").textContent = `${n} online`;
  $("stat-online").textContent = n;
}


/* NAVIGATION */

function setPanel(name) {

  if (name === "chat" && !hasPermission("chat")) {
    return toast("Chat access is disabled for this account.", true);
  }

  if (name === "gallery" && !hasPermission("view_gallery")) {
    return toast("Gallery access is disabled for this account.", true);
  }

  if (name === "chat-settings" && state.role !== "owner") {
    return toast("Owner access only.", true);
  }

  state.panel = name;

  document.querySelectorAll(".panel").forEach(p => {
    p.classList.add("hidden");
  });

  $(`panel-${name}`).classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.panel === name);
  });

  const titles = {
    overview: "Your space.",
    chat: "Group conversation.",
    files: "Your personal locker.",
    gallery: "Shared memories.",
    members: "Member control.",
    "chat-settings": "Chat settings."
  };

  $("page-title").textContent = titles[name];
  $("current-crumb").textContent = name.toUpperCase();

  $("sidebar").classList.remove("open");

  if (name === "chat") loadMessages();
  if (name === "files") loadFiles();
  if (name === "gallery") loadGallery();

  if (name === "chat-settings" && state.role === "owner") {
    loadChatSettings();
  }

  if (name === "members" && state.role === "owner") {
    loadMembers();
  }
}


/* AUTHENTICATION */

async function loadProfile(user) {

  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;

  if (!data.is_enabled) {
    await db.auth.signOut();

    throw new Error(
      "This account is disabled. Contact the Hub owner."
    );
  }

  state.user = user;
  state.profile = data;
  state.role = data.role;
}

async function enterApp(user) {

  try {

    await loadProfile(user);

    const name =
      state.profile.display_name ||
      user.email?.split("@")[0] ||
      "Member";

    $("side-name").textContent = name;
    $("side-role").textContent = state.role.toUpperCase();

    $("side-avatar").textContent = initials(name);
    $("header-avatar").textContent = initials(name);
    $("welcome-name").textContent = name;

    $("stat-role").textContent = state.role.toUpperCase();

    $("owner-nav").classList.toggle(
      "hidden",
      state.role !== "owner"
    );

    $("gallery-upload-wrap").classList.toggle(
      "hidden",
      !hasPermission("upload_gallery")
    );

    document.querySelector('[data-panel="chat"]')
      .classList.toggle("hidden", !hasPermission("chat"));

    document.querySelector('[data-panel="gallery"]')
      .classList.toggle("hidden", !hasPermission("view_gallery"));

    $("stat-storage").textContent =
      bytes(state.profile.storage_limit_bytes || 0);

    $("storage-sub").textContent = "Storage allowance";

    showView("app-view");

    setPanel("overview");

    startPresence();

  } catch (e) {

    toast(e.message || "Could not load your profile.", true);
    showView("auth-view");

  }
}

async function login(e) {

  e.preventDefault();

  const email = $("login-email").value.trim();
  const password = $("login-password").value;

  const btn = e.submitter;

  btn.disabled = true;
  btn.textContent = "Signing in…";

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  btn.disabled = false;
  btn.innerHTML = 'Sign in <span>?</span>';

  if (error) {
    return toast(error.message, true);
  }

  try {

    await loadProfile(data.user);

    if (state.selectedLoginRole !== state.profile.role) {

      await db.auth.signOut();

      return toast(
        "This account does not have that login role.",
        true
      );
    }

    await enterApp(data.user);

  } catch (err) {

    await db.auth.signOut();
    toast(err.message, true);

  }
}


/* ONLINE PRESENCE */

async function startPresence() {

  if (state.presenceChannel) {
    await db.removeChannel(state.presenceChannel);
  }

  state.online = new Set([state.user.id]);

  state.presenceChannel = db.channel("hub-presence", {
    config: {
      presence: {
        key: state.user.id
      }
    }
  });

  state.presenceChannel.on(
    "presence",
    { event: "sync" },
    () => {

      const p = state.presenceChannel.presenceState();

      state.online = new Set(Object.keys(p));

      setOnlineCount();
    }
  );

  state.presenceChannel.subscribe(async status => {

    if (status === "SUBSCRIBED") {

      await state.presenceChannel.track({
        display_name: state.profile.display_name,
        online_at: new Date().toISOString()
      });

    }

  });

  setOnlineCount();
}

async function stopPresence() {

  if (state.presenceChannel) {

    await db.removeChannel(state.presenceChannel);
    state.presenceChannel = null;

  }

  if (state.messagesChannel) {

    await db.removeChannel(state.messagesChannel);
    state.messagesChannel = null;

  }
}


/* GROUP CHAT */

function renderMessage(m) {

  const mine = m.sender_id === state.user.id;

  const sender =
    m.profiles?.display_name ||
    (mine ? state.profile.display_name : "Member");

  return `
    <article class="message ${mine ? "mine" : ""}">

      <div class="message-meta">
        ${safeText(sender)}
      </div>

      <div class="message-bubble">
        ${safeText(m.content)}
      </div>

      <div class="message-time">
        ${niceDate(m.created_at)}
      </div>

    </article>
  `;
}

async function loadMessages() {

  if (!hasPermission("chat")) return;

  const box = $("chat-messages");

  box.innerHTML =
    '<div class="empty-state">Loading conversation…</div>';

  const { data, error } = await db
    .from("messages")
    .select("id,sender_id,content,created_at,profiles!messages_sender_id_fkey(display_name)")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {

    box.innerHTML =
      `<div class="empty-state">${safeText(error.message)}</div>`;

    return;
  }

  box.innerHTML = data.length
    ? data.map(renderMessage).join("")
    : '<div class="empty-state">No messages yet. Start the conversation.</div>';

  box.scrollTop = box.scrollHeight;

  if (state.messagesChannel) {
    await db.removeChannel(state.messagesChannel);
  }

  state.messagesChannel = db
    .channel("hub-messages")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages"
      },
      async payload => {

        const { data: row } = await db
          .from("messages")
          .select("id,sender_id,content,created_at,profiles!messages_sender_id_fkey(display_name)")
          .eq("id", payload.new.id)
          .single();

        if (row) {

          const empty = box.querySelector(".empty-state");

          if (empty) empty.remove();

          box.insertAdjacentHTML(
            "beforeend",
            renderMessage(row)
          );

          box.scrollTop = box.scrollHeight;
        }

      }
    )
    .subscribe();
}

async function sendMessage(e) {

  e.preventDefault();

  if (!hasPermission("chat")) {
    return toast("Chat permission is disabled.", true);
  }

  const input = $("chat-input");
  const content = input.value.trim();

  if (!content) return;

  input.disabled = true;

  const { error } = await db
    .from("messages")
    .insert({
      sender_id: state.user.id,
      content
    });

  input.disabled = false;

  if (error) {
    toast(error.message, true);
  } else {
    input.value = "";
  }
}


/* PERSONAL FILE STORAGE */

async function loadFiles() {

  const box = $("my-files");

  box.innerHTML =
    '<div class="empty-state">Loading your files…</div>';

  const { data, error } = await db
    .storage
    .from("member-files")
    .list(state.user.id, {
      limit: 100,
      sortBy: {
        column: "created_at",
        order: "desc"
      }
    });

  if (error) {

    box.innerHTML =
      `<div class="empty-state">${safeText(error.message)}</div>`;

    return;
  }

  const files = (data || []).filter(f => f.name && !f.id?.endsWith("/"));

  const used = files.reduce(
    (n, f) => n + (f.metadata?.size || 0),
    0
  );

  const limit = Number(
    state.profile.storage_limit_bytes || 104857600
  );

  $("quota-text").textContent =
    `${bytes(used)} used of ${bytes(limit)} allowance`;

  $("quota-progress").style.width =
    `${Math.min(100, limit ? used / limit * 100 : 0)}%`;

  if (!files.length) {

    box.innerHTML =
      '<div class="empty-state">Your locker is empty. Upload your first file.</div>';

    return;
  }

  box.innerHTML = files.map(f => `

    <div class="file-row">

      <div class="file-icon">?</div>

      <div class="file-info">
        <b>${safeText(f.name)}</b>
        <small>
          ${bytes(f.metadata?.size || 0)}
          · ${f.created_at ? niceDate(f.created_at) : "Stored in your locker"}
        </small>
      </div>

      <div class="file-actions">
        <button data-download="${safeText(f.name)}">Open</button>
        <button data-delete="${safeText(f.name)}">Delete</button>
      </div>

    </div>

  `).join("");
}

async function uploadPersonalFile(file) {

  if (!hasPermission("upload_files")) {
    return toast("File upload permission is disabled.", true);
  }

  if (!file) return;

  const { data: existing, error: listError } = await db
    .storage
    .from("member-files")
    .list(state.user.id, { limit: 100 });

  if (listError) {
    return toast(listError.message, true);
  }

  const used = (existing || []).reduce(
    (n, f) => n + (f.metadata?.size || 0),
    0
  );

  const limit = Number(
    state.profile.storage_limit_bytes || 104857600
  );

  if (used + file.size > limit) {
    return toast(
      "Storage allowance exceeded. Contact the owner.",
      true
    );
  }

  const safeName = file.name
    .replace(/[^\w.\-() ]/g, "_")
    .slice(0, 120);

  const path =
    `${state.user.id}/${Date.now()}-${safeName}`;

  const { error } = await db
    .storage
    .from("member-files")
    .upload(path, file, {
      upsert: false
    });

  if (error) {
    toast(error.message, true);
  } else {
    toast("File uploaded.");
    loadFiles();
  }

  $("file-upload").value = "";
}

async function handleFileAction(e) {

  const dl = e.target.closest("[data-download]")?.dataset.download;
  const del = e.target.closest("[data-delete]")?.dataset.delete;

  if (dl) {

    const { data, error } = await db
      .storage
      .from("member-files")
      .createSignedUrl(
        `${state.user.id}/${dl}`,
        60
      );

    if (error) {
      toast(error.message, true);
    } else {
      window.open(data.signedUrl, "_blank", "noopener");
    }

  }

  if (del) {

    if (!confirm(`Delete ${del}?`)) return;

    const { error } = await db
      .storage
      .from("member-files")
      .remove([
        `${state.user.id}/${del}`
      ]);

    if (error) {
      toast(error.message, true);
    } else {
      toast("File deleted.");
      loadFiles();
    }

  }
}


/* COMMON GALLERY */

async function loadGallery() {

  const box = $("gallery-grid");

  box.innerHTML =
    '<div class="empty-state">Loading gallery…</div>';

  const { data: profiles, error: pErr } = await db
    .from("profiles")
    .select("id,display_name")
    .eq("is_enabled", true);

  if (pErr) {

    box.innerHTML =
      `<div class="empty-state">${safeText(pErr.message)}</div>`;

    return;
  }

  const all = [];

  for (const p of profiles || []) {

    const { data } = await db
      .storage
      .from("common-gallery")
      .list(p.id, {
        limit: 100,
        sortBy: {
          column: "created_at",
          order: "desc"
        }
      });

    for (const f of data || []) {

      if (!f.name) continue;

      const path = `${p.id}/${f.name}`;

      const { data: signed } = await db
        .storage
        .from("common-gallery")
        .createSignedUrl(path, 3600);

      if (signed) {

        all.push({
          name: f.name,
          path,
          url: signed.signedUrl,
          owner: p.display_name
        });

      }
    }
  }

  if (!all.length) {

    box.innerHTML =
      '<div class="empty-state">No shared media yet.</div>';

    return;
  }

  box.innerHTML = all.map(f => {

    const video = /\.(mp4|webm|mov)$/i.test(f.name);

    return `
      <article class="gallery-item">

        ${
          video
          ? `<video controls src="${f.url}"></video>`
          : `
            <a href="${f.url}" target="_blank" rel="noopener">
              <img loading="lazy" src="${f.url}" alt="${safeText(f.name)}">
            </a>
          `
        }

        <small>
          ${safeText(f.owner)} · ${safeText(f.name)}
        </small>

      </article>
    `;

  }).join("");
}

async function uploadGalleryFile(file) {

  if (!hasPermission("upload_gallery")) {
    return toast("Gallery upload permission is disabled.", true);
  }

  if (!file) return;

  if (
    !file.type.startsWith("image/") &&
    !file.type.startsWith("video/")
  ) {
    return toast("Only images and videos are allowed.", true);
  }

  const name = file.name
    .replace(/[^\w.\-() ]/g, "_")
    .slice(0, 120);

  const path =
    `${state.user.id}/${Date.now()}-${name}`;

  const { error } = await db
    .storage
    .from("common-gallery")
    .upload(path, file, {
      upsert: false
    });

  if (error) {
    toast(error.message, true);
  } else {
    toast("Shared to the gallery.");
    loadGallery();
  }

  $("gallery-upload").value = "";
}


/* CHAT RETENTION SETTINGS — OWNER ONLY */

async function loadChatSettings() {

  if (state.role !== "owner") return;

  const status = $("chat-settings-status");
  const limitInput = $("retention-limit");
  const enabledInput = $("cleanup-enabled");

  if (!status || !limitInput || !enabledInput) return;

  status.textContent = "Loading settings…";

  const { data, error } = await db
    .from("chat_settings")
    .select("retention_limit, cleanup_enabled")
    .eq("id", true)
    .single();

  if (error) {
    status.textContent = error.message;
    toast(error.message, true);
    return;
  }

  limitInput.value = data.retention_limit ?? 500;
  enabledInput.checked = data.cleanup_enabled === true;

  status.textContent = "Settings loaded.";
}

async function saveChatSettings() {

  if (state.role !== "owner") {
    return toast("Owner access only.", true);
  }

  const limitInput = $("retention-limit");
  const enabledInput = $("cleanup-enabled");
  const btn = $("save-chat-settings");
  const status = $("chat-settings-status");

  const limit = Number(limitInput.value);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100000) {
    status.textContent = "Enter a whole number between 1 and 100000.";
    return toast("Retention limit must be between 1 and 100000.", true);
  }

  const enabled = enabledInput.checked;

  btn.disabled = true;
  btn.textContent = "Saving…";
  status.textContent = "Saving settings…";

  try {

    const { error } = await db
      .from("chat_settings")
      .update({
        retention_limit: limit,
        cleanup_enabled: enabled,
        updated_at: new Date().toISOString(),
        updated_by: state.user.id
      })
      .eq("id", true);

    if (error) throw error;

    toast("Chat settings saved.");

    status.textContent = enabled
      ? "Saved. Automatic cleanup is enabled."
      : "Saved. Automatic cleanup is disabled.";

    await loadChatSettings();

  } catch (err) {

    status.textContent = err.message || "Could not save settings.";
    toast(err.message || "Could not save chat settings.", true);

  } finally {

    btn.disabled = false;
    btn.textContent = "Save settings";

  }
}


/* OWNER FUNCTIONS */

async function invokeOwnerFunction(name, body) {

  const { data, error } = await db.functions.invoke(
    name,
    { body }
  );

  if (error) throw error;

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

async function createMember(e) {

  e.preventDefault();

  const btn = e.submitter;

  btn.disabled = true;
  btn.textContent = "Creating…";

  try {

    const result = await invokeOwnerFunction(
      "admin-create-member",
      {
        display_name: $("new-name").value.trim(),
        email: $("new-email").value.trim(),
        password: $("new-password").value
      }
    );

    toast(result.message || "Member created.");

    $("create-member-form").reset();

    $("create-member-form").classList.add("hidden");

    loadMembers();

  } catch (err) {

    toast(err.message || "Could not create member.", true);

  }

  btn.disabled = false;
  btn.textContent = "Create account";
}


/* MEMBER MANAGEMENT */

async function loadMembers() {

  const box = $("members-list");

  box.innerHTML =
    '<div class="empty-state">Loading members…</div>';

  const { data, error } = await db
    .from("profiles")
    .select(
      "id,display_name,role,is_enabled,permissions,storage_limit_bytes,created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {

    box.innerHTML =
      `<div class="empty-state">${safeText(error.message)}</div>`;

    return;
  }

  const members = (data || []).filter(
    m => m.role === "member"
  );

  if (!members.length) {

    box.innerHTML =
      '<div class="empty-state">No member accounts yet. Create your first member.</div>';

    return;
  }

  box.innerHTML = members.map(m => `

    <article class="member-card glass" data-member="${m.id}">

      <div class="member-top">

        <div class="avatar">
          ${initials(m.display_name)}
        </div>

        <div class="member-detail">
          <b>${safeText(m.display_name)}</b>
          <small>${m.id}</small>
        </div>

        <span class="member-status ${m.is_enabled ? "" : "off"}">
          ${m.is_enabled ? "ACTIVE" : "DISABLED"}
        </span>

      </div>

      <div class="member-controls">

        <label class="permission">
          <input type="checkbox" data-enabled
            ${m.is_enabled ? "checked" : ""}>
          Account enabled
        </label>

        ${PERMISSIONS.map(k => `
          <label class="permission">
            <input type="checkbox"
              data-permission="${k}"
              ${m.permissions?.[k] === true ? "checked" : ""}>
            ${PERMISSION_LABELS[k]}
          </label>
        `).join("")}

        <label class="limit-control">
          Quota MB
          <input type="number" min="0" max="5120"
            step="1" data-quota
            value="${Math.round((m.storage_limit_bytes || 0) / 1048576)}">
        </label>

        <button class="save-member" data-save-member>
          Save changes
        </button>

      </div>

    </article>

  `).join("");
}

async function saveMember(e) {

  const btn = e.target.closest("[data-save-member]");

  if (!btn) return;

  const card = btn.closest("[data-member]");

  const memberId = card.dataset.member;

  const permissions = {};

  card.querySelectorAll("[data-permission]").forEach(i => {
    permissions[i.dataset.permission] = i.checked;
  });

  const quotaMb = Number(
    card.querySelector("[data-quota]").value
  );

  if (
    !Number.isFinite(quotaMb) ||
    quotaMb < 0 ||
    quotaMb > 5120
  ) {
    return toast(
      "Quota must be between 0 and 5120 MB.",
      true
    );
  }

  btn.disabled = true;
  btn.textContent = "Saving…";

  try {

    await invokeOwnerFunction(
      "admin-update-member",
      {
        member_id: memberId,

        is_enabled:
          card.querySelector("[data-enabled]").checked,

        permissions,

        storage_limit_bytes:
          Math.round(quotaMb * 1048576)
      }
    );

    toast("Member settings updated.");

    loadMembers();

  } catch (err) {

    toast(err.message || "Update failed.", true);

  }

  btn.disabled = false;
  btn.textContent = "Save changes";
}


/* LOGOUT */

async function signOut() {

  await stopPresence();

  await db.auth.signOut();

  state.user = null;
  state.profile = null;

  showView("landing");

  toast("Signed out.");
}


/* EVENT LISTENERS */

$("open-login").addEventListener("click", () => {
  showView("auth-view");
});

$("back-home").addEventListener("click", () => {
  showView("landing");
});

document.querySelectorAll("[data-role]").forEach(b => {

  b.addEventListener("click", () => {

    state.selectedLoginRole = b.dataset.role;

    document.querySelectorAll("[data-role]").forEach(x => {
      x.classList.toggle("active", x === b);
    });

  });

});

$("login-form").addEventListener("submit", login);

$("logout").addEventListener("click", signOut);

document.querySelectorAll("[data-panel]").forEach(b => {

  b.addEventListener("click", () => {
    setPanel(b.dataset.panel);
  });

});

document.querySelectorAll("[data-go]").forEach(b => {

  b.addEventListener("click", () => {
    setPanel(b.dataset.go);
  });

});

$("chat-form").addEventListener("submit", sendMessage);

$("file-upload").addEventListener("change", e => {
  uploadPersonalFile(e.target.files[0]);
});

$("my-files").addEventListener("click", handleFileAction);

$("gallery-upload").addEventListener("change", e => {
  uploadGalleryFile(e.target.files[0]);
});

$("show-create-member").addEventListener("click", () => {
  $("create-member-form").classList.remove("hidden");
});

$("hide-create-member").addEventListener("click", () => {
  $("create-member-form").classList.add("hidden");
});

$("create-member-form").addEventListener("submit", createMember);

$("members-list").addEventListener("click", saveMember);

$("save-chat-settings").addEventListener("click", saveChatSettings);

$("mobile-menu").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});


/* SESSION RESTORE */

db.auth.onAuthStateChange((event, session) => {

  if (event === "SIGNED_IN" && session?.user && !state.user) {
    enterApp(session.user);
  }

  if (event === "SIGNED_OUT") {

    state.user = null;
    state.profile = null;

    stopPresence();
  }

});

(async () => {

  const { data: { session } } = await db.auth.getSession();

  if (session?.user) {
    await enterApp(session.user);
  }

})();


/* ANIMATED PARTICLE BACKGROUND */

(() => {

  const canvas = $("particles");
  const ctx = canvas.getContext("2d");

  let w, h, points = [];

  const resize = () => {

    w = canvas.width = innerWidth;
    h = canvas.height = innerHeight;

    points = Array.from(
      { length: Math.min(65, Math.floor(w / 22)) },
      () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - .5) * .22,
        vy: (Math.random() - .5) * .22,
        r: Math.random() * 1.5 + .4
      })
    );

  };

  resize();

  addEventListener("resize", resize);

  let mouse = {
    x: -1000,
    y: -1000
  };

  addEventListener("mousemove", e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  function draw() {

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < points.length; i++) {

      const p = points[i];

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const d = Math.hypot(dx, dy);

      if (d < 130 && d > 0) {
        p.x += dx / d * .12;
        p.y += dy / d * .12;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "#829aff";
      ctx.fill();

      for (let j = i + 1; j < points.length; j++) {

        const q = points[j];

        const dist = Math.hypot(
          p.x - q.x,
          p.y - q.y
        );

        if (dist < 105) {

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);

          ctx.strokeStyle =
            `rgba(113,137,255,${(1 - dist / 105) * .12})`;

          ctx.stroke();
        }

      }

    }

    requestAnimationFrame(draw);
  }

  draw();

})();
