import { blank } from "./reduce.js";
import { seed } from "./seed.js";

const KEY = process.env.SUPABASE_SERVICE_KEY;
// Both or neither. A URL with no key is not a half-connected site, it is a 401 on every request,
// and pasting the URL first is the natural order while setting this up.
const BASE = KEY ? process.env.SUPABASE_URL?.replace(/\/$/, "") : "";
const ROW = `${BASE}/rest/v1/jelarp_state?id=eq.1`;

// ponytail: one JSON row guarded by a version number; move votes into their own table if write conflicts pile up.
const memory = (globalThis.__jelarpDemo ??= { version: 0, doc: { ...blank(), ...seed() } });

function headers(extra) {
  // Both header forms, because legacy service_role keys are JWTs and the new ones are sb_secret_.
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, ...extra };
}

function local() {
  if (process.env.NODE_ENV === "production") throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in production.");
  return memory;
}

export async function read() {
  if (!BASE) {
    const m = local();
    return { version: m.version, doc: structuredClone(m.doc) };
  }
  const res = await fetch(`${ROW}&select=version,doc`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Database read failed: ${res.status}`);
  const [row] = await res.json();
  if (!row) throw new Error("jelarp_state returned no rows. Either db/schema.sql has not been run, or the key is a publishable one, which RLS blocks: it answers 200 with an empty list rather than an error.");
  return { version: row.version, doc: { ...blank(), ...row.doc } };
}

export async function write(doc, version) {
  if (!BASE) {
    const m = local();
    if (m.version !== version) return false;
    m.doc = structuredClone(doc);
    m.version += 1;
    return true;
  }
  const res = await fetch(`${ROW}&version=eq.${version}`, {
    method: "PATCH",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({ doc, version: version + 1 }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Database write failed: ${res.status}`);
  return (await res.json()).length === 1;
}
