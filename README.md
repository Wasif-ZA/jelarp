# Jelarp of All Trades

Site for Orchi's monthly LARP series. Chat suggests a skill and votes on it. A weighted wheel picks
one on the first stream of the month. Then 4 weeks: pick and plan, learn, test, pass the challenge.
Everything on the site comes from real signed-in users and is shared by every visitor.

Specs and the source call live in `clients/orchi/docs/`, not here. Pending changes:
[[clients/orchi/docs/spec-jelarp-v1.1-changes]].

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npm run check   # logic and reducer checks
```

## Demo

With no Supabase or Twitch settings, `npm run dev` starts as a demo: sample ideas, a LARP in week 2
and two archived months, all in the dev server's memory. Sign in with any username. Sign in as
`creator` (set in `.env.local`) to reach Studio, the wheel and the overlay. Every browser pointed at
this dev server sees the same board, and a restart brings the sample back. A Vercel deploy needs
Supabase, because serverless copies of the app do not share memory.

Name sign-in and the built-in session secret only work in the demo. Once `SUPABASE_URL` is set, even
locally, sign-in needs the Twitch app and `SESSION_SECRET` must be set.

Vercel servers do not share memory, so the Vercel demo link uses `NEXT_PUBLIC_DEMO=1` instead. The
whole site then runs in the visitor's browser and saves to localStorage. Sign-in asks for a name and a
role (Creator, Mod or Viewer), each browser keeps its own copy, Discord posting is off, and "Reset
demo" in the footer brings the sample back. To go live, delete `NEXT_PUBLIC_DEMO` in Vercel, add the
variables in "Go live", and redeploy.

## How it works

- Every open page reads the same state from `/api/state` every 15 seconds, and every 4 seconds while
  the draw is locked.
- Every change goes through `/api/action`. `lib/reduce.js` checks who is asking and what their role
  allows, then `lib/db.js` saves it with a version check so two writes cannot overwrite each other.
- Twitch sign-in hands the token to `/api/auth`, which checks it with Twitch and sets an httpOnly
  signed cookie. The token itself is not kept.
- Roles: logins in `CREATOR_LOGINS` are creators. The creator names mods in Studio. Everyone else is
  a viewer.
- Public visitors never receive: other people's pending ideas, anonymous authors, who voted,
  sign-in names, draw odds, the winner before it is confirmed, or the Discord webhook.
- The server picks the wheel's winner with `crypto.randomInt`. The wheel animates to that result.
- The server posts the Discord card, so the webhook URL never reaches a browser.

## Screens

| Route | Who | What |
|---|---|---|
| `/` | Everyone | This month's LARP and rank, live wheel with countdown, the 4-week quest, pass condition, days left in the cycle, LARP along, the three creator buttons, Twitch embed |
| `/board` | Everyone, sign in to act | Suggest a skill (anonymous option), vote, see your ideas' status |
| `/archive` | Everyone | Hall of LARPs with outcome stamps and YouTube embeds |
| `/studio` | Creator and mods | Mods: stats, approvals, Try Again. Creator also: month editor, Discord card, settings, mod list, rehearsal data |
| `/draw` | Creator | Lock, spin, confirm or void, Stream view |
| `/partner` | Approved partners | Their own copy of the 4-week quest and this month's goals, ticked per account and reset each cycle |
| `/overlay` | OBS | Browser source: current LARP, week, rank, Try Agains, top 3 ideas. Add `?bg=green` for chroma key |

## Partner creators

Other streamers can run the same monthly LARP on their own channel. They apply from the front page
with a link to a Twitch VOD or clip of themselves doing it, and a mod watches it. The bar is proof
they are actually doing it, not how good they are.

Approved partners get `/partner`, which is their own copy of the 4-week quest and this month's
goals. The LARP itself is Orchi's; partners cannot change it or run their own. Ticks are per
account per cycle and start fresh when the wheel picks the next one.

`/api/live` returns the partner list with live state from Twitch Helix, cached 60 seconds. Without
`TWITCH_CLIENT_SECRET` the list still renders, just with no avatars and no live dots.

## How the draw works

Each approved idea gets `1 + votes` tickets. Its chance is its tickets over all tickets.

Example: votes 5, 2, 0, 0 give tickets 6, 3, 1, 1. Total is 6 + 3 + 1 + 1 = 11. Chances are
6/11 = 55%, 3/11 = 27%, and 1/11 = 9% for each zero-vote idea.

## Runs itself

- **Spin date:** set it once in Studio. When a spin is more than 6 hours past, the site moves it to the
  same slot next month (first Monday stays first Monday). Every viewer's countdown uses Sydney time.
- **Database:** Supabase's free plan pauses a project after a week with little database activity.
  `vercel.json` reads `/api/state` twice a day on a cron, so the site never goes quiet long enough.
- **Builds:** package versions are pinned and `package-lock.json` is committed, so a rebuild on Vercel
  gives the same site.
- **Month, rank, archive and odds** all come from the data, not from dates in the code.

Orchi's monthly jobs, all in Studio: approve ideas, click the week, grade the month, count Try Agains,
post the Discord card, then lock, spin and confirm on the first stream. Sign-in lasts 30 days.

Wasif only needs to touch Vercel if the creator's Twitch login changes (`CREATOR_LOGINS`).

## Go live

1. Supabase: create a project, open SQL Editor and run `db/schema.sql`. From Project Settings, API,
   copy the Project URL and the `service_role` (secret) key.
2. Twitch: register an app at https://dev.twitch.tv/console/apps. Add `http://localhost:3000/` and
   the live URL, both with a trailing slash, as OAuth Redirect URLs. Copy the Client ID.
3. Vercel: import this folder and set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SESSION_SECRET`,
   `CREATOR_LOGINS`, `NEXT_PUBLIC_TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` (see `.env.example`),
   and delete `NEXT_PUBLIC_DEMO`. Deploy. The daily cron
   in `vercel.json` turns on by itself.
   Run `npm run env` first to check the same values in `.env.local`: it reads the Supabase row and
   asks Twitch for a token, so it says either "Ready to go live" or exactly what is wrong.
4. Sign in on the live site as the creator. In Studio set the Twitch channel, next spin date, mods
   and Discord webhook.
5. Domain: buy it through Cloudflare (about $13 the first year), point it at Vercel, and add it to
   the Twitch redirect URLs.

## Limits

- State is one JSON row with a version check. If write conflicts appear near the 500-viewer target,
  move votes into their own table.
- Each open tab calls `/api/state` about 240 times an hour (900 during a draw). Vercel Hobby includes
  1 million function calls a month and pauses the project past that. Example: 18 viewers with the site
  open 3 hours a stream, 12 streams a month is 18 x 3 x 12 x 240 = 155,520 calls. Near the 500-viewer
  target, cache `/api/state` for a few seconds or move to Vercel Pro.
- Sign out clears the cookie in that browser. A copied cookie stays valid until it expires after 30
  days.
- Try Again is counted by hand in Studio. Wiring it to channel points needs Twitch EventSub.
- Auto-reject is a keyword list in `lib/logic.js`; mods catch the rest.
- Twitch sign-in sends an empty scope because only the login is needed. If Twitch rejects that,
  send `user:read:email`.
