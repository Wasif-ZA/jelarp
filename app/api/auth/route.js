import { ActionError } from "@/lib/reduce";
import { DEMO, endSession, fail, mutate, session, startSession } from "@/lib/server";

const CLIENT_ID = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID;

async function twitchLogin(token) {
  const res = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${token}` },
    cache: "no-store",
  });
  const info = res.ok ? await res.json() : null;
  return info?.client_id === CLIENT_ID && info.login ? { login: info.login.toLowerCase(), twitchId: String(info.user_id || "") } : null;
}

export async function POST(req) {
  try {
    if (!req.headers.get("content-type")?.includes("application/json")) throw new ActionError(415, "Send JSON.");
    const body = await req.json().catch(() => ({}));
    let who = null;
    if (CLIENT_ID && typeof body.token === "string") {
      who = await twitchLogin(body.token);
    } else if (!CLIENT_ID && DEMO && typeof body.login === "string") {
      const login = body.login.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 25);
      who = login ? { login, twitchId: `demo-${login}` } : null;
    }
    if (!who) throw new ActionError(401, "Twitch sign-in failed.");

    /* The sign-in is recorded before the cookie is written, because the cookie has
       to carry the sign-out counter that every later request is checked against.
       This is also where a handle that has changed owners gets turned away: the
       document still holds the numeric id it used to belong to. */
    let result;
    try {
      result = await mutate({ type: "seen" }, who.login, { twitchId: who.twitchId, fresh: true });
    } catch (error) {
      if (error instanceof ActionError && error.status === 401) {
        throw new ActionError(403, "That Twitch name belonged to a different account here. Ask Orchi to clear it before signing in.");
      }
      throw error;
    }

    await startSession(who.login, who.twitchId, result.epoch);
    return Response.json(result.view);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE() {
  try {
    const who = await session();
    // Deleting the cookie only clears this browser. Bumping the counter is what
    // makes every copy of it that went anywhere else stop working too.
    if (who?.login) {
      await mutate({ type: "signOut" }, who.login, { twitchId: who.twitchId, epoch: who.epoch });
    }
  } catch {
    // A failed bump must not leave the person unable to sign out of their own browser.
  }
  await endSession();
  return Response.json({ ok: true });
}
