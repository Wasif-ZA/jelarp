import { read } from "@/lib/db";
import { helixReady, streamsByLogin, usersByLogin } from "@/lib/helix";
import { fail } from "@/lib/server";

export const dynamic = "force-dynamic";

// R-08 to R-11: the approved partners, live ones first, then alphabetical.
export async function GET() {
  try {
    const { doc } = await read();
    const logins = [...doc.partners].slice(0, 100);
    if (logins.length === 0) return Response.json({ ready: helixReady(), partners: [] });

    const fallback = logins.map((login) => ({ login, display: login, avatar: "", live: false, title: "" }));
    if (!helixReady()) return Response.json({ ready: false, partners: sort(fallback) });

    const [users, streams] = await Promise.all([usersByLogin(logins), streamsByLogin(logins)]);
    const byLogin = new Map(users.map((u) => [u.login, u]));
    const liveBy = new Map(streams.map((s) => [s.user_login, s]));
    const partners = logins.map((login) => {
      const user = byLogin.get(login);
      const stream = liveBy.get(login);
      return {
        login,
        display: user?.display_name || login,
        avatar: user?.profile_image_url || "",
        live: Boolean(stream),
        title: stream?.title || "",
      };
    });
    return Response.json({ ready: true, partners: sort(partners) });
  } catch (error) {
    return fail(error);
  }
}

const sort = (list) =>
  [...list].sort((a, b) => Number(b.live) - Number(a.live) || a.display.localeCompare(b.display, "en-AU", { sensitivity: "base" }));
