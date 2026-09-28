import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ActionError, blank, publicView, reduce, stillValid } from "./reduce.js";
import { sydneyMonth } from "./logic.js";
import { seed } from "./seed.js";

let idCounter = 1;
const makeCtx = (overrides = {}) => ({
  me: "test_creator",
  role: "creator",
  now: "2026-11-01T12:00:00.000Z",
  random: () => 0,
  id: () => `test-id-${idCounter++}`,
  notice: "",
  ...overrides,
});

function assertError(fn, status, message) {
  assert.throws(
    fn,
    (err) => {
      assert.ok(err instanceof ActionError, `Expected ActionError, got ${err}`);
      assert.equal(err.status, status);
      if (message) {
        if (message instanceof RegExp) {
          assert.match(err.message, message);
        } else {
          assert.equal(err.message, message);
        }
      }
      return true;
    },
  );
}

// ---------------------------------------------------------------------------
// 1. me null: suggest, vote, along throw 401
// ---------------------------------------------------------------------------
{
  const unauthCtx = makeCtx({ me: null, role: null });

  assertError(() => reduce(seed(), { type: "suggest", title: "New Idea" }, unauthCtx), 401);
  assertError(() => reduce(seed(), { type: "vote", id: "seed-1" }, unauthCtx), 401);
  assertError(() => reduce(seed(), { type: "along" }, unauthCtx), 401);
  assertError(() => reduce(seed(), { type: "seen" }, unauthCtx), 401);
}

// ---------------------------------------------------------------------------
// 2. Role permissions: Viewer throws 403, Mod approve/tryAgain work, creator actions throw 403
// ---------------------------------------------------------------------------
{
  const viewerCtx = makeCtx({ me: "viewer_user", role: "viewer" });

  assertError(() => reduce(seed(), { type: "approve", id: "seed-8" }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "reject", id: "seed-8" }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "hide", id: "seed-1" }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "tryAgain", delta: 1 }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "lock" }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "unlock" }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "spin" }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "confirm" }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "void", reason: "mistake" }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "current", patch: { week: 3 } }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "settings", patch: { twitch: "test" } }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "mods", logins: ["testmod"] }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "sample" }, viewerCtx), 403);
  assertError(() => reduce(seed(), { type: "blank" }, viewerCtx), 403);

  const modCtx = makeCtx({ me: "mod_user", role: "mod" });

  const dApprove = seed();
  reduce(dApprove, { type: "approve", id: "seed-8" }, modCtx);
  assert.equal(dApprove.ideas.find((i) => i.id === "seed-8").status, "approved");
  assert.equal(dApprove.modLog[0].action, "approve");
  assert.equal(dApprove.modLog[0].by, "mod_user");

  const dTryAgain = seed();
  assert.equal(dTryAgain.current.tryAgain[2], 2);
  reduce(dTryAgain, { type: "tryAgain", delta: 1 }, modCtx);
  assert.equal(dTryAgain.current.tryAgain[2], 3);

  assertError(() => reduce(seed(), { type: "lock" }, modCtx), 403);
  assertError(() => reduce(seed(), { type: "unlock" }, modCtx), 403);
  assertError(() => reduce(seed(), { type: "spin" }, modCtx), 403);
  assertError(() => reduce(seed(), { type: "settings", patch: { twitch: "test" } }, modCtx), 403);
  assertError(() => reduce(seed(), { type: "current", patch: { week: 3 } }, modCtx), 403);
  assertError(() => reduce(seed(), { type: "mods", logins: ["testmod"] }, modCtx), 403);
  assertError(() => reduce(seed(), { type: "confirm" }, modCtx), 403);
  assertError(() => reduce(seed(), { type: "void", reason: "rerun" }, modCtx), 403);
  assertError(() => reduce(seed(), { type: "sample" }, modCtx), 403);
  assertError(() => reduce(seed(), { type: "blank" }, modCtx), 403);
}

// ---------------------------------------------------------------------------
// 3. vote toggles for approved idea; throws 409 on pending idea or if doc.draw is set
// ---------------------------------------------------------------------------
{
  const d = seed();
  const voterCtx = makeCtx({ me: "fresh_voter", role: "viewer" });
  const approvedIdea = d.ideas.find((i) => i.id === "seed-1");
  const initialCount = approvedIdea.votes.length;

  assert.ok(!approvedIdea.votes.includes("fresh_voter"));
  reduce(d, { type: "vote", id: "seed-1" }, voterCtx);
  assert.ok(approvedIdea.votes.includes("fresh_voter"));
  assert.equal(approvedIdea.votes.length, initialCount + 1);

  reduce(d, { type: "vote", id: "seed-1" }, voterCtx);
  assert.ok(!approvedIdea.votes.includes("fresh_voter"));
  assert.equal(approvedIdea.votes.length, initialCount);

  assertError(() => reduce(d, { type: "vote", id: "seed-8" }, voterCtx), 409);

  d.draw = { status: "locked", pool: [], lockedAt: "2026-11-01T12:00:00Z", winnerId: null };
  assertError(() => reduce(d, { type: "vote", id: "seed-1" }, voterCtx), 409);

  d.draw = null;
  assertError(() => reduce(d, { type: "vote", id: "non_existent_idea" }, voterCtx), 404);
}

// ---------------------------------------------------------------------------
// 4. suggest: validation, duplicate matching, blocked words, rate limiting, length cuts
// ---------------------------------------------------------------------------
{
  const userCtx = makeCtx({ me: "suggest_user", role: "viewer" });

  assertError(() => reduce(blank(), { type: "suggest", title: "ab" }, userCtx), 400);
  assertError(() => reduce(blank(), { type: "suggest", title: "  a  " }, userCtx), 400);
  assertError(() => reduce(blank(), { type: "suggest", title: "" }, userCtx), 400);

  assertError(() => reduce(seed(), { type: "suggest", title: "skateboard OLLIE" }, userCtx), 409);
  assertError(() => reduce(seed(), { type: "suggest", title: "  Skateboard Ollie!!  " }, userCtx), 409);
  assertError(() => reduce(seed(), { type: "suggest", title: "pottery" }, userCtx), 409);

  const dBlocked = blank();
  const ctxBlocked = makeCtx({ me: "suggest_user", role: "viewer", notice: "" });
  reduce(dBlocked, { type: "suggest", title: "Buy DRUGS now", description: "cheap" }, ctxBlocked);
  assert.equal(dBlocked.ideas.length, 1);
  assert.equal(dBlocked.ideas[0].status, "rejected");
  assert.equal(dBlocked.ideas[0].reason, "Auto-rejected: unsafe topic");
  assert.equal(ctxBlocked.notice, "That one got auto-rejected. Try something else.");

  const dRate = blank();
  const ctxRate = makeCtx({ me: "rate_limited_user", role: "viewer", now: "2026-11-01T12:00:00.000Z" });
  for (let i = 1; i <= 5; i++) {
    reduce(dRate, { type: "suggest", title: `Valid Idea ${i}` }, ctxRate);
  }
  assert.equal(dRate.ideas.filter((i) => i.author === "rate_limited_user").length, 5);
  assertError(() => reduce(dRate, { type: "suggest", title: "Valid Idea 6" }, ctxRate), 429);

  dRate.ideas[0].createdAt = "2026-10-31T11:59:59.000Z";
  reduce(dRate, { type: "suggest", title: "Valid Idea 6" }, ctxRate);
  assert.equal(dRate.ideas.length, 6);

  const dCut = blank();
  const longDesc = "d".repeat(300);
  const longTitle = "t".repeat(100);
  reduce(dCut, { type: "suggest", title: longTitle, description: longDesc }, userCtx);
  assert.equal(dCut.ideas[0].title.length, 80);
  assert.equal(dCut.ideas[0].description.length, 280);
  assert.equal(dCut.ideas[0].description, "d".repeat(280));
}

// ---------------------------------------------------------------------------
// 5. lock & spin: idea pool threshold, spin precondition, weighted picker bounds
// ---------------------------------------------------------------------------
{
  const creatorCtx = makeCtx({ role: "creator" });

  const dEmpty = blank();
  assertError(() => reduce(dEmpty, { type: "lock" }, creatorCtx), 409);

  dEmpty.ideas.push({ id: "i1", title: "Idea 1", status: "approved", votes: [] });
  assertError(() => reduce(dEmpty, { type: "lock" }, creatorCtx), 409);

  dEmpty.ideas.push({ id: "i2", title: "Idea 2", status: "pending", votes: [] });
  assertError(() => reduce(dEmpty, { type: "lock" }, creatorCtx), 409);

  dEmpty.ideas.push({ id: "i3", title: "Idea 3", status: "approved", votes: ["u1"] });
  reduce(dEmpty, { type: "lock" }, creatorCtx);
  assert.equal(dEmpty.draw.status, "locked");
  assert.equal(dEmpty.draw.pool.length, 2);
  assert.equal(dEmpty.draw.pool[0].id, "i1");
  assert.equal(dEmpty.draw.pool[1].id, "i3");

  assertError(() => reduce(dEmpty, { type: "lock" }, creatorCtx), 409);

  const dUnspun = seed();
  assert.equal(dUnspun.draw, null);
  assertError(() => reduce(dUnspun, { type: "spin" }, creatorCtx), 409);

  const ctxZero = makeCtx({ role: "creator", random: () => 0 });
  reduce(dEmpty, { type: "spin" }, ctxZero);
  assert.equal(dEmpty.draw.winnerId, "i1");
  assert.equal(dEmpty.draw.status, "revealed");

  reduce(dEmpty, { type: "void", reason: "reroll for testing last entry" }, creatorCtx);
  assert.equal(dEmpty.draw.status, "locked");
  assert.equal(dEmpty.draw.winnerId, null);

  const ctxLast = makeCtx({ role: "creator", random: () => 0.999999 });
  reduce(dEmpty, { type: "spin" }, ctxLast);
  assert.equal(dEmpty.draw.winnerId, "i3");
  assert.equal(dEmpty.draw.status, "revealed");
}

// ---------------------------------------------------------------------------
// 6. confirm: archives current, selects winner, sets month, clears draw, logs entry
// ---------------------------------------------------------------------------
{
  const d = seed();
  const creatorCtx = makeCtx({ role: "creator", now: "2026-11-15T14:30:00.000Z" });

  reduce(d, { type: "lock" }, creatorCtx);
  reduce(d, { type: "spin" }, makeCtx({ role: "creator", random: () => 0 }));

  const winnerId = d.draw.winnerId;
  const winnerIdea = d.ideas.find((i) => i.id === winnerId);
  const prevCurrent = { ...d.current };
  const prevArchiveLen = d.archive.length;

  reduce(d, { type: "confirm" }, creatorCtx);

  assert.equal(d.archive.length, prevArchiveLen + 1);
  assert.equal(d.archive[0].month, prevCurrent.month);
  assert.equal(d.archive[0].title, prevCurrent.title);
  assert.equal(d.archive[0].outcome, "ungraded");
  assert.equal(d.archive[0].tryAgains, 2);
  assert.equal(d.archive[0].along, prevCurrent.along.length);

  assert.equal(winnerIdea.status, "selected");

  assert.equal(d.current.month, sydneyMonth(creatorCtx.now));
  assert.equal(d.current.title, winnerIdea.title);
  assert.equal(d.current.description, winnerIdea.description);
  assert.equal(d.current.week, 1);
  assert.equal(d.current.outcome, "active");

  assert.equal(d.draw, null);

  assert.equal(d.drawLog.length, 1);
  assert.equal(d.drawLog[0].result, "confirmed");
  assert.equal(d.drawLog[0].winnerId, winnerId);
  assert.equal(d.drawLog[0].winnerTitle, winnerIdea.title);
  assert.equal(d.drawLog[0].at, creatorCtx.now);
  assert.equal(d.drawLog[0].by, creatorCtx.me);
}

// ---------------------------------------------------------------------------
// 7. void: requires reason, returns status to locked, resets winnerId, logs void
// ---------------------------------------------------------------------------
{
  const d = seed();
  const creatorCtx = makeCtx({ role: "creator", now: "2026-11-01T16:00:00.000Z" });

  reduce(d, { type: "lock" }, creatorCtx);
  reduce(d, { type: "spin" }, creatorCtx);
  const spunWinnerId = d.draw.winnerId;
  assert.equal(d.draw.status, "revealed");

  assertError(() => reduce(d, { type: "void", reason: "" }, creatorCtx), 400);
  assertError(() => reduce(d, { type: "void", reason: "   " }, creatorCtx), 400);
  assertError(() => reduce(d, { type: "void" }, creatorCtx), 400);

  reduce(d, { type: "void", reason: "Stream disconnected mid-spin" }, creatorCtx);
  assert.equal(d.draw.status, "locked");
  assert.equal(d.draw.winnerId, null);

  assert.equal(d.drawLog.length, 1);
  assert.equal(d.drawLog[0].result, "void");
  assert.equal(d.drawLog[0].reason, "Stream disconnected mid-spin");
  assert.equal(d.drawLog[0].winnerId, spunWinnerId);
  assert.equal(d.drawLog[0].at, creatorCtx.now);
  assert.equal(d.drawLog[0].by, creatorCtx.me);

  assertError(() => reduce(d, { type: "void", reason: "void again" }, creatorCtx), 409);
}

// ---------------------------------------------------------------------------
// 8. settings: webhook validation, logoUrl https requirement, twitch sanitization
// ---------------------------------------------------------------------------
{
  const creatorCtx = makeCtx({ role: "creator" });

  assertError(() => reduce(blank(), { type: "settings", patch: { webhook: "https://evil.example.com/webhook" } }, creatorCtx), 400);
  assertError(() => reduce(blank(), { type: "settings", patch: { webhook: "http://discord.com/api/webhooks/123/abc" } }, creatorCtx), 400);
  assertError(() => reduce(blank(), { type: "settings", patch: { webhook: "not-a-url" } }, creatorCtx), 400);

  const dHook = blank();
  reduce(dHook, { type: "settings", patch: { webhook: "https://discord.com/api/webhooks/123456/abc_DEF-9" } }, creatorCtx);
  assert.equal(dHook.settings.webhook, "https://discord.com/api/webhooks/123456/abc_DEF-9");

  reduce(dHook, { type: "settings", patch: { webhook: "" } }, creatorCtx);
  assert.equal(dHook.settings.webhook, "");

  assertError(() => reduce(blank(), { type: "settings", patch: { logoUrl: "http://example.com/logo.png" } }, creatorCtx), 400);

  const dLogo = blank();
  reduce(dLogo, { type: "settings", patch: { logoUrl: "https://example.com/logo.png" } }, creatorCtx);
  assert.equal(dLogo.settings.logoUrl, "https://example.com/logo.png");

  const dTwitch = blank();
  reduce(dTwitch, { type: "settings", patch: { twitch: "Twitch-User!@#_99" } }, creatorCtx);
  assert.equal(dTwitch.settings.twitch, "twitchuser_99");
}

// ---------------------------------------------------------------------------
// 9. publicView: visibility boundaries across viewer, mod, creator, unauthenticated
// ---------------------------------------------------------------------------
{
  const d = blank();
  d.settings = {
    twitch: "jelapiii",
    spinDate: "2026-11-02",
    spinTime: "19:00",
    siteUrl: "https://example.com",
    logoUrl: "https://example.com/logo.png",
    viewersBefore: "10",
    viewersNow: "20",
    webhook: "https://discord.com/api/webhooks/123456/secret-token",
  };
  d.seen = ["viewer_a", "mod_b", "creator_c"];
  d.mods = ["mod_b"];
  d.drawLog = [{ result: "confirmed", at: "2026-10-01T00:00:00Z" }];

  d.ideas.push({
    id: "idea-approved",
    title: "Community BBQ",
    description: "BBQ on stream",
    author: "charlie",
    anonymous: false,
    status: "approved",
    votes: ["viewer_a"],
    reason: "",
    createdAt: "2026-11-01T00:00:00Z",
  });

  d.ideas.push({
    id: "idea-other-pending",
    title: "Other Pending Idea",
    description: "pending idea by charlie",
    author: "charlie",
    anonymous: false,
    status: "pending",
    votes: [],
    reason: "",
    createdAt: "2026-11-01T00:00:00Z",
  });

  d.ideas.push({
    id: "idea-my-pending",
    title: "My Pending Idea",
    description: "pending idea by viewer_a",
    author: "viewer_a",
    anonymous: false,
    status: "pending",
    votes: [],
    reason: "",
    createdAt: "2026-11-01T00:00:00Z",
  });

  d.ideas.push({
    id: "idea-other-anon",
    title: "Secret Idea",
    description: "anonymous idea by charlie",
    author: "charlie",
    anonymous: true,
    status: "approved",
    votes: [],
    reason: "",
    createdAt: "2026-11-01T00:00:00Z",
  });

  d.ideas.push({
    id: "idea-my-anon",
    title: "My Secret Idea",
    description: "anonymous idea by viewer_a",
    author: "viewer_a",
    anonymous: true,
    status: "approved",
    votes: [],
    reason: "",
    createdAt: "2026-11-01T00:00:00Z",
  });

  d.draw = {
    status: "locked",
    pool: [{ id: "idea-approved", title: "Community BBQ", votes: 1, weight: 2 }],
    lockedAt: "2026-11-01T10:00:00Z",
    winnerId: null,
  };

  const viewerDoc = publicView(d, 1, "viewer_a", "viewer");
  assert.equal(viewerDoc.ideas.some((i) => i.id === "idea-other-pending"), false);

  const myPending = viewerDoc.ideas.find((i) => i.id === "idea-my-pending");
  assert.ok(myPending);
  assert.equal(myPending.mine, true);

  const otherAnon = viewerDoc.ideas.find((i) => i.id === "idea-other-anon");
  assert.equal(otherAnon.author, null);

  const myAnon = viewerDoc.ideas.find((i) => i.id === "idea-my-anon");
  assert.equal(myAnon.author, "viewer_a");
  assert.equal(myAnon.mine, true);

  const approvedIdeaView = viewerDoc.ideas.find((i) => i.id === "idea-approved");
  assert.equal(typeof approvedIdeaView.votes, "number");
  assert.equal(approvedIdeaView.votes, 1);
  assert.equal(typeof approvedIdeaView.voted, "boolean");
  assert.equal(approvedIdeaView.voted, true);
  assert.equal(otherAnon.voted, false);

  assert.equal("webhook" in viewerDoc.settings, false);
  assert.equal("viewersBefore" in viewerDoc.settings, false);
  assert.equal("viewersNow" in viewerDoc.settings, false);
  assert.equal(viewerDoc.settings.twitch, "jelapiii");

  assert.deepEqual(viewerDoc.draw, { status: "locked" });
  assert.equal("pool" in viewerDoc.draw, false);
  assert.equal("winnerId" in viewerDoc.draw, false);

  assert.equal("stats" in viewerDoc, false);
  assert.equal("drawLog" in viewerDoc, false);
  assert.equal("mods" in viewerDoc, false);

  const modDoc = publicView(d, 1, "mod_b", "mod");
  const modOtherAnon = modDoc.ideas.find((i) => i.id === "idea-other-anon");
  assert.equal(modOtherAnon.author, "charlie");

  assert.equal("webhook" in modDoc.settings, false);
  assert.equal(modDoc.settings.viewersBefore, "10");
  assert.equal(modDoc.settings.viewersNow, "20");

  assert.ok("stats" in modDoc);
  assert.equal(modDoc.stats.signIns, 3);
  assert.equal(modDoc.stats.votes, 1);
  assert.equal(modDoc.stats.voters, 1);
  assert.ok("drawLog" in modDoc);
  assert.deepEqual(modDoc.drawLog, d.drawLog);
  assert.ok("mods" in modDoc);
  assert.deepEqual(modDoc.mods, d.mods);
  assert.deepEqual(modDoc.draw, { status: "locked" });
  for (const type of ["approve", "reject", "hide"]) {
    assertError(() => reduce(d, { type, id: "idea-approved" }, makeCtx({ me: "mod_b", role: "mod" })), 409);
  }
  assert.equal(d.ideas.find((i) => i.id === "idea-approved").status, "approved");

  const creatorDoc = publicView(d, 1, "creator_c", "creator");
  assert.equal(creatorDoc.settings.webhook, "https://discord.com/api/webhooks/123456/secret-token");
  assert.deepEqual(creatorDoc.draw, d.draw);
  assert.equal(creatorDoc.ideas.find((i) => i.id === "idea-other-anon").author, "charlie");

  const unauthDoc = publicView(d, 1, null, null);
  assert.equal(unauthDoc.me, null);
  assert.equal(unauthDoc.ideas.find((i) => i.id === "idea-approved").voted, false);
  assert.equal(unauthDoc.ideas.find((i) => i.id === "idea-approved").mine, false);
  assert.equal("webhook" in unauthDoc.settings, false);
  assert.deepEqual(unauthDoc.draw, { status: "locked" });
  assert.equal("stats" in unauthDoc, false);
}

// ---------------------------------------------------------------------------
// 10. Adversarial edge cases & state transitions
// ---------------------------------------------------------------------------
{
  const creatorCtx = makeCtx({ role: "creator" });

  assertError(() => reduce(blank(), { type: "unknown_action_type" }, creatorCtx), 400);

  assertError(() => reduce(blank(), { type: "along" }, makeCtx({ me: "u1" })), 409);

  const dAlong = seed();
  reduce(dAlong, { type: "along" }, makeCtx({ me: "along_user" }));
  assert.ok(dAlong.current.along.includes("along_user"));
  reduce(dAlong, { type: "along" }, makeCtx({ me: "along_user" }));
  assert.ok(!dAlong.current.along.includes("along_user"));

  const dClamp = seed();
  const modCtx = makeCtx({ me: "mod_clamp", role: "mod" });
  dClamp.current.tryAgain[dClamp.current.week] = 1;
  reduce(dClamp, { type: "tryAgain", delta: -1 }, modCtx);
  assert.equal(dClamp.current.tryAgain[dClamp.current.week], 0);
  reduce(dClamp, { type: "tryAgain", delta: -1 }, modCtx);
  assert.equal(dClamp.current.tryAgain[dClamp.current.week], 0);

  const dCur = seed();
  const prevTitle = dCur.current.title;
  reduce(
    dCur,
    {
      type: "current",
      patch: {
        title: "   ",
        description: "New description",
        week: 3,
        outcome: "passed",
        updates: { 3: "Week 3 live update" },
        goals: [{ text: " Goal 1 ", done: true }],
      },
    },
    creatorCtx,
  );
  assert.equal(dCur.current.title, prevTitle);
  assert.equal(dCur.current.description, "New description");
  assert.equal(dCur.current.week, 3);
  assert.equal(dCur.current.outcome, "passed");
  assert.equal(dCur.current.updates[3], "Week 3 live update");
  assert.equal(dCur.current.goals.length, 1);
  assert.equal(dCur.current.goals[0].text, "Goal 1");
  assert.equal(dCur.current.goals[0].done, true);

  reduce(dCur, { type: "current", patch: { outcome: "toString" } }, creatorCtx);
  assert.equal(dCur.current.outcome, "passed");

  assertError(() => reduce(blank(), { type: "mods", logins: "not_an_array" }, creatorCtx), 400);
  const dMods = blank();
  reduce(dMods, { type: "mods", logins: ["Mod_One!", "MOD_ONE", "  mod_two  ", ""] }, creatorCtx);
  assert.deepEqual(dMods.mods, ["mod_one", "mod_two"]);

  const dSampleSource = blank();
  dSampleSource.mods = ["retained_mod"];
  dSampleSource.seen = ["retained_seen"];
  const sampled = reduce(dSampleSource, { type: "sample" }, creatorCtx);
  assert.deepEqual(sampled.mods, ["retained_mod"]);
  assert.deepEqual(sampled.seen, ["retained_seen"]);
  assert.ok(sampled.ideas.length > 0);

  const dBlankSource = seed();
  dBlankSource.mods = ["preserved_mod"];
  dBlankSource.seen = ["preserved_seen"];
  dBlankSource.settings.twitch = "preserved_twitch";
  const blanked = reduce(dBlankSource, { type: "blank" }, creatorCtx);
  assert.deepEqual(blanked.mods, ["preserved_mod"]);
  assert.deepEqual(blanked.seen, ["preserved_seen"]);
  assert.equal(blanked.settings.twitch, "preserved_twitch");
  assert.equal(blanked.ideas.length, 0);
  assert.equal(blanked.current, null);

  const dUnlock = seed();
  reduce(dUnlock, { type: "lock" }, creatorCtx);
  assert.equal(dUnlock.draw.status, "locked");
  reduce(dUnlock, { type: "unlock" }, creatorCtx);
  assert.equal(dUnlock.draw, null);
  assertError(() => reduce(dUnlock, { type: "unlock" }, creatorCtx), 409);

  const dDrawSuggest = seed();
  reduce(dDrawSuggest, { type: "lock" }, creatorCtx);
  assertError(() => reduce(dDrawSuggest, { type: "suggest", title: "Idea during lock" }, makeCtx({ me: "user_lock" })), 409);

  const dSeen = blank();
  reduce(dSeen, { type: "seen" }, makeCtx({ me: "visitor" }));
  assert.deepEqual(dSeen.seen, ["visitor"]);
  reduce(dSeen, { type: "seen" }, makeCtx({ me: "visitor" }));
  assert.deepEqual(dSeen.seen, ["visitor"]);

  assertError(() => reduce(blank(), { type: "approve", id: "missing_id" }, modCtx), 404);
  assertError(() => reduce(blank(), { type: "reject", id: "missing_id" }, modCtx), 404);
  assertError(() => reduce(blank(), { type: "hide", id: "missing_id" }, modCtx), 404);
}

// ---------------------------------------------------------------------------
// 11. Partner applications: apply, review, and the one-pending rule (R-15 to R-23)
// ---------------------------------------------------------------------------
{
  const GOOD_VOD = "https://www.twitch.tv/videos/2410098311";
  const applicant = makeCtx({ me: "new_streamer", role: "viewer" });

  assertError(() => reduce(seed(), { type: "apply", vod: GOOD_VOD }, makeCtx({ me: null, role: null })), 401);

  for (const bad of ["", "not a url", "https://youtube.com/watch?v=abcdefghijk", "http://twitch.tv/videos/123", "https://twitch.tv/videos/notanumber"]) {
    assertError(() => reduce(seed(), { type: "apply", vod: bad }, applicant), 400);
  }
  for (const good of [GOOD_VOD, "https://twitch.tv/videos/12", "https://clips.twitch.tv/SparklyCrunchyOtter-abc", "https://www.twitch.tv/someone/clip/ClipName-1"]) {
    const d = seed();
    reduce(d, { type: "apply", vod: good }, makeCtx({ me: "new_streamer", role: "viewer" }));
    assert.equal(d.applications[0].vod, good);
  }

  const d = seed();
  const before = d.applications.length;
  reduce(d, { type: "apply", vod: GOOD_VOD, note: "  my first one  " }, applicant);
  assert.equal(d.applications.length, before + 1);
  const fresh = d.applications[0];
  assert.equal(fresh.login, "new_streamer");
  assert.equal(fresh.status, "pending");
  assert.equal(fresh.note, "my first one");
  assert.equal(fresh.decidedAt, "");

  // R-21: one pending per account.
  assertError(() => reduce(d, { type: "apply", vod: GOOD_VOD }, applicant), 409);
  // R-21: already approved means there is nothing to apply for.
  assertError(() => reduce(d, { type: "apply", vod: GOOD_VOD }, makeCtx({ me: "mochi_mae", role: "viewer" })), 409);

  // Only mods decide.
  assertError(() => reduce(d, { type: "review", id: fresh.id, decision: "approved" }, applicant), 403);
  assertError(() => reduce(d, { type: "review", id: fresh.id, decision: "approved" }, makeCtx({ me: null, role: null })), 401);

  const modCtx = makeCtx({ me: "mod_user", role: "mod", now: "2026-11-02T09:00:00.000Z" });
  assertError(() => reduce(d, { type: "review", id: "no-such-id", decision: "approved" }, modCtx), 404);
  assertError(() => reduce(d, { type: "review", id: fresh.id, decision: "maybe" }, modCtx), 400);
  assertError(() => reduce(d, { type: "review", id: fresh.id }, modCtx), 400);

  reduce(d, { type: "review", id: fresh.id, decision: "approved" }, modCtx);
  assert.equal(fresh.status, "approved");
  assert.equal(fresh.decidedBy, "mod_user");
  assert.equal(fresh.decidedAt, "2026-11-02T09:00:00.000Z");
  assert.ok(d.partners.includes("new_streamer"));
  assert.equal(d.modLog[0].action, "approved partner");

  // A decided application does not get decided twice.
  assertError(() => reduce(d, { type: "review", id: fresh.id, decision: "rejected" }, modCtx), 409);

  // R-21: re-apply after a rejection.
  const dReject = seed();
  reduce(dReject, { type: "apply", vod: GOOD_VOD }, makeCtx({ me: "second_try", role: "viewer" }));
  const rejected = dReject.applications[0];
  reduce(dReject, { type: "review", id: rejected.id, decision: "rejected", reason: "  Wrong challenge.  " }, modCtx);
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.reason, "Wrong challenge.");
  assert.equal(dReject.partners.includes("second_try"), false);
  reduce(dReject, { type: "apply", vod: GOOD_VOD }, makeCtx({ me: "second_try", role: "viewer" }));
  assert.equal(dReject.applications.filter((p) => p.login === "second_try" && p.status === "pending").length, 1);

  // An approval carries no reason text.
  const dReason = seed();
  reduce(dReason, { type: "apply", vod: GOOD_VOD }, makeCtx({ me: "clean_slate", role: "viewer" }));
  reduce(dReason, { type: "review", id: dReason.applications[0].id, decision: "approved", reason: "ignored" }, modCtx);
  assert.equal(dReason.applications[0].reason, "");
}

// ---------------------------------------------------------------------------
// 12. Partner checklist: the R-25 gate and the R-27 cycle reset
// ---------------------------------------------------------------------------
{
  const partnerCtx = makeCtx({ me: "mochi_mae", role: "viewer" });

  assertError(() => reduce(seed(), { type: "partnerTick", kind: "week", index: 1 }, makeCtx({ me: null, role: null })), 401);
  // R-25: the panel is locked, not hidden. A viewer, a mod and the creator are all refused unless they are partners.
  for (const role of ["viewer", "mod", "creator"]) {
    assertError(() => reduce(seed(), { type: "partnerTick", kind: "week", index: 1 }, makeCtx({ me: "outsider", role })), 403);
  }

  const d = seed();
  reduce(d, { type: "partnerTick", kind: "week", index: 3 }, partnerCtx);
  assert.deepEqual(d.checklists.mochi_mae.weeks, [1, 3]);
  reduce(d, { type: "partnerTick", kind: "week", index: 3 }, partnerCtx);
  assert.deepEqual(d.checklists.mochi_mae.weeks, [1]);

  // R-26: the weeks are Orchi's 4, a partner cannot invent a fifth.
  for (const bad of [0, 5, -1, 1.5, "1", null]) {
    assertError(() => reduce(seed(), { type: "partnerTick", kind: "week", index: bad }, partnerCtx), 400);
  }
  assertError(() => reduce(seed(), { type: "partnerTick", kind: "nonsense", index: 1 }, partnerCtx), 400);

  // Goals are bounded by this month's actual goal list.
  const goalCount = seed().current.goals.length;
  reduce(d, { type: "partnerTick", kind: "goal", index: goalCount - 1 }, partnerCtx);
  assert.ok(d.checklists.mochi_mae.goals.includes(goalCount - 1));
  for (const bad of [goalCount, -1, 99]) {
    assertError(() => reduce(seed(), { type: "partnerTick", kind: "goal", index: bad }, partnerCtx), 400);
  }

  // No LARP running means nothing to tick.
  const dNone = seed();
  dNone.current = null;
  assertError(() => reduce(dNone, { type: "partnerTick", kind: "week", index: 1 }, partnerCtx), 409);

  // R-27: a sheet left over from an earlier cycle starts empty rather than carrying over.
  const dOld = seed();
  dOld.checklists.mochi_mae = { month: "2026-09", weeks: [1, 2, 3, 4], goals: [0, 1, 2] };
  reduce(dOld, { type: "partnerTick", kind: "week", index: 2 }, partnerCtx);
  assert.equal(dOld.checklists.mochi_mae.month, dOld.current.month);
  assert.deepEqual(dOld.checklists.mochi_mae.weeks, [2]);
  assert.deepEqual(dOld.checklists.mochi_mae.goals, []);
}

// ---------------------------------------------------------------------------
// 13. publicView: partners are public, applications are not, checklists are private
// ---------------------------------------------------------------------------
{
  const d = seed();
  d.mods = ["mod_b"];

  const anon = publicView(d, 1, null, null);
  assert.deepEqual(anon.partners, d.partners);
  assert.equal("applications" in anon, false);
  assert.equal(anon.checklist, null);
  assert.equal(anon.me, null);

  const viewer = publicView(d, 1, "pixelpav", "viewer");
  assert.equal("applications" in viewer, false);
  assert.equal(viewer.checklist, null);
  assert.equal(viewer.me.partner, false);
  assert.equal(viewer.me.application.status, "pending");

  const partner = publicView(d, 1, "mochi_mae", "viewer");
  assert.equal(partner.me.partner, true);
  assert.equal(partner.me.application.status, "approved");
  assert.deepEqual(partner.checklist, d.checklists.mochi_mae);
  assert.equal("applications" in partner, false);

  // A partner with no saved sheet still gets an empty one for this cycle.
  const bare = publicView(d, 1, "sleepyk0ala", "viewer");
  assert.deepEqual(bare.checklist, { month: d.current.month, weeks: [], goals: [] });

  // A rejected applicant sees why.
  const knocked = publicView(d, 1, "saltyseagull", "viewer");
  assert.equal(knocked.me.partner, false);
  assert.equal(knocked.me.application.status, "rejected");
  assert.match(knocked.me.application.reason, /different challenge/);

  // Mods and the creator see the queue; a mod's own checklist stays their own.
  for (const [login, role] of [["mod_b", "mod"], ["jelapiii", "creator"]]) {
    const staff = publicView(d, 1, login, role);
    assert.deepEqual(staff.applications, d.applications);
    assert.equal(staff.checklist, null);
  }

  // Someone who never applied has no application at all.
  const stranger = publicView(d, 1, "nobody_here", "viewer");
  assert.equal(stranger.me.application, null);
  assert.equal(stranger.me.partner, false);
}

// ---------------------------------------------------------------------------
// 14. R-26: being an approved partner grants nothing beyond the partner sheet
// ---------------------------------------------------------------------------
{
  const partnerCtx = makeCtx({ me: "mochi_mae", role: "viewer" });
  assert.ok(seed().partners.includes("mochi_mae"), "mochi_mae must be a seeded partner");

  const staffOnly = [
    { type: "approve", id: "seed-8" },
    { type: "reject", id: "seed-8", reason: "no" },
    { type: "hide", id: "seed-1" },
    { type: "tryAgain", delta: 1 },
    { type: "review", id: "seed-app-1", decision: "approved" },
    { type: "current", patch: { title: "My own LARP", week: 4, outcome: "passed" } },
    { type: "settings", patch: { twitch: "mochi_mae" } },
    { type: "mods", logins: ["mochi_mae"] },
    { type: "lock" },
    { type: "unlock" },
    { type: "spin" },
    { type: "confirm" },
    { type: "void", reason: "rerun" },
    { type: "sample" },
    { type: "blank" },
    { type: "forgetAccount", login: "someone" },
  ];
  for (const action of staffOnly) {
    assertError(() => reduce(seed(), action, partnerCtx), 403);
  }
  // A new case in reduce.js must be named open or staff here, or this fails.
  const src = await readFile(new URL("./reduce.js", import.meta.url), "utf8");
  const every = new Set([...src.matchAll(/case "(\w+)":/g)].map((m) => m[1]));
  const open = new Set(["seen", "signOut", "suggest", "vote", "along", "apply", "partnerTick"]);
  assert.deepEqual(new Set(staffOnly.map((a) => a.type)), new Set([...every].filter((t) => !open.has(t))));

  // The partner view carries no staff data either.
  const view = publicView(seed(), 1, "mochi_mae", "viewer");
  for (const key of ["drawLog", "mods", "applications", "stats"]) assert.equal(key in view, false, key);
  for (const key of ["webhook", "viewersBefore", "viewersNow"]) assert.equal(key in view.settings, false, key);
}

// A handle is not a person, and signing out has to reach the server.
{
  const d = blank();
  reduce(d, { type: "seen" }, makeCtx({ me: "viewer_one", role: "viewer", twitchId: "111" }));
  assert.deepEqual(d.accounts.viewer_one, { id: "111", epoch: 0 });

  assert.equal(stillValid(d, { login: "viewer_one", twitchId: "111", epoch: 0 }), true);
  // Same name, different Twitch account: the handle changed hands.
  assert.equal(stillValid(d, { login: "viewer_one", twitchId: "222", epoch: 0 }), false);
  assert.equal(stillValid(d, { login: "viewer_one", twitchId: "222", fresh: true }), false);
  assert.equal(stillValid(d, { login: "stranger", twitchId: "999", epoch: 0 }), true);
  assert.equal(stillValid(d, null), false);

  reduce(d, { type: "signOut" }, makeCtx({ me: "viewer_one", role: "viewer", twitchId: "111" }));
  assert.equal(d.accounts.viewer_one.epoch, 1);
  assert.equal(stillValid(d, { login: "viewer_one", twitchId: "111", epoch: 0 }), false, "the old cookie is dead");
  assert.equal(stillValid(d, { login: "viewer_one", twitchId: "111", epoch: 1 }), true, "the next one works");
  assert.equal(stillValid(d, { login: "viewer_one", twitchId: "111", fresh: true }), true, "signing back in still works");

  const dOld = blank();
  dOld.accounts.legacy = { id: "", epoch: 0 };
  reduce(dOld, { type: "seen" }, makeCtx({ me: "legacy", role: "viewer", twitchId: "777" }));
  assert.equal(dOld.accounts.legacy.id, "777");

  // Wiping for a rehearsal must not strand everyone's cookie or unpin the ids.
  const dWipe = blank();
  dWipe.accounts = { someone: { id: "1", epoch: 3 } };
  assert.deepEqual(reduce(dWipe, { type: "sample" }, makeCtx()).accounts, { someone: { id: "1", epoch: 3 } });
  assert.deepEqual(reduce(dWipe, { type: "blank" }, makeCtx()).accounts, { someone: { id: "1", epoch: 3 } });

  assert.equal("accounts" in publicView(dWipe, 1, "test_creator", "creator"), false, "ids and epochs never leave the server");
}

// A stale Studio tab cannot put a removed mod back.
{
  const d = blank();
  d.mods = ["mod_one", "mod_two"];
  reduce(d, { type: "mods", logins: ["mod_one"], prev: ["mod_one", "mod_two"] }, makeCtx());
  assert.deepEqual(d.mods, ["mod_one"]);
  assertError(() => reduce(d, { type: "mods", logins: ["mod_one", "mod_two"], prev: ["mod_one", "mod_two"] }, makeCtx()), 409);
  assert.deepEqual(d.mods, ["mod_one"]);
}

// Clearing a pinned name is creator only, and it is the way out of the lockout.
{
  const d = blank();
  reduce(d, { type: "seen" }, makeCtx({ me: "renamed_away", role: "viewer", twitchId: "111" }));
  // The new owner of the handle cannot sign in while the old id is pinned.
  assert.equal(stillValid(d, { login: "renamed_away", twitchId: "222", fresh: true }), false);

  assertError(() => reduce(d, { type: "forgetAccount", login: "renamed_away" }, makeCtx({ role: "mod" })), 403);
  assertError(() => reduce(d, { type: "forgetAccount", login: "nobody_here" }, makeCtx()), 404);
  assertError(() => reduce(d, { type: "forgetAccount", login: "" }, makeCtx()), 400);

  reduce(d, { type: "forgetAccount", login: "Renamed_Away" }, makeCtx());
  assert.equal("renamed_away" in d.accounts, false);
  // And now the new owner can start over as themselves.
  assert.equal(stillValid(d, { login: "renamed_away", twitchId: "222", fresh: true }), true);
}

console.log("reduce checks passed");
