import { ActionError, blank, publicView, reduce } from "./reduce.js";
import { secureRandom } from "./logic.js";
import { seed } from "./seed.js";

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
const KEY = "jelarp-demo-v1";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.doc) return saved;
  } catch {}
  return { version: 0, doc: { ...blank(), ...seed() }, me: null, role: null };
}

function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export function demoView() {
  const s = load();
  return publicView(s.doc, s.version, s.me, s.role);
}

export function demoAct(action) {
  const s = load();
  const ctx = { me: s.me, role: s.role, now: new Date().toISOString(), random: secureRandom, id: () => crypto.randomUUID(), notice: "" };
  const doc = reduce(structuredClone(s.doc), action, ctx);
  save({ ...s, doc, version: s.version + 1 });
  return { ...publicView(doc, s.version + 1, s.me, s.role), notice: ctx.notice };
}

export function demoSignIn(login, role) {
  const s = load();
  const name = String(login ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 25);
  if (!name) throw new ActionError(400, "Pick a name.");
  if (!s.doc.seen.includes(name)) s.doc.seen.push(name);
  save({ ...s, me: name, role: ["creator", "mod"].includes(role) ? role : "viewer" });
}

export const demoSignOut = () => save({ ...load(), me: null, role: null });

export function demoReset() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
