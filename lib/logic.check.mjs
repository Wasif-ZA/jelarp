import assert from "node:assert/strict";
import {
  VOD_RE,
  WEBHOOK_RE,
  cycleRemaining,
  countdown,
  isBlocked,
  nextMonth,
  nextSpinDate,
  parseLinks,
  pickWeighted,
  rankFor,
  sydneyMonth,
  sydneyTime,
  tryAgainTotal,
  upcomingSpin,
  weight,
  youtubeId,
} from "./logic.js";

assert.equal(sydneyTime("2026-11-02", "19:00"), Date.parse("2026-11-02T08:00:00Z"));
assert.equal(sydneyTime("2026-07-06", "19:00"), Date.parse("2026-07-06T09:00:00Z"));
assert.ok(Number.isNaN(sydneyTime("", "19:00")));
assert.equal(nextSpinDate("2026-11-02"), "2026-12-07");
assert.equal(nextSpinDate("2026-12-07"), "2027-01-04");
assert.equal(nextSpinDate("2026-11-30"), "2026-12-28");
assert.equal(upcomingSpin("2026-11-02", "19:00", Date.parse("2026-11-01T00:00:00Z")), "2026-11-02");
assert.equal(upcomingSpin("2026-11-02", "19:00", Date.parse("2026-11-02T12:00:00Z")), "2026-11-02");
assert.equal(upcomingSpin("2026-11-02", "19:00", Date.parse("2027-01-05T00:00:00Z")), "2027-02-01");
assert.equal(upcomingSpin("", "19:00", Date.now()), "");

assert.equal(sydneyMonth("2026-10-31T14:00:00Z"), "2026-11");
assert.equal(sydneyMonth("2026-10-01T09:00:00Z"), "2026-10");
assert.ok(WEBHOOK_RE.test("https://discord.com/api/webhooks/123456/abc_DEF-9"));
assert.ok(!WEBHOOK_RE.test("https://evil.example/api/webhooks/123/abc"));

const pool = [
  { id: "popular", weight: weight(5) },
  { id: "zero", weight: weight(0) },
];
assert.equal(pickWeighted(pool, 0).id, "popular");
assert.equal(pickWeighted(pool, 5.99 / 7).id, "popular");
assert.equal(pickWeighted(pool, 6.01 / 7).id, "zero");
assert.equal(pickWeighted(pool, 0.999999).id, "zero");

const runs = 70000;
let zeroWins = 0;
for (let i = 0; i < runs; i++) if (pickWeighted(pool, Math.random()).id === "zero") zeroWins++;
assert.ok(Math.abs(zeroWins / runs - 1 / 7) < 0.01, `zero-vote idea won ${zeroWins / runs}, expected about 1/7`);

assert.ok(isBlocked("how to skin a cat"));
assert.ok(isBlocked("Buy DRUGS"));
assert.ok(!isBlocked("skill tree"));
assert.ok(!isBlocked("skincare routine"));
assert.ok(!isBlocked("Juggle three balls"));

assert.equal(nextMonth("2026-12"), "2027-01");
assert.equal(nextMonth("2026-09"), "2026-10");

assert.deepEqual(parseLinks("VOD | https://youtu.be/x\nbad | javascript:alert(1)\nno url"), [
  { title: "VOD", url: "https://youtu.be/x" },
]);

assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), "dQw4w9WgXcQ");
assert.equal(youtubeId("https://www.youtube.com/"), null);

assert.equal(countdown(90061000), "1d 01h 01m 01s");
assert.equal(countdown(0), null);

assert.equal(rankFor({ week: 2, outcome: "active" }), "Apprentice");
assert.equal(rankFor({ week: 4, outcome: "passed" }), "Master");
assert.equal(tryAgainTotal({ tryAgain: { 1: 0, 2: 2, 3: 1, 4: 0 } }), 3);

// cycleRemaining: days above 24 hours, hours below it, null once the cycle is over (R-02, R-05, R-06).
assert.deepEqual(cycleRemaining(28 * 864e5), { value: 28, unit: "days", lastDay: false });
assert.deepEqual(cycleRemaining(864e5 + 1), { value: 2, unit: "days", lastDay: false });
assert.deepEqual(cycleRemaining(864e5), { value: 24, unit: "hours", lastDay: true });
assert.deepEqual(cycleRemaining(36e5), { value: 1, unit: "hour", lastDay: true });
assert.deepEqual(cycleRemaining(1), { value: 1, unit: "hour", lastDay: true });
assert.equal(cycleRemaining(0), null);
assert.equal(cycleRemaining(-5000), null);
// A part day still counts as a day, so the figure matches a hand count off a calendar.
assert.equal(cycleRemaining(5.2 * 864e5).value, 6);

for (const url of [
  "https://www.twitch.tv/videos/2410098311",
  "https://twitch.tv/videos/12",
  "https://clips.twitch.tv/SparklyCrunchyOtter-abc",
  "https://www.twitch.tv/jelapiii/clip/ClipName-1",
]) {
  assert.ok(VOD_RE.test(url), url);
}
for (const url of ["", "http://twitch.tv/videos/123", "https://youtube.com/watch?v=abcdefghijk", "https://twitch.tv/videos/abc", "https://twitch.tv/jelapiii"]) {
  assert.equal(VOD_RE.test(url), false, url);
}

console.log("logic checks passed");
