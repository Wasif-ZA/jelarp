import { ActionError } from "@/lib/reduce";
import { fail, mutate, session } from "@/lib/server";

export async function POST(req) {
  try {
    if (!req.headers.get("content-type")?.includes("application/json")) throw new ActionError(415, "Send JSON.");
    const action = await req.json().catch(() => null);
    if (!action || typeof action.type !== "string" || action.type === "seen" || action.type === "signOut") {
      throw new ActionError(400, "Unknown action.");
    }
    const who = await session();
    const { view, notice } = await mutate(action, who?.login ?? null, {
      twitchId: who?.twitchId || "",
      epoch: who?.epoch || 0,
    });
    return Response.json({ ...view, notice });
  } catch (error) {
    return fail(error);
  }
}
