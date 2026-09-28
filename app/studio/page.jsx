"use client";

import Link from "next/link";
import { useState } from "react";
import { act, setNotice, useDb } from "@/lib/store";
import { signIn } from "@/lib/twitch";
import { OUTCOMES, WEEKS, rankFor, tryAgainTotal } from "@/lib/logic";
import { DEFAULT_PALETTE, PALETTES, PALETTE_KEYS } from "@/lib/palettes";
import DiscordCard from "@/components/DiscordCard";
import { ask } from "@/components/Ask";
import { Btn, Card, Field, H2, Loading, field, label } from "@/components/ui";

function Stat({ value, children }) {
  return (
    <div className="rounded-2xl border-2 border-line bg-panel p-4">
      <p className="font-bungee text-3xl text-lime">{value}</p>
      <p className="mt-1 text-sm text-mist">{children}</p>
    </div>
  );
}

export default function Studio() {
  const [asMod, setAsMod] = useState(false);
  const db = useDb();
  if (!db) return <Loading />;

  const role = db.me?.role;
  if (role !== "creator" && role !== "mod") {
    return (
      <main className="mx-auto max-w-6xl px-4 py-24">
        <h1 className="font-display text-5xl font-extrabold">Studio is for Jelarp and the mods.</h1>
        <p className="mt-3 text-lg text-mist">
          {db.me ? `@${db.me.login} is not on the mod list.` : "Sign in with the Twitch account that runs the channel."}
        </p>
        {!db.me && <Btn className="mt-6" onClick={() => signIn()}>Sign in with Twitch</Btn>}
      </main>
    );
  }

  const isCreator = role === "creator";
  // A view switch, not a permission drop: the server still accepts creator actions from him.
  const creator = isCreator && !asMod;
  const c = db.current;
  const st = db.settings;
  const pending = db.ideas.filter((i) => i.status === "pending");
  const approved = db.ideas.filter((i) => i.status === "approved");
  const rejected = db.ideas.filter((i) => i.status === "rejected").length;
  const apps = db.applications ?? [];
  const pendingApps = apps.filter((p) => p.status === "pending");
  const decidedApps = apps.filter((p) => p.status !== "pending");
  const before = Number(st.viewersBefore);
  const now = Number(st.viewersNow);
  const lift = before > 0 && now > 0 ? Math.round(((now - before) / before) * 100) : null;
  const patch = (p) => act("current", { patch: p });
  const setting = (key) => (value) => act("settings", { patch: { [key]: value } });

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="font-display text-5xl font-extrabold md:text-6xl">Studio</h1>
          <p className="mt-2 text-mist">
            Signed in as @{db.me.login}, {isCreator ? "creator" : "mod"}.
          </p>
          {isCreator && (
            <>
              <div className="mt-3 inline-flex rounded-full border-2 border-line p-1">
                {[["Creator", false], ["Mod view", true]].map(([name, value]) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={asMod === value}
                    onClick={() => setAsMod(value)}
                    className={`rounded-full px-3.5 py-1 text-sm font-bold transition-colors ${asMod === value ? "bg-lime text-ink" : "text-mist hover:text-bone"}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {asMod && <p className="mt-2 text-sm text-mist">Showing only what a mod sees. Your account still has creator powers.</p>}
            </>
          )}
        </div>
        {creator && <Link href="/draw" className="btn btn-lime">Open the wheel</Link>}
      </div>

      <section>
        <H2>Is it working?</H2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <Stat value={db.stats.signIns}>signed in with Twitch</Stat>
          <Stat value={approved.length}>
            ideas on the board ({pending.length} waiting, {rejected} rejected)
          </Stat>
          <Stat value={db.stats.votes}>
            votes from {db.stats.voters} {db.stats.voters === 1 ? "viewer" : "viewers"}
          </Stat>
          <Stat value={c?.along.length ?? 0}>LARPing along</Stat>
          <Stat value={db.partners.length}>
            partner creators ({pendingApps.length} waiting)
          </Stat>
          <Stat value={c ? tryAgainTotal(c) : 0}>Try Agains this month</Stat>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4 rounded-2xl border-2 border-line bg-panel p-4">
          {creator && (
            <>
              <label className="block w-44">
                <span className={label}>Avg viewers before</span>
                <Field type="number" min="0" value={st.viewersBefore} onSave={setting("viewersBefore")} />
              </label>
              <label className="block w-44">
                <span className={label}>Avg viewers this month</span>
                <Field type="number" min="0" value={st.viewersNow} onSave={setting("viewersNow")} />
              </label>
            </>
          )}
          <p className="pb-2 font-bold">
            {lift === null ? "Add viewer numbers from before and during to see the change." : `${before} to ${now} average viewers: ${lift >= 0 ? "+" : ""}${lift}%`}
          </p>
        </div>
      </section>

      <Card>
        <H2>Waiting for approval ({pending.length})</H2>
        {pending.length === 0 && <p className="text-mist">Queue is empty.</p>}
        <ul className="space-y-3">
          {pending.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-raised p-4">
              <div className="mr-auto">
                <p className="font-bold">{i.title}</p>
                {i.description && <p className="text-sm text-mist">{i.description}</p>}
                <p className="text-xs text-mist">
                  by @{i.author}
                  {i.anonymous && " (shows as Anonymous)"}
                </p>
              </div>
              <Btn variant="lime" onClick={() => act("approve", { id: i.id })}>Approve</Btn>
              <Btn
                variant="ghost"
                onClick={async () => {
                  const reason = await ask({
                    title: `Reject "${i.title}"?`,
                    body: "It leaves the queue and never shows on the board.",
                    input: { label: "Reason (optional)", placeholder: "Not safe to do on stream" },
                    confirm: "Reject",
                    danger: true,
                  });
                  if (reason !== null) act("reject", { id: i.id, reason });
                }}
              >
                Reject
              </Btn>
            </li>
          ))}
        </ul>
      </Card>

      {/* R-23: mods review these alongside the creator, same as ideas. */}
      <Card>
        <H2>Creators applying ({pendingApps.length})</H2>
        <p className="mb-4 text-mist">
          The bar is proof they are doing it, not how good it is. Watch the VOD, and if they are actually running the LARP, approve them.
        </p>
        {pendingApps.length === 0 && <p className="text-mist">Nothing waiting.</p>}
        <ul className="space-y-3">
          {pendingApps.map((p) => (
            <li key={p.id} className="rounded-xl bg-raised p-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="mr-auto font-bold">@{p.login}</p>
                <a href={p.vod} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                  Watch the VOD ↗
                </a>
                <Btn variant="lime" className="btn-sm" onClick={() => act("review", { id: p.id, decision: "approved" })}>
                  Approve
                </Btn>
                <Btn
                  variant="ghost"
                  className="btn-sm"
                  onClick={async () => {
                    const reason = await ask({
                      title: `Turn down @${p.login}?`,
                      body: "They see the reason on the site and can apply again.",
                      input: { label: "Reason (optional)", placeholder: "That VOD is a different challenge" },
                      confirm: "Reject",
                      danger: true,
                    });
                    if (reason !== null) act("review", { id: p.id, decision: "rejected", reason });
                  }}
                >
                  Reject
                </Btn>
              </div>
              {p.note && <p className="mt-2 text-sm text-mist">{p.note}</p>}
              <p className="mt-1 break-all text-xs text-mist">{p.vod}</p>
            </li>
          ))}
        </ul>

        {decidedApps.length > 0 && (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-bold text-mist">Already decided ({decidedApps.length})</summary>
            <ul className="mt-3 space-y-1 text-sm">
              {decidedApps.map((p) => (
                <li key={p.id}>
                  <b className={p.status === "approved" ? "text-lime" : "text-pink"}>{p.status === "approved" ? "In" : "Out"}</b>: @{p.login}
                  {p.decidedBy && <span className="text-mist"> by @{p.decidedBy}</span>}
                  {p.reason && <span className="text-mist"> ({p.reason})</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {c && (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <p className="mr-auto">
              <span className="font-bungee text-3xl text-pink">{c.tryAgain[c.week]}</span> Try Again redemptions in week {c.week} of{" "}
              <b>{c.title}</b>
            </p>
            <Btn variant="ghost" aria-label="Remove one Try Again" onClick={() => act("tryAgain", { delta: -1 })}>-1</Btn>
            <Btn variant="pink" onClick={() => act("tryAgain", { delta: 1 })}>+1 Try Again</Btn>
          </div>
        </Card>
      )}

      {creator && !c && (
        <Card>
          <H2>No LARP running yet</H2>
          <p className="text-mist">Approve at least 2 ideas, then open the wheel to lock, spin and confirm the first LARP.</p>
        </Card>
      )}

      {creator && c && (
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-extrabold">This month's LARP</h2>
            <span className="rounded-full bg-pink px-3 py-1 text-sm font-bold text-ink">Rank: {rankFor(c)}</span>
          </div>
          <p className="text-sm text-mist">Text saves when you click out of a box.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Skill or challenge</span>
              <Field value={c.title} onSave={(v) => patch({ title: v })} />
            </label>
            <label className="block">
              <span className={label}>Status</span>
              <select className={field} value={c.outcome} onChange={(e) => patch({ outcome: e.target.value })}>
                {Object.entries(OUTCOMES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className={label}>Description</span>
            <Field as="textarea" rows={2} value={c.description} onSave={(v) => patch({ description: v })} />
          </label>

          <fieldset>
            <legend className={label}>Current week</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKS.map((w, i) => (
                <Btn key={w.name} variant={c.week === i + 1 ? "lime" : "ghost"} aria-pressed={c.week === i + 1} onClick={() => patch({ week: i + 1 })}>
                  {i + 1}. {w.name}
                </Btn>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className={label}>Pass condition</span>
            <Field as="textarea" rows={2} value={c.passCondition} onSave={(v) => patch({ passCondition: v })} />
          </label>

          <div>
            <span className={label}>Goals</span>
            <ul className="space-y-2">
              {c.goals.map((g, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-lime"
                    aria-label={`Goal ${i + 1} done`}
                    checked={g.done}
                    onChange={(e) => patch({ goals: c.goals.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })}
                  />
                  <Field aria-label={`Goal ${i + 1}`} value={g.text} onSave={(v) => patch({ goals: c.goals.map((x, j) => (j === i ? { ...x, text: v } : x)) })} />
                  <Btn variant="ghost" aria-label={`Remove goal ${i + 1}`} onClick={() => patch({ goals: c.goals.filter((_, j) => j !== i) })}>
                    ✕
                  </Btn>
                </li>
              ))}
            </ul>
            <Btn variant="ghost" className="mt-3" onClick={() => patch({ goals: [...c.goals, { text: "", done: false }] })}>
              + Add goal
            </Btn>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {WEEKS.map((w, i) => (
              <label key={w.name} className="block">
                <span className={label}>
                  Week {i + 1} update: {w.name}
                </span>
                <Field as="textarea" rows={2} value={c.updates[i + 1]} onSave={(v) => patch({ updates: { [i + 1]: v } })} />
              </label>
            ))}
          </div>

          <label className="block">
            <span className={label}>Links, one per line: Title | https://...</span>
            <Field as="textarea" rows={3} className="font-mono text-sm" value={c.links} onSave={(v) => patch({ links: v })} />
          </label>
        </Card>
      )}

      {creator && c && (
        <Card>
          <H2>Discord update card</H2>
          <DiscordCard current={c} site={st.siteUrl} />
        </Card>
      )}

      {creator && (
        <Card>
          <H2>On stream</H2>
          <p className="mb-4 text-mist">
            In OBS, add a Browser source, paste the URL and set it to 1920 by 1080. It shows this month's LARP, the week, Try Agains and the ideas leading
            the vote.
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              ["Copy overlay URL", ""],
              ["Copy green screen URL", "?bg=green"],
            ].map(([text, query]) => (
              <Btn
                key={text}
                variant={query ? "ghost" : "lime"}
                onClick={() =>
                  navigator.clipboard
                    .writeText(`${location.origin}/overlay${query}`)
                    .then(() => setNotice("Overlay URL copied."), () => setNotice(`Copy blocked. The URL is ${location.origin}/overlay${query}`))
                }
              >
                {text}
              </Btn>
            ))}
            <a href="/overlay" target="_blank" rel="noreferrer" className="btn btn-ghost">
              Preview
            </a>
          </div>
        </Card>
      )}

      {creator && (
        <Card>
          <H2>Settings</H2>
          <p className="-mt-2 mb-4 text-sm text-mist">There is no save button. Every box saves as soon as you click out of it, and a message confirms it.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Twitch channel for the live embed</span>
              <Field value={st.twitch} placeholder="channel_name" onSave={setting("twitch")} />
            </label>
            <label className="block">
              <span className={label}>Logo image URL</span>
              <Field value={st.logoUrl} placeholder="https://..." onSave={setting("logoUrl")} />
            </label>
            <label className="block">
              <span className={label}>Discord invite link</span>
              <Field value={st.discordUrl} placeholder="https://discord.gg/..." onSave={setting("discordUrl")} />
              <span className="mt-1.5 block text-xs text-mist">Shows as the Join the Discord button on the front page.</span>
            </label>
            <label className="block">
              <span className={label}>Next spin date</span>
              <Field type="date" value={st.spinDate} onSave={setting("spinDate")} />
              <span className="mt-1.5 block text-xs text-mist">Set it once. Six hours after the spin time passes, it moves to the same slot next month, like first Monday to first Monday.</span>
            </label>
            <label className="block">
              <span className={label}>Next spin time (Sydney)</span>
              <Field type="time" value={st.spinTime} onSave={setting("spinTime")} />
            </label>
            <label className="block">
              <span className={label}>Site link on the Discord card</span>
              <Field value={st.siteUrl} placeholder="jelarp.com" onSave={setting("siteUrl")} />
            </label>
            <label className="block">
              <span className={label}>Discord webhook URL</span>
              <Field type="password" autoComplete="off" value={st.webhook} placeholder="https://discord.com/api/webhooks/..." onSave={setting("webhook")} />
              <span className="mt-1.5 block text-xs text-mist">In Discord: Server Settings, Integrations, Webhooks. Only the creator can see this.</span>
            </label>
            <label className="block sm:col-span-2">
              <span className={label}>Mods (Twitch logins, comma separated)</span>
              {/* prev is the list this field was drawn from. The server refuses the save
                  if it has moved on, so a tab left open cannot put a removed mod back. */}
              <Field value={db.mods.join(", ")} placeholder="mod_one, mod_two" onSave={(v) => act("mods", { logins: v.split(","), prev: db.mods })} />
            </label>
            <label className="block sm:col-span-2">
              <span className={label}>Let a Twitch name sign in again</span>
              <Field
                value=""
                placeholder="their_twitch_name"
                onSave={(v) => v.trim() && act("forgetAccount", { login: v.trim() })}
              />
              <span className="mt-1.5 block text-xs text-mist">
                Only needed if someone is told their name belonged to a different account here,
                which happens when a Twitch handle changes owners.
              </span>
            </label>
            {/* R-37: Orchi picks the palette himself, from ways that are guaranteed to sit together. */}
            <div className="sm:col-span-2">
              <span className={label}>Colour way</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {PALETTE_KEYS.map((key) => {
                  const way = PALETTES[key];
                  const on = (st.palette || DEFAULT_PALETTE) === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      title={way.note}
                      aria-pressed={on}
                      onClick={() => setting("palette")(key)}
                      className={`flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-bold ${on ? "border-lime text-lime" : "border-line text-mist hover:border-bone hover:text-bone"}`}
                    >
                      <span aria-hidden className="flex">
                        {["ink", "lime", "grape", "pink"].map((t) => (
                          <span key={t} className="-ml-1 h-4 w-4 rounded-full border-2 border-ink first:ml-0" style={{ background: way.tokens[t] }} />
                        ))}
                      </span>
                      {way.name}
                    </button>
                  );
                })}
              </div>
              <span className="mt-1.5 block text-xs text-mist">Changes the colours for everyone, straight away.</span>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <H2>On the board ({approved.length})</H2>
        {approved.length === 0 && <p className="text-mist">Nothing approved yet.</p>}
        <ul className="space-y-2">
          {approved.map((i) => (
            <li key={i.id} className="flex items-center gap-3">
              <span className="mr-auto">
                {i.title}{" "}
                <span className="text-sm text-mist">
                  ({i.votes} votes, by @{i.author})
                </span>
              </span>
              <Btn variant="ghost" className="btn-sm" onClick={() => act("hide", { id: i.id })}>Remove</Btn>
            </li>
          ))}
        </ul>
      </Card>

      {db.drawLog.length > 0 && (
        <Card>
          <H2>Draw history</H2>
          <ul className="space-y-1 text-sm">
            {db.drawLog.map((d, i) => (
              <li key={i}>
                <b>{d.result === "void" ? "Voided" : "Confirmed"}</b>: {d.winnerTitle} from {d.pool.length} ideas, by @{d.by}
                {d.reason && <span className="text-mist"> (reason: {d.reason})</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {creator && (
        <Card>
          <H2>Data</H2>
          <p className="mb-4 text-mist">For rehearsals. Sign-ins, mods and settings are kept either way. Partners are not.</p>
          <div className="flex flex-wrap gap-3">
            <Btn
              variant="ghost"
              onClick={async () =>
                (await ask({
                  title: "Load sample data?",
                  body: "Every idea, vote, LARP, partner and archive entry gets replaced with sample content. Sign-ins, mods and settings stay.",
                  confirm: "Load sample data",
                  danger: true,
                })) && act("sample")
              }
            >
              Load sample data
            </Btn>
            <Btn
              variant="ghost"
              onClick={async () =>
                (await ask({
                  title: "Clear everything?",
                  body: "Every idea, vote, LARP, partner and archive entry gets deleted. This cannot be undone.",
                  confirm: "Clear everything",
                  danger: true,
                })) && act("blank")
              }
            >
              Clear everything
            </Btn>
          </div>
        </Card>
      )}
    </main>
  );
}
