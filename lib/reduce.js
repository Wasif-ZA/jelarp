import { DISCORD_RE, OUTCOMES, VOD_RE, WEBHOOK_RE, WEEKS, isBlocked, pickWeighted, sameTitle, sydneyMonth, tryAgainTotal, upcomingSpin, weight } from "./logic.js";
import { DEFAULT_PALETTE, PALETTE_KEYS } from "./palettes.js";
import { seed } from "./seed.js";

export class ActionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const blank = () => ({
  ideas: [],
  current: null,
  draw: null,
  drawLog: [],
  modLog: [],
  archive: [],
  seen: [],
  mods: [],
  // login -> { id, epoch }. The numeric Twitch id this handle belonged to when it
  // last signed in, and a counter that signing out bumps.
  accounts: {},
  partners: [],
  applications: [],
  checklists: {},
  settings: {
    twitch: "",
    spinDate: "",
    spinTime: "19:00",
    siteUrl: "",
    logoUrl: "",
    discordUrl: "",
    palette: DEFAULT_PALETTE,
    viewersBefore: "",
    viewersNow: "",
    webhook: "",
  },
});

const SETTINGS = Object.keys(blank().settings);
const privileged = (role) => role === "creator" || role === "mod";
const clean = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const toggle = (list, name) => (list.includes(name) ? list.filter((n) => n !== name) : [...list, name]);

function need(ctx, level) {
  if (!ctx.me) throw new ActionError(401, "Sign in with Twitch first.");
  if (level === "mod" && !privileged(ctx.role)) throw new ActionError(403, "Mods only.");
  if (level === "creator" && ctx.role !== "creator") throw new ActionError(403, "Creator only.");
}

function findIdea(doc, id) {
  const idea = doc.ideas.find((i) => i.id === id);
  if (!idea) throw new ActionError(404, "Idea not found.");
  return idea;
}

function running(doc) {
  if (!doc.current) throw new ActionError(409, "No LARP is running yet.");
  return doc.current;
}

// R-27: a sheet from a past cycle reads as empty, so the month boundary archives it without a job.
function checklistFor(doc, login) {
  const month = doc.current?.month || "";
  const saved = doc.checklists[login];
  return saved?.month === month ? saved : { month, weeks: [], goals: [] };
}

/* A signed cookie only proves nobody edited it. It does not prove the account
   behind the name is still the same one, and it does not stop working when
   someone signs out, because nothing about it lives on the server.

   Both holes close in the same place. The document remembers which numeric
   Twitch id each handle belonged to and how many times it has signed out, and a
   cookie counts only if it still agrees with both.

   `fresh` is a sign-in that just came back from Twitch: the epoch cannot match
   yet because the cookie does not exist, but the id must still line up, or this
   is a different person holding a handle someone else gave up. */
export function stillValid(doc, who) {
  const { login, twitchId, epoch, fresh } = who || {};
  if (!login) return false;
  const acct = doc.accounts?.[login];
  if (!acct) return true;
  if (acct.id && twitchId && acct.id !== twitchId) return false;
  return Boolean(fresh) || (acct.epoch || 0) === (epoch || 0);
}

export function reduce(doc, action, ctx) {
  const a = action || {};
  switch (a.type) {
    case "seen": {
      need(ctx);
      if (!doc.seen.includes(ctx.me)) doc.seen.push(ctx.me);
      // Twitch releases a handle when its owner renames, so the name alone cannot
      // say who someone is. Pin it to the numeric id the first time we see it.
      // A record with no id predates this and adopts the next id that signs in.
      const accounts = (doc.accounts ||= {});
      const acct = accounts[ctx.me];
      if (!acct) accounts[ctx.me] = { id: ctx.twitchId || "", epoch: 0 };
      else if (!acct.id && ctx.twitchId) acct.id = ctx.twitchId;
      return doc;
    }

    /* The pin in "seen" is what stops a reused handle inheriting an account, and
       it locks out the new owner too, which is the right default and a dead end
       without this. Clearing the record lets them start over as themselves; it
       does not hand them anything the old owner left behind, because the mod list
       and the submissions are separate. */
    case "forgetAccount": {
      need(ctx, "creator");
      const login = clean(a.login, 25).toLowerCase();
      if (!login) throw new ActionError(400, "Name the account to clear.");
      if (!doc.accounts?.[login]) throw new ActionError(404, "No sign-in recorded under that name.");
      delete doc.accounts[login];
      return doc;
    }

    // Signing out has to leave a mark on the server, or the cookie it deleted from
    // the browser still works everywhere else it was copied to.
    case "signOut": {
      need(ctx);
      const acct = (doc.accounts ||= {})[ctx.me];
      if (acct) acct.epoch = (acct.epoch || 0) + 1;
      return doc;
    }

    case "suggest": {
      need(ctx);
      if (doc.draw) throw new ActionError(409, "The draw is locked. Suggestions reopen after the spin.");
      const title = clean(a.title, 80);
      const description = clean(a.description, 280);
      if (title.length < 3) throw new ActionError(400, "Give it a title of at least 3 characters.");
      const dayAgo = Date.parse(ctx.now) - 864e5;
      if (doc.ideas.filter((i) => i.author === ctx.me && Date.parse(i.createdAt) > dayAgo).length >= 5) {
        throw new ActionError(429, "That's 5 ideas today. Try again tomorrow.");
      }
      const dupe = doc.ideas.find((i) => (i.status === "approved" || i.status === "pending") && sameTitle(i.title, title));
      if (dupe) {
        throw new ActionError(
          409,
          dupe.status === "approved" ? `"${dupe.title}" is already on the board. Vote for it instead.` : `"${dupe.title}" is already waiting for a mod.`,
        );
      }
      const blocked = isBlocked(`${title} ${description}`);
      doc.ideas.push({
        id: ctx.id(),
        title,
        description,
        author: ctx.me,
        anonymous: Boolean(a.anonymous),
        status: blocked ? "rejected" : "pending",
        votes: [],
        reason: blocked ? "Auto-rejected: unsafe topic" : "",
        createdAt: ctx.now,
      });
      ctx.notice = blocked ? "That one got auto-rejected. Try something else." : "Sent! A mod checks it before it hits the board.";
      return doc;
    }

    case "vote": {
      need(ctx);
      if (doc.draw) throw new ActionError(409, "Votes are frozen while the draw is locked.");
      const idea = findIdea(doc, a.id);
      if (idea.status !== "approved") throw new ActionError(409, "You can only vote on ideas that are on the board.");
      idea.votes = toggle(idea.votes, ctx.me);
      return doc;
    }

    case "along": {
      need(ctx);
      const c = running(doc);
      c.along = toggle(c.along, ctx.me);
      return doc;
    }

    case "approve":
    case "reject":
    case "hide": {
      need(ctx, "mod");
      if (doc.draw) throw new ActionError(409, "The draw is locked. Change ideas after the spin.");
      const idea = findIdea(doc, a.id);
      idea.status = { approve: "approved", reject: "rejected", hide: "hidden" }[a.type];
      if (a.type === "reject") idea.reason = clean(a.reason, 200);
      doc.modLog = [{ at: ctx.now, by: ctx.me, action: a.type, ideaId: idea.id, title: idea.title }, ...doc.modLog].slice(0, 200);
      return doc;
    }

    case "current": {
      need(ctx, "creator");
      const c = running(doc);
      const p = a.patch || {};
      if ("title" in p) c.title = clean(p.title, 80) || c.title;
      if ("description" in p) c.description = clean(p.description, 280);
      if ("passCondition" in p) c.passCondition = clean(p.passCondition, 400);
      if ("links" in p) c.links = clean(p.links, 2000);
      if ([1, 2, 3, 4].includes(p.week)) c.week = p.week;
      if (Object.hasOwn(OUTCOMES, p.outcome ?? "")) c.outcome = p.outcome;
      if (p.updates && typeof p.updates === "object") {
        for (const n of [1, 2, 3, 4]) if (n in p.updates) c.updates[n] = clean(p.updates[n], 500);
      }
      if (Array.isArray(p.goals)) {
        c.goals = p.goals.slice(0, 12).map((g) => ({ text: clean(g?.text, 140), done: Boolean(g?.done) }));
      }
      return doc;
    }

    case "tryAgain": {
      need(ctx, "mod");
      const c = running(doc);
      c.tryAgain[c.week] = Math.max(0, (c.tryAgain[c.week] || 0) + (a.delta === -1 ? -1 : 1));
      return doc;
    }

    case "settings": {
      need(ctx, "creator");
      const patch = a.patch || {};
      for (const key of SETTINGS) {
        if (!(key in patch)) continue;
        const value = clean(patch[key], 300);
        if (key === "webhook" && value && !WEBHOOK_RE.test(value)) throw new ActionError(400, "That is not a Discord webhook URL.");
        if (key === "logoUrl" && value && !value.startsWith("https://")) throw new ActionError(400, "Logo URL must start with https://");
        if (key === "discordUrl" && value && !DISCORD_RE.test(value)) throw new ActionError(400, "That is not a Discord invite link.");
        if (key === "palette" && !PALETTE_KEYS.includes(value)) throw new ActionError(400, "That is not one of the colour ways.");
        doc.settings[key] = key === "twitch" ? value.toLowerCase().replace(/[^a-z0-9_]/g, "") : value;
      }
      return doc;
    }

    case "mods": {
      need(ctx, "creator");
      if (!Array.isArray(a.logins)) throw new ActionError(400, "Send a list of Twitch logins.");
      // The whole list is replaced by whatever the browser sent, so a tab opened
      // before a mod was removed puts them back on save. Saving is only allowed
      // from a view of the list that is still current.
      if (Array.isArray(a.prev)) {
        const was = [...new Set(a.prev.map((l) => clean(l, 25).toLowerCase().replace(/[^a-z0-9_]/g, "")).filter(Boolean))];
        if (was.join(",") !== doc.mods.join(",")) {
          throw new ActionError(409, "The mod list changed somewhere else. Reload and try again.");
        }
      }
      doc.mods = [...new Set(a.logins.map((l) => clean(l, 25).toLowerCase().replace(/[^a-z0-9_]/g, "")).filter(Boolean))];
      return doc;
    }

    case "lock": {
      need(ctx, "creator");
      if (doc.draw) throw new ActionError(409, "The pool is already locked.");
      const pool = doc.ideas
        .filter((i) => i.status === "approved")
        .map((i) => ({ id: i.id, title: i.title, votes: i.votes.length, weight: weight(i.votes.length) }));
      if (pool.length < 2) throw new ActionError(409, "Approve at least 2 ideas first.");
      doc.draw = { status: "locked", pool, lockedAt: ctx.now, winnerId: null };
      return doc;
    }

    case "unlock": {
      need(ctx, "creator");
      if (doc.draw?.status !== "locked") throw new ActionError(409, "Nothing to unlock.");
      doc.draw = null;
      return doc;
    }

    case "spin": {
      need(ctx, "creator");
      if (doc.draw?.status !== "locked") throw new ActionError(409, "Lock the pool before spinning.");
      doc.draw.winnerId = pickWeighted(doc.draw.pool, ctx.random()).id;
      doc.draw.status = "revealed";
      doc.draw.spunAt = ctx.now;
      return doc;
    }

    case "confirm": {
      need(ctx, "creator");
      if (doc.draw?.status !== "revealed") throw new ActionError(409, "Spin the wheel first.");
      const idea = findIdea(doc, doc.draw.winnerId);
      const c = doc.current;
      if (c) {
        doc.archive.unshift({
          month: c.month,
          title: c.title,
          outcome: c.outcome === "active" ? "ungraded" : c.outcome,
          summary: c.updates[4] || c.updates[c.week] || "",
          links: c.links,
          tryAgains: tryAgainTotal(c),
          along: c.along.length,
        });
      }
      idea.status = "selected";
      doc.current = {
        month: sydneyMonth(ctx.now),
        title: idea.title,
        description: idea.description,
        week: 1,
        outcome: "active",
        passCondition: "",
        goals: [],
        updates: { 1: "", 2: "", 3: "", 4: "" },
        tryAgain: { 1: 0, 2: 0, 3: 0, 4: 0 },
        along: [],
        links: "",
      };
      doc.drawLog.unshift({ result: "confirmed", pool: doc.draw.pool, winnerId: idea.id, winnerTitle: idea.title, at: ctx.now, by: ctx.me });
      doc.draw = null;
      return doc;
    }

    case "void": {
      need(ctx, "creator");
      if (doc.draw?.status !== "revealed") throw new ActionError(409, "Nothing to void.");
      const reason = clean(a.reason, 200);
      if (!reason) throw new ActionError(400, "Give a reason for voiding the result.");
      const winner = doc.draw.pool.find((p) => p.id === doc.draw.winnerId);
      doc.drawLog.unshift({ result: "void", reason, pool: doc.draw.pool, winnerId: winner?.id, winnerTitle: winner?.title, at: ctx.now, by: ctx.me });
      doc.draw.status = "locked";
      doc.draw.winnerId = null;
      return doc;
    }

    case "apply": {
      need(ctx);
      if (doc.partners.includes(ctx.me)) throw new ActionError(409, "You are already LARPing along as a partner.");
      if (doc.applications.some((p) => p.login === ctx.me && p.status === "pending")) {
        throw new ActionError(409, "Your application is already with the mods.");
      }
      const vod = clean(a.vod, 300);
      if (!VOD_RE.test(vod)) throw new ActionError(400, "Paste a Twitch VOD or clip link showing you doing the LARP.");
      doc.applications.unshift({
        id: ctx.id(),
        login: ctx.me,
        vod,
        note: clean(a.note, 280),
        status: "pending",
        reason: "",
        createdAt: ctx.now,
        decidedAt: "",
        decidedBy: "",
      });
      ctx.notice = "Sent. A mod watches your VOD before the partner panel opens.";
      return doc;
    }

    case "review": {
      need(ctx, "mod");
      if (a.decision !== "approved" && a.decision !== "rejected") throw new ActionError(400, "Approve it or reject it.");
      const app = doc.applications.find((p) => p.id === a.id);
      if (!app) throw new ActionError(404, "Application not found.");
      if (app.status !== "pending") throw new ActionError(409, "That application was already decided.");
      app.status = a.decision;
      app.reason = a.decision === "rejected" ? clean(a.reason, 200) : "";
      app.decidedAt = ctx.now;
      app.decidedBy = ctx.me;
      if (a.decision === "approved" && !doc.partners.includes(app.login)) doc.partners.push(app.login);
      doc.modLog = [{ at: ctx.now, by: ctx.me, action: `${a.decision} partner`, ideaId: app.id, title: `@${app.login}` }, ...doc.modLog].slice(0, 200);
      return doc;
    }

    case "partnerTick": {
      need(ctx);
      if (!doc.partners.includes(ctx.me)) throw new ActionError(403, "Approved partners only.");
      const c = running(doc);
      const sheet = checklistFor(doc, ctx.me);
      if (a.kind === "week") {
        if (!Number.isInteger(a.index) || a.index < 1 || a.index > WEEKS.length) {
          throw new ActionError(400, `Pick a week from 1 to ${WEEKS.length}.`);
        }
        sheet.weeks = toggle(sheet.weeks, a.index);
      } else if (a.kind === "goal") {
        if (!Number.isInteger(a.index) || a.index < 0 || a.index >= c.goals.length) {
          throw new ActionError(400, "That goal is not on this month's list.");
        }
        sheet.goals = toggle(sheet.goals, a.index);
      } else {
        throw new ActionError(400, "Tick a week or a goal.");
      }
      doc.checklists[ctx.me] = sheet;
      return doc;
    }

    case "sample": {
      need(ctx, "creator");
      return { ...blank(), ...seed(), mods: doc.mods, seen: doc.seen, accounts: doc.accounts };
    }

    case "blank": {
      need(ctx, "creator");
      return { ...blank(), mods: doc.mods, seen: doc.seen, accounts: doc.accounts, settings: doc.settings };
    }

    default:
      throw new ActionError(400, "Unknown action.");
  }
}

export function publicView(doc, version, me, role, now = Date.now()) {
  const priv = privileged(role);
  const ideas = doc.ideas
    .filter((i) => priv || i.author === me || i.status === "approved" || i.status === "selected")
    .map(({ votes, author, ...idea }) => ({
      ...idea,
      author: idea.anonymous && !priv && author !== me ? null : author,
      votes: votes.length,
      voted: Boolean(me) && votes.includes(me),
      mine: Boolean(me) && author === me,
    }));

  const settings = { ...doc.settings, spinDate: upcomingSpin(doc.settings.spinDate, doc.settings.spinTime, now) };
  const { webhook, viewersBefore, viewersNow, ...open } = settings;
  const partner = Boolean(me) && doc.partners.includes(me);
  const mine = me ? doc.applications.find((p) => p.login === me) : null;
  const view = {
    version,
    me: me ? { login: me, role, partner, application: mine ? { status: mine.status, reason: mine.reason } : null } : null,
    ideas,
    current: doc.current,
    archive: doc.archive,
    partners: doc.partners,
    checklist: partner ? checklistFor(doc, me) : null,
    settings: role === "creator" ? settings : priv ? { ...open, viewersBefore, viewersNow } : open,
    draw: doc.draw && (role === "creator" ? doc.draw : { status: "locked" }),
  };

  if (priv) {
    const votes = doc.ideas.flatMap((i) => i.votes);
    Object.assign(view, {
      drawLog: doc.drawLog,
      mods: doc.mods,
      applications: doc.applications,
      stats: { signIns: doc.seen.length, votes: votes.length, voters: new Set(votes).size },
    });
  }
  return view;
}
