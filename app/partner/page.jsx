"use client";

import Link from "next/link";
import { act, useDb } from "@/lib/store";
import { signIn } from "@/lib/twitch";
import { RANKS, WEEKS, monthLabel } from "@/lib/logic";
import { applyToJoin } from "@/components/Partners";
import { Btn, Loading } from "@/components/ui";

function Locked({ db }) {
  const status = db.me?.application?.status;
  const copy = !db.me
    ? "Sign in with the Twitch account you stream from."
    : status === "pending"
      ? "Your application is with the mods. This opens the moment one of them approves it."
      : status === "rejected"
        ? db.me.application.reason || "That application did not get through. You can apply again."
        : "This panel is for creators running this month's LARP on their own channel.";

  return (
    <main className="mx-auto max-w-3xl px-4 py-24">
      <p className="font-bungee text-lg text-grape-text">Partners only</p>
      <h1 className="mt-3 font-display text-5xl font-extrabold">Not open yet.</h1>
      <p className="mt-4 text-lg text-mist">{copy}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {!db.me ? (
          <Btn variant="grape" onClick={() => signIn()}>Sign in with Twitch</Btn>
        ) : status !== "pending" ? (
          <Btn variant="lime" onClick={() => applyToJoin(db)}>Apply to join</Btn>
        ) : null}
        <Link href="/" className="btn btn-ghost">Back to this month</Link>
      </div>
    </main>
  );
}

export default function Partner() {
  const db = useDb();
  if (!db) return <Loading />;
  // R-25: locked rather than hidden. The action refuses too, so this is not the only gate.
  if (!db.me?.partner) return <Locked db={db} />;

  const c = db.current;
  if (!c) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24">
        <h1 className="font-display text-5xl font-extrabold">No LARP is running.</h1>
        <p className="mt-4 text-lg text-mist">Your panel fills in once the wheel picks this month's skill.</p>
      </main>
    );
  }

  const sheet = db.checklist ?? { weeks: [], goals: [] };
  const weeksDone = sheet.weeks.length;
  const tick = (kind, index) => act("partnerTick", { kind, index });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <p className="font-bungee text-lg text-grape-text">Your partner panel</p>
          <h1 className="mt-2 font-display text-5xl font-extrabold md:text-6xl">{c.title}</h1>
          <p className="mt-3 text-mist">
            {monthLabel(c.month)}, running as @{db.me.login}. Same LARP as everyone else.
          </p>
        </div>
        <span className="rounded-full bg-lime px-4 py-1.5 font-bold text-ink">{weeksDone} of {WEEKS.length} weeks done</span>
      </div>

      {c.description && <p className="mt-6 max-w-[60ch] text-lg text-mist">{c.description}</p>}

      <section className="mt-10">
        <h2 className="font-display text-3xl font-extrabold">The 4-week quest</h2>
        <p className="mt-2 text-mist">Tick each week off as you do it on your own channel.</p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2">
          {WEEKS.map((w, i) => {
            const n = i + 1;
            const done = sheet.weeks.includes(n);
            return (
              <li key={w.name}>
                <button
                  onClick={() => tick("week", n)}
                  aria-pressed={done}
                  className={`flex w-full items-start gap-4 rounded-2xl border-2 p-5 text-left transition-colors ${done ? "border-lime bg-raised" : "border-line bg-panel hover:border-grape"}`}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 font-bungee ${done ? "border-lime bg-lime text-ink" : "border-line text-mist"}`}
                  >
                    {done ? "✓" : n}
                  </span>
                  <span>
                    <span className="block text-xs font-bold text-grape-text">Week {n}: {RANKS[i]}</span>
                    <span className="mt-1 block font-display text-xl font-bold">{w.name}</span>
                    <span className="mt-1 block text-sm text-mist">{w.blurb}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl font-extrabold">This month's goals</h2>
        {c.goals.length === 0 ? (
          <p className="mt-3 text-mist">Jelarp sets these on the Week 1 stream.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {c.goals.map((g, i) => {
              const done = sheet.goals.includes(i);
              return (
                <li key={i}>
                  <button
                    onClick={() => tick("goal", i)}
                    aria-pressed={done}
                    className="flex w-full items-start gap-3 rounded-xl border-2 border-line bg-panel p-4 text-left transition-colors hover:border-grape"
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 text-sm font-black ${done ? "border-lime bg-lime text-ink" : "border-line"}`}
                    >
                      {done ? "✓" : ""}
                    </span>
                    <span className={done ? "text-mist line-through" : ""}>{g.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12 rounded-2xl border-2 border-ink bg-grape p-7 text-white">
        <h2 className="font-display text-2xl font-extrabold">To pass</h2>
        <p className="mt-3 max-w-[60ch] text-lg">{c.passCondition || "Jelarp sets the pass condition live with chat on the Week 1 stream."}</p>
        <p className="mt-4 text-sm text-white/70">
          The LARP is the same for every partner, so the pass condition is Jelarp's. Your ticks are only yours and they reset when the next one starts.
        </p>
      </section>
    </main>
  );
}
