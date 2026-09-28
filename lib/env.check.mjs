// Checks the live settings actually work, not just that they are filled in.
// node lib/env.check.mjs        reads .env.local
// node lib/env.check.mjs .env   reads another file

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const file = process.argv[2] || ".env.local";
const env = {};
try {
  for (const line of (await readFile(file, "utf8")).split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at > 0) {
      // vercel env pull writes KEY="value"; dotenv strips those quotes, so we must too.
      let v = line.slice(at + 1).trim();
      if (v.length > 1 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
        v = v.slice(1, -1);
      }
      env[line.slice(0, at).trim()] = v;
    }
  }
} catch {
  console.log(`Cannot read ${file}. Run this from clients/orchi/jelarp.`);
  process.exit(1);
}

let bad = 0;
const ok = (name, detail) => console.log(`  OK       ${name}${detail ? "   " + detail : ""}`);
const miss = (name, todo) => { bad++; console.log(`  MISSING  ${name}   ${todo}`); };
const broke = (name, why) => { bad++; console.log(`  BROKEN   ${name}   ${why}`); };

// A legacy anon key is a JWT whose payload says role anon. Same trap as the sb_publishable_ one.
function anonJwt(key) {
  const part = key.split(".")[1];
  if (!key.startsWith("eyJ") || !part) return false;
  try { return JSON.parse(Buffer.from(part, "base64url").toString()).role === "anon"; } catch { return false; }
}

const when = await stat(file).then((st) => st.mtime.toLocaleString(), () => "unknown");
console.log(`
Reading ${resolve(file)}
  last saved ${when}
`);

// --- the two you set yourself -------------------------------------------------
if (!env.CREATOR_LOGINS) miss("CREATOR_LOGINS", "Orchi's Twitch login, lowercase. Without it nobody can reach Studio.");
else if (env.CREATOR_LOGINS.toLowerCase() === "creator") broke("CREATOR_LOGINS", "still the demo placeholder. Live, this must be Orchi's real Twitch login or he cannot reach Studio.");
else if (env.CREATOR_LOGINS !== env.CREATOR_LOGINS.toLowerCase()) broke("CREATOR_LOGINS", "has capitals. Twitch logins are matched lowercase, so Studio will not open.");
else ok("CREATOR_LOGINS", `creator: ${env.CREATOR_LOGINS}`);

if (!env.SESSION_SECRET) miss("SESSION_SECRET", "any long random string. Sign-in cookies are signed with it.");
else if (env.SESSION_SECRET.length < 32) broke("SESSION_SECRET", `only ${env.SESSION_SECRET.length} characters, use at least 32.`);
else ok("SESSION_SECRET", `${env.SESSION_SECRET.length} characters`);

// --- Supabase ------------------------------------------------------------------
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
  if (!env.SUPABASE_URL) miss("SUPABASE_URL", "Supabase, Project Settings, Data API, Project URL.");
  if (!env.SUPABASE_SERVICE_KEY) miss("SUPABASE_SERVICE_KEY", "Supabase, Project Settings, API Keys, the secret one.");
  console.log("           Until both are set the site runs in demo mode and forgets everything on restart.");
} else if (env.SUPABASE_SERVICE_KEY.startsWith("sb_publishable_") || anonJwt(env.SUPABASE_SERVICE_KEY)) {
  // The dashboard's quickstart hands you the publishable key. jelarp_state has RLS on with no
  // policies, so that key can read nothing. Only the secret key bypasses it.
  broke("SUPABASE_SERVICE_KEY", "that is the publishable key. The table has RLS on with no policies, so it reads nothing.");
  console.log("           Use the secret key: Project Settings, API Keys, the one that starts sb_secret_ or eyJ.");
} else {
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  // Same two headers lib/db.js sends, so this tests the real path and not an approximation.
  const headers = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
  try {
    const res = await fetch(`${base}/rest/v1/jelarp_state?id=eq.1&select=version`, { headers });
    if (res.status === 401 || res.status === 403) broke("SUPABASE_SERVICE_KEY", "rejected. Use the service_role secret key, not the anon key.");
    else if (res.status === 404) broke("SUPABASE", "connected, but no jelarp_state table. Run db/schema.sql in the SQL Editor.");
    else if (!res.ok) broke("SUPABASE", `read failed with ${res.status}.`);
    else {
      const rows = await res.json();
      if (!rows.length) broke("SUPABASE", "table is there but row id=1 is missing. Re-run db/schema.sql.");
      else ok("SUPABASE", `row id=1 present, version ${rows[0].version}`);
    }
  } catch (e) {
    broke("SUPABASE_URL", `could not reach it. ${e.message}`);
  }
}

// --- Twitch --------------------------------------------------------------------
if (!env.NEXT_PUBLIC_TWITCH_CLIENT_ID) {
  miss("NEXT_PUBLIC_TWITCH_CLIENT_ID", "dev.twitch.tv/console/apps. Without it nobody can sign in.");
} else if (!env.TWITCH_CLIENT_SECRET) {
  ok("NEXT_PUBLIC_TWITCH_CLIENT_ID", "set");
  console.log("  WARN     TWITCH_CLIENT_SECRET   not set. Sign-in works, the live dots on the partner list stay off.");
} else {
  try {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    });
    if (res.ok) ok("TWITCH", "client id and secret both accepted");
    else broke("TWITCH", `rejected with ${res.status}. Check the id and secret are from the same app.`);
  } catch (e) {
    broke("TWITCH", `could not reach Twitch. ${e.message}`);
  }
}

// --- the switch that overrides everything ---------------------------------------
if (env.NEXT_PUBLIC_DEMO) {
  console.log("\n  NOTE     NEXT_PUBLIC_DEMO is set, so the site runs entirely in the visitor's browser");
  console.log("           and ignores everything above. Delete it to go live.");
}

console.log(bad === 0 ? "\nReady to go live.\n" : `\n${bad} thing${bad === 1 ? "" : "s"} to fix before going live.\n`);
