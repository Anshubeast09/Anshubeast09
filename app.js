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
  if (mime.startsWith("image/")) return `<img data-lb src="${url}" alt="${esc(name)}" loading="lazy">`;
  if (mime.startsWith("video/")) return `<div class="vw"><video data-n="${esc(name)}" src="${url}" controls preload="metadata" playsinline></video><button type="button" class="vz" data-lbv aria-label="Open full screen">⤢</button></div>`;
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
$("#out").onclick = doSignOut;
async function doSignOut() {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  try { await Promise.race([pushDropDb(), wait(1500)]); } catch (_) {}
  try { await Promise.race([db.auth.signOut({ scope: "local" }), wait(3000)]); } catch (_) {}
  try { Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k)); } catch (_) {}
  location.reload();
}

async function boot(user, checkRole) {
  const { data: p, error } = await db.from("profiles").select("*").eq("id", user.id).single();
  if (error || !p) { await db.auth.signOut(); return toast("Profile not found."); }
  if (!p.is_enabled) { await db.auth.signOut(); return toast("This account is disabled."); }
  if (checkRole && p.role !== roleSel) { await db.auth.signOut(); return toast(`This account is a ${p.role}. Choose the ${p.role} tab.`); }
  me = p;
  applyTheme();
  $$(".own").forEach(x => x.classList.toggle("hide", me.role !== "owner"));
