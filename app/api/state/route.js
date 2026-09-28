import { read } from "@/lib/db";
import { publicView } from "@/lib/reduce";
import { fail, roleOf, session, stillValid } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [{ doc, version }, who] = await Promise.all([read(), session()]);
    // Reading is where the privileged view lives, so a withdrawn cookie has to be
    // turned away here and not only on the actions.
    const login = stillValid(doc, who) ? who.login : null;
    return Response.json(publicView(doc, version, login, roleOf(login, doc)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}
