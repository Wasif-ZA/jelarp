import { read } from "@/lib/db";
import { WEEKS, WEBHOOK_RE } from "@/lib/logic";
import { ActionError } from "@/lib/reduce";
import { fail, roleOf, sessionLogin } from "@/lib/server";

export async function POST(req) {
  try {
    const [{ doc }, login] = await Promise.all([read(), sessionLogin()]);
    if (roleOf(login, doc) !== "creator") throw new ActionError(403, "Creator only.");
    const c = doc.current;
    if (!c) throw new ActionError(409, "No LARP is running yet.");
    if (!WEBHOOK_RE.test(doc.settings.webhook)) throw new ActionError(400, "Add a Discord webhook URL in Settings first.");

    const file = (await req.formData()).get("file");
    if (!(file instanceof Blob) || file.size > 5_000_000) throw new ActionError(400, "Card image missing or too big.");

    const form = new FormData();
    const site = doc.settings.siteUrl ? `\n${doc.settings.siteUrl}` : "";
    form.append("payload_json", JSON.stringify({ content: `**${c.title}**: week ${c.week} of 4, ${WEEKS[c.week - 1].name}${site}` }));
    form.append("files[0]", file, "jelarp.png");
    const res = await fetch(doc.settings.webhook, { method: "POST", body: form });
    if (!res.ok) throw new ActionError(502, `Discord said ${res.status}. Download the card and post it by hand.`);
    return Response.json({ notice: "Posted to Discord." });
  } catch (error) {
    return fail(error);
  }
}
