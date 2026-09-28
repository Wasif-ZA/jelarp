"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { act, useDb } from "@/lib/store";
import { signIn } from "@/lib/twitch";
import { RANKS, WEEKS, monthLabel, parseLinks, rankFor, weight } from "@/lib/logic";
import Wheel, { slices } from "@/components/Wheel";
import Countdown, { useCycleLeft } from "@/components/Countdown";
import { ApplicationStatus, PartnerList, applyToJoin } from "@/components/Partners";
import { Loading } from "@/components/ui";

const BUBBLES = ["bg-lime", "bg-pink", "bg-cyan", "bg-orange", "bg-bone"];
const TILT = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2"];

export default function Home() {
  const db = useDb();
  const [host, setHost] = useState(null);
  const [showPartners, setShowPartners] = useState(false);
  useEffect(() => setHost(location.hostname), []);
  const cycle = useCycleLeft(db?.settings.spinDate, db?.settings.spinTime);
  if (!db) return <Loading />;

  const { current: c, settings } = db;
  const board = db.ideas
    .filter((i) => i.status === "approved")
    .map((i) => ({ id: i.id, title: i.title, weight: weight(i.votes) }));
  const parts = slices(board);
  const tickets = board.reduce((t, p) => t + p.weight, 0);
  const links = c ? parseLinks(c.links) : [];
  const joined = Boolean(c && db.me && c.along.includes(db.me.login));

  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="grid items-center gap-12 py-10 md:grid-cols-[1.1fr_1fr] md:py-16">
        {c ? (
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="-rotate-2 rounded-full border-2 border-bone px-3 py-1 text-sm font-bold">{monthLabel(c.month)}</span>
              <span className="rotate-1 rounded-full bg-pink px-3 py-1 text-sm font-bold text-ink">Rank: {rankFor(c)}</span>
              {/* R-01: days remaining sits in the hero. R-05 switches to hours on the last day, R-06 hands over at zero. */}
              <span className="-rotate-1 rounded-full border-2 border-lime px-3 py-1 text-sm font-bold text-lime">
                {cycle.loading
                  ? "Days left"
                  : !cycle.left
                    ? "Wheel spins next"
                    : cycle.left.lastDay
                      ? `Last day, ${cycle.left.value} ${cycle.left.unit} left`
                      : `${cycle.left.value} ${cycle.left.unit} remaining`}
              </span>
            </div>
            <p className="mt-6 font-bungee text-lg text-grape-text md:text-xl">This month Jelarp is LARPing</p>
            <h1
              className={`mt-2 break-words font-display font-extrabold leading-[0.95] tracking-tight text-lime ${c.title.length > 14 ? "text-5xl md:text-6xl" : "text-6xl md:text-8xl"}`}
            >
              {c.title}
            </h1>
            {c.description && <p className="mt-5 max-w-[42ch] text-lg text-mist">{c.description}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/board" className="btn btn-lime">Vote on next month</Link>
              {settings.twitch && <a href="#live" className="btn btn-ghost">Watch live</a>}
            </div>
          </div>
        ) : (
          <div>
            <p className="font-bungee text-lg text-grape-text md:text-xl">Jelarp of all trades</p>
            <h1 className="mt-3 font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
              One skill a month. <span className="text-lime">Chat picks it.</span>
            </h1>
            <p className="mt-5 max-w-[42ch] text-lg text-mist">Chat decides what Jelarp learns next. The wheel spins on the first stream of the month.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/board" className="btn btn-lime">Vote on next month</Link>
              {/* R-12: reachable before the first LARP too, otherwise the only way in is typing /partner. */}
              {db.me?.partner ? (
                <Link href="/partner" className="btn btn-ghost">Open your panel</Link>
              ) : (
                <button onClick={() => applyToJoin(db)} className="btn btn-ghost">Are you a creator?</button>
              )}
            </div>
            <ApplicationStatus />
          </div>
        )}

        <div className="mx-auto w-full max-w-md overflow-hidden text-center">
          {parts.length >= 2 ? (
            <Wheel parts={parts} svgClassName="spin-idle" />
          ) : (
            <p className="rounded-2xl border-2 border-dashed border-line p-10 text-mist">The wheel needs two approved ideas before it can spin.</p>
          )}
          <p className="mt-6 text-sm font-bold text-mist">{settings.spinDate ? "Next spin in" : "Next spin"}</p>
          <Countdown date={settings.spinDate} time={settings.spinTime} className="font-bungee text-3xl text-lime" />
          <p className="mt-1 text-sm text-mist">
            {board.length} {board.length === 1 ? "idea" : "ideas"}, {tickets} {tickets === 1 ? "ticket" : "tickets"} on the wheel
          </p>
        </div>
      </section>

      {c && (
        <>
          <section className="py-12">
            <h2 className="font-display text-4xl font-extrabold">The 4-week quest</h2>
            <div className="relative mt-8">
              <div aria-hidden className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-1 bg-line md:block">
                <div className="h-full bg-lime" style={{ width: `${((c.week - 1) / 3) * 100}%` }} />
              </div>
              <ol className="relative grid gap-6 md:grid-cols-4">
                {WEEKS.map((w, i) => {
                  const n = i + 1;
                  const done = n < c.week || c.outcome !== "active";
                  const now = n === c.week && c.outcome === "active";
                  return (
                    <li key={n}>
                      <div
                        className={`grid h-14 w-14 place-items-center rounded-full border-2 font-bungee text-xl md:mx-auto ${now ? "pulse-ring border-lime bg-lime text-ink" : done ? "border-lime bg-ink text-lime" : "border-line bg-ink text-mist"}`}
                      >
                        {done ? "✓" : n}
                      </div>
                      <div className={`mt-4 rounded-2xl border-2 p-5 ${now ? "border-lime bg-raised shadow-[6px_6px_0_var(--color-lime)]" : "border-line bg-panel"}`}>
                        <p className="text-xs font-bold text-grape-text">
                          Week {n}: {RANKS[i]}
                          {now && <span className="text-lime"> (you are here)</span>}
                          {done && <span className="sr-only"> (done)</span>}
                        </p>
                        <h3 className="mt-1 font-display text-2xl font-bold">{w.name}</h3>
                        <p className="mt-1 text-sm text-mist">{w.blurb}</p>
                        {c.updates[n] && <p className="mt-3 border-t-2 border-dashed border-line pt-3 text-sm">{c.updates[n]}</p>}
                        {c.tryAgain[n] > 0 && <p className="mt-3 text-sm font-bold text-pink">↻ Chat hit Try Again ×{c.tryAgain[n]}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          <section className="grid gap-6 py-12 md:grid-cols-3">
            <div className="rounded-2xl border-2 border-ink bg-lime p-7 text-ink shadow-[7px_7px_0_var(--color-grape)] md:col-span-2">
              <h2 className="font-bungee text-lg">To pass</h2>
              <p className="mt-3 font-display text-2xl font-bold leading-snug md:text-3xl">
                {c.passCondition || "Set live with chat on the Week 1 stream."}
              </p>
            </div>

            <div className="rotate-1 rounded-2xl border-2 border-ink bg-pink p-7 text-ink shadow-[7px_7px_0_var(--color-cyan)]">
              <h2 className="font-bungee text-lg">{cycle.left?.lastDay ? "Last day" : "Time left"}</h2>
              {cycle.loading ? (
                <p className="mt-1 font-bungee text-7xl leading-none">--</p>
              ) : cycle.left ? (
                <>
                  <p className="mt-1 font-bungee text-7xl leading-none">{cycle.left.value}</p>
                  <p className="mt-2 font-semibold">{cycle.left.unit} until the wheel picks the next one.</p>
                </>
              ) : (
                <p className="mt-3 font-display text-3xl font-bold leading-tight">This one is done. The wheel spins next.</p>
              )}
            </div>

            <div className="rounded-2xl border-2 border-line bg-panel p-7">
              <h2 className="font-display text-2xl font-bold">Goals</h2>
              {c.goals.length === 0 ? (
                <p className="mt-2 text-mist">Set on the Week 1 stream.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {c.goals.map((g, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 text-sm font-black ${g.done ? "border-lime bg-lime text-ink" : "border-line"}`}
                      >
                        {g.done ? "✓" : ""}
                      </span>
                      <span className={g.done ? "text-mist line-through" : ""}>
                        {g.text}
                        <span className="sr-only">{g.done ? " (done)" : " (not yet)"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col rounded-2xl border-2 border-ink bg-grape p-7 text-white shadow-[7px_7px_0_var(--color-lime)] md:col-span-2">
              <h2 className="font-display text-3xl font-extrabold">LARP along</h2>
              <p className="mt-2 max-w-[48ch] text-lg">Give {c.title} a go yourself this month and show us in the Discord.</p>
              <div className="mt-auto flex flex-wrap items-center gap-4 pt-6">
                <div className="flex">
                  {c.along.slice(0, 7).map((name, i) => (
                    <span
                      key={name}
                      title={name}
                      className={`-ml-2 grid h-11 w-11 place-items-center rounded-full border-2 border-grape text-sm font-black text-ink first:ml-0 ${BUBBLES[i % BUBBLES.length]}`}
                    >
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                  ))}
                </div>
                <p className="font-bold">
                  {c.along.length} {c.along.length === 1 ? "person" : "people"} in
                </p>
                <button
                  onClick={() => (db.me ? act("along") : signIn())}
                  aria-pressed={joined}
                  className={`btn ml-auto ${joined ? "btn-bone" : "btn-lime"}`}
                >
                  {joined ? "You're in ✓" : "I'm in"}
                </button>
              </div>

              {/* R-13: Orchi asked for these to sit with the Discord button. */}
              <div className="mt-5 flex flex-wrap items-center gap-3 border-t-2 border-dashed border-white/25 pt-5">
                {settings.discordUrl && (
                  <a href={settings.discordUrl} className="btn btn-bone">
                    Join the Discord
                  </a>
                )}
                <button onClick={() => setShowPartners((v) => !v)} aria-expanded={showPartners} className="btn btn-bone">
                  Check who else is LARPing
                </button>
                {db.me?.partner ? (
                  <Link href="/partner" className="btn btn-lime">
                    Open your panel
                  </Link>
                ) : (
                  <button onClick={() => applyToJoin(db)} className="btn btn-bone">
                    Are you a creator? Apply to join
                  </button>
                )}
                <ApplicationStatus />
              </div>
            </div>
          </section>

          {showPartners && (
            <section className="py-4">
              <h2 className="font-display text-3xl font-extrabold">Who else is LARPing</h2>
              <p className="mt-2 mb-6 text-mist">Creators running this month's LARP on their own channel. Anyone live sits at the top.</p>
              <PartnerList />
            </section>
          )}
        </>
      )}

      {(settings.twitch || links.length > 0) && (
        <section id="live" className="grid scroll-mt-24 items-center gap-8 py-12 md:grid-cols-[1.6fr_1fr]">
          {settings.twitch && (
            <div className="aspect-video overflow-hidden rounded-2xl border-2 border-grape bg-panel shadow-[7px_7px_0_var(--color-grape)]">
              {host && (
                <iframe
                  title={`${settings.twitch} live on Twitch`}
                  src={`https://player.twitch.tv/?channel=${encodeURIComponent(settings.twitch)}&parent=${host}&muted=true&autoplay=false`}
                  loading="lazy"
                  allowFullScreen
                  className="h-full w-full"
                />
              )}
            </div>
          )}
          <div>
            <h2 className="font-display text-4xl font-extrabold">Catch it live</h2>
            <p className="mt-3 text-lg text-mist">Every LARP happens on stream. The best bits go up on YouTube.</p>
            {links.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {links.map((l) => (
                  <a key={l.url + l.title} href={l.url} className="rounded-full border-2 border-line px-4 py-2 text-sm font-bold hover:border-lime">
                    {l.title} ↗
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid items-center gap-10 border-t-2 border-line py-16 md:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight md:text-5xl">
            The favourite usually wins. <span className="text-pink">Never always.</span>
          </h2>
          <p className="mt-4 max-w-[44ch] text-lg text-mist">Every idea starts with 1 ticket. Every vote adds 1 more. Zero votes still has a shot.</p>
          <ul className="mt-6 space-y-2 text-lg">
            <li><b className="text-lime">Suggest</b> a skill. A mod checks it first.</li>
            <li><b className="text-lime">Vote</b> for the ones you want to watch.</li>
            <li><b className="text-lime">Spin</b> on the first stream of the month.</li>
          </ul>
        </div>
        <div className="space-y-4">
          {[...board]
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 4)
            .map((p, i) => (
              <div key={p.id} className={`ticket flex items-center justify-between gap-4 bg-bone px-8 py-4 text-ink ${TILT[i]}`}>
                <span className="font-display text-xl font-bold">{p.title}</span>
                <span className="whitespace-nowrap font-bungee text-lg">{p.weight} {p.weight === 1 ? "ticket" : "tickets"}</span>
              </div>
            ))}
          <Link href="/board" className="btn btn-lime mt-2">Vote on next month</Link>
        </div>
      </section>
    </main>
  );
}
