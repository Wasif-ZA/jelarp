import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { read, write } from "./db.js";
import { ActionError, publicView, reduce, stillValid } from "./reduce.js";

const COOKIE = "jelarp_session";
const CREATORS = (process.env.CREATOR_LOGINS || "")
  .toLowerCase()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const DEMO = !(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) && process.env.NODE_ENV !== "production";

function secret() {
  const s = process.env.SESSION_SECRET || (DEMO && "dev-only-session-secret");
  if (!s) throw new Error("SESSION_SECRET must be set when Supabase is set up or in production.");
  return s;
}

const sign = (body) => createHmac("sha256", secret()).update(body).digest("base64url");

export async function session() {
  const token = (await cookies()).get(COOKIE)?.value;
  const [body, sig] = token?.split(".") ?? [];
  if (!body || !sig) return null;
  const given = Buffer.from(sig);
  const expected = Buffer.from(sign(body));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { login, id, ep, exp } = JSON.parse(Buffer.from(body, "base64url").toString());
    return exp > Date.now() ? { login, twitchId: id || "", epoch: ep || 0 } : null;
  } catch {
    return null;
  }
}

export const sessionLogin = async () => (await session())?.login ?? null;

export { stillValid };

// The numeric Twitch id rides along so a renamed handle cannot inherit the old account.
export async function startSession(login, twitchId = "", epoch = 0) {
  const body = Buffer.from(JSON.stringify({ login, id: twitchId, ep: epoch, exp: Date.now() + 30 * 864e5 })).toString("base64url");
  (await cookies()).set(COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export const roleOf = (login, doc) => (!login ? null : CREATORS.includes(login) ? "creator" : doc.mods.includes(login) ? "mod" : "viewer");

export async function mutate(action, login, meta = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { doc, version } = await read();
    // A cookie that no longer agrees with the document is nobody, so every action
    // behind need() answers 401 the same way it would for a signed-out visitor.
    const me = stillValid(doc, { login, twitchId: meta.twitchId, epoch: meta.epoch, fresh: meta.fresh }) ? login : null;
    const ctx = {
      me,
      role: roleOf(me, doc),
      now: new Date().toISOString(),
      random: () => randomInt(2 ** 32) / 2 ** 32,
      id: randomUUID,
      twitchId: meta.twitchId || "",
      notice: "",
    };
    const next = reduce(doc, action, ctx);
    if (await write(next, version)) {
      return {
        view: publicView(next, version + 1, me, roleOf(me, next)),
        notice: ctx.notice,
        epoch: next.accounts?.[me]?.epoch || 0,
      };
    }
    // Somebody else wrote first. Retrying in the same millisecond just loses the
    // same race again, so wait a little longer and by a different amount each time.
    await new Promise((r) => setTimeout(r, 25 * 2 ** attempt + Math.random() * 50));
  }
  throw new ActionError(503, "Busy right now. Try again.");
}

export function fail(error) {
  if (error instanceof ActionError) return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ error: "Something broke on the server." }, { status: 500 });
}
