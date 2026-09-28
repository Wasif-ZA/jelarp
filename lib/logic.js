export const WEEKS = [
  { name: "Pick & plan", blurb: "Spin the wheel, set goals, agree what passing looks like." },
  { name: "Learn", blurb: "Learn and practise it on stream." },
  { name: "Test", blurb: "Try it for real and find the gaps." },
  { name: "Pass the challenge", blurb: "The final test. Pass or fail." },
];

export const RANKS = ["Noob", "Apprentice", "Journeyman", "Master"];
export const rankFor = (c) => (c.outcome === "passed" ? "Master" : RANKS[c.week - 1]);

export const OUTCOMES = {
  active: "Active",
  passed: "Passed",
  "not-passed": "Not passed",
  ungraded: "Completed without grading",
};

export const weight = (votes) => 1 + votes;

export function pickWeighted(pool, r) {
  let ticket = r * pool.reduce((t, p) => t + p.weight, 0);
  for (const p of pool) {
    if (ticket < p.weight) return p;
    ticket -= p.weight;
  }
  return pool[pool.length - 1];
}

// ponytail: draws in the creator's browser; Phase 2 moves the pick server-side with a stored pool snapshot.
export const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

// ponytail: keyword list only catches the obvious; everything else still waits for a mod.
const BLOCKED =
  /\b(skin(ning)? an? (cat|dog|animal)|weapons?|guns?|bombs?|drugs?|nudes?|nsfw|porn|suicide|self[- ]?harm|shoplift(ing)?|steal(ing)?)\b/i;
export const isBlocked = (text) => BLOCKED.test(text);

const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const sameTitle = (a, b) => squash(a) === squash(b);

export const tryAgainTotal = (c) => Object.values(c.tryAgain || {}).reduce((t, n) => t + n, 0);

export function nextMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export const monthLabel = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });

export function countdown(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${Math.floor(s / 86400)}d ${pad(Math.floor((s % 86400) / 3600))}h ${pad(Math.floor((s % 3600) / 60))}m ${pad(s % 60)}s`;
}

export const parseLinks = (text = "") =>
  text
    .split("\n")
    .map((line) => line.split("|").map((x) => x.trim()))
    .filter(([title, url]) => title && /^https?:\/\//.test(url || ""))
    .map(([title, url]) => ({ title, url }));

export const WEBHOOK_RE = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export const sydneyMonth = (iso) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit" }).format(new Date(iso));

export function sydneyTime(date, time) {
  const guess = Date.parse(`${date}T${(time || "19:00").slice(0, 5)}:00Z`);
  if (Number.isNaN(guess)) return NaN;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Australia/Sydney", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(guess)
      .map((x) => [x.type, x.value]),
  );
  return 2 * guess - Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
}

export function nextSpinDate(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const [y, m] = nextMonth(date.slice(0, 7)).split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const lastDate = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let day = 1 + ((d.getUTCDay() - firstWeekday + 7) % 7) + (Math.ceil(d.getUTCDate() / 7) - 1) * 7;
  if (day > lastDate) day -= 7;
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const SPIN_GRACE_MS = 6 * 36e5;

// ponytail: keeps the weekday slot (first Monday stays first Monday); a 5th-weekday date slides to the 4th.
export function upcomingSpin(date, time, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return date;
  let d = date;
  while (sydneyTime(d, time) + SPIN_GRACE_MS < now) d = nextSpinDate(d);
  return d;
}

export function youtubeId(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

// R-02: the cycle ends at the next spin, so days remaining counts down to it in Sydney time.
export function cycleRemaining(ms) {
  if (ms <= 0) return null;
  const hours = Math.ceil(ms / 36e5);
  if (hours <= 24) return { value: hours, unit: hours === 1 ? "hour" : "hours", lastDay: true };
  const days = Math.ceil(ms / 864e5);
  return { value: days, unit: days === 1 ? "day" : "days", lastDay: false };
}

export const DISCORD_RE = /^https:\/\/(discord\.gg\/[\w-]+|(www\.)?discord\.com\/invite\/[\w-]+)$/i;

export const VOD_RE = /^https:\/\/(www\.)?(twitch\.tv\/(videos\/\d+|[\w]+\/clip\/[\w-]+)|clips\.twitch\.tv\/[\w-]+)/i;
