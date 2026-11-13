import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

// Everything risky happens inside the handler, so errors come back as readable JSON
// instead of a BOOT_ERROR.
// deno-lint-ignore no-explicit-any
let wp: any = null;
async function webpush() {
  if (wp) return wp;
  const miss = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"].filter((k) => !Deno.env.get(k));
  if (miss.length) throw new Error("Missing secrets: " + miss.join(", "));
  const lib = (await import("npm:web-push@3.6.7")).default;
  lib.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "https://anshubeast09.github.io/Anshubeast09/",
    Deno.env.get("VAPID_PUBLIC_KEY")!.trim(),
    Deno.env.get("VAPID_PRIVATE_KEY")!.trim(),
  );
  wp = lib;
  return wp;
}

Deno.serve(async (req) => {
  const ps = Deno.env.get("PUSH_SECRET");
  if (!ps) return j({ error: "PUSH_SECRET secret is not set" }, 500);
  if (req.headers.get("x-push-secret") !== ps.trim()) return j({ error: "forbidden" }, 403);
  try {
    const lib = await webpush();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { message_id } = await req.json();
    const { data: m } = await admin.from("messages").select("id,sender_id,content").eq("id", message_id).single();
    if (!m) return j({ sent: 0, note: "message not found" });
    const { data: people } = await admin.from("profiles").select("id,display_name,role,is_enabled,permissions");
    const sender = people?.find((p) => p.id === m.sender_id);
    const targets = (people ?? []).filter((p) => p.is_enabled && p.id !== m.sender_id && (p.role === "owner" || p.permissions?.chat === true));
    if (!targets.length) return j({ sent: 0, note: "no recipients" });
    const { data: subs } = await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth_key").in("user_id", targets.map((t) => t.id));
    if (!subs?.length) return j({ sent: 0, note: "recipients have no push subscription" });
    let sent = 0; const dead: string[] = []; const errs: unknown[] = [];
    await Promise.all(subs.map(async (s) => {
      const t = targets.find((x) => x.id === s.user_id)!;
      const ment = m.content.toLowerCase().includes("@" + t.display_name.replace(/\s+/g, "").toLowerCase());
      const name = sender?.display_name ?? "Someone";
      const payload = JSON.stringify({ title: ment ? `${name} mentioned you` : name, body: m.content.slice(0, 120), tag: "nx-" + m.id, url: "./" });
      try {
        await lib.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload, { TTL: 3600, urgency: "high" });
        sent++;
      // deno-lint-ignore no-explicit-any
      } catch (e: any) {
        if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.id);
        else errs.push({ status: e.statusCode, body: String(e.body ?? e.message).slice(0, 120) });
      }
    }));
    if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
    return j({ sent, removed: dead.length, errors: errs });
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});
