"use client";

import { useState } from "react";
import { act, setNotice, useDb } from "@/lib/store";
import { signIn } from "@/lib/twitch";
import { weight } from "@/lib/logic";
import { ask } from "@/components/Ask";
import Countdown from "@/components/Countdown";
import { Badge, Btn, Card, H2, Loading } from "@/components/ui";

const SHADOWS = ["var(--color-lime)", "var(--color-pink)", "var(--color-cyan)", "var(--color-orange)", "var(--color-grape)"];
const TILT = ["-rotate-1", "rotate-1", "rotate-0", "rotate-1", "-rotate-1"];
const STATUS = { pending: "Waiting for a mod", rejected: "Rejected", hidden: "Removed", selected: "Picked!" };
const SORTS = [
  ["top", "Most tickets"],
  ["new", "Newest"],
  ["mine", "Mine"],
];

export default function Board() {
  const db = useDb();
  const [sort, setSort] = useState("top");
  const [busy, setBusy] = useState(null);
  const [flash, setFlash] = useState(null);
  if (!db) return <Loading />;

  const me = db.me;
  const locked = Boolean(db.draw);
  const ideas = db.ideas
    .filter((i) => i.status === "approved" && (sort !== "mine" || i.mine))
    .sort(sort === "new" ? (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") : (a, b) => b.votes - a.votes);
  const mine = db.ideas.filter((i) => i.mine && i.status !== "approved");

  async function suggest(prefill = {}, error = "") {
    if (!me && !(await signIn())) return;
    const values = await ask({
      title: "Suggest a skill",
      error,
      body: "A mod checks it before it goes on the wheel. Keep it safe and doable on stream.",
      fields: [
        { name: "title", label: "Skill or challenge", placeholder: "Learn to juggle", required: true, minLength: 3, maxLength: 80, defaultValue: prefill.title },
        { name: "description", label: "Details (optional)", as: "textarea", maxLength: 280, placeholder: "What would passing look like?", defaultValue: prefill.description },
        { name: "anonymous", label: "Post as Anonymous", type: "checkbox", defaultValue: prefill.anonymous, hint: "Hidden from chat. Mods can see who posted." },
      ],
      confirm: "Send it in",
    });
    if (!values) return;
    const res = await act("suggest", values, { quiet: true });
    if (res.ok) return;
    if (res.status === 400 || res.status === 409) return suggest(values, res.error);
    setNotice(res.error);
  }

  async function openIdea(i) {
    if (busy) return;
    const tickets = weight(i.votes);
    const ok = await ask({
      title: i.title,
      body: (
        <div className="space-y-3">
          {i.description && <p>{i.description}</p>}
          <p className="text-sm">
            by {i.anonymous ? "Anonymous" : `@${i.author}`}
            {i.mine && " (you)"}
          </p>
          <p className="font-bold text-bone">
            <span className="font-bungee text-2xl text-lime">{tickets}</span> {tickets === 1 ? "ticket" : "tickets"} on the wheel ({i.votes}{" "}
            {i.votes === 1 ? "vote" : "votes"})
          </p>
          {locked && <p>Votes are frozen while the wheel is locked.</p>}
          {!locked && !me && <p>Sign in with Twitch to vote.</p>}
          {!locked && me && !i.voted && <p>Your vote takes it to {tickets + 1} tickets.</p>}
          {!locked && me && i.voted && <p>You voted for this. Removing your vote takes it back to {tickets - 1}.</p>}
        </div>
      ),
      confirm: locked ? false : !me ? "Sign in to vote" : i.voted ? "Remove my vote" : "Vote for this",
      cancel: locked ? "Close" : "Cancel",
      danger: Boolean(me && i.voted),
    });
    if (!ok) return;
    if (!me) return signIn();

    setBusy(i.id);
    const res = await act("vote", { id: i.id });
    setBusy(null);
    if (!res.ok) return;
    setNotice(i.voted ? `Vote removed from ${i.title}.` : `+1 ticket for ${i.title}!`);
    setFlash(i.id);
    setTimeout(() => setFlash(null), 900);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-10 lg:pb-10">
      <section className="flex flex-wrap items-end gap-8">
        <div className="mr-auto">
          <h1 className="font-display text-5xl font-extrabold leading-none md:text-7xl">
            Pick the next <span className="text-lime">LARP</span>
          </h1>
          <p className="mt-4 max-w-[48ch] text-lg text-mist">Tap an idea to vote for it. Every vote is another ticket on the wheel.</p>
        </div>
        <div className="rotate-2 rounded-2xl border-2 border-ink bg-lime px-6 py-4 text-ink shadow-[6px_6px_0_var(--color-grape)]">
          <p className="text-sm font-bold">{db.settings.spinDate ? "Wheel spins in" : "Wheel spins"}</p>
          <Countdown date={db.settings.spinDate} time={db.settings.spinTime} className="font-bungee text-2xl" />
        </div>
      </section>

      {locked && (
        <p className="mt-8 rounded-2xl border-2 border-pink p-4 font-bold text-pink">The draw is locked. Votes are frozen until the new LARP is confirmed.</p>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <section aria-label="Ideas on the board">
          <div className="mb-6 flex flex-wrap gap-2">
            {SORTS.filter(([key]) => key !== "mine" || me).map(([key, text]) => (
              <button
                key={key}
                type="button"
                aria-pressed={sort === key}
                onClick={() => setSort(key)}
                className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${sort === key ? "border-lime bg-lime text-ink" : "border-line text-mist hover:text-bone"}`}
              >
                {text}
              </button>
            ))}
          </div>

          {ideas.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-line p-10 text-center text-mist">
              {sort === "mine" ? "None of your ideas are on the board yet." : "No ideas on the board yet. Be the first to suggest one."}
            </p>
          )}

          <ul className="grid gap-6 sm:grid-cols-2">
            {ideas.map((i, idx) => {
              const tickets = weight(i.votes);
              return (
                <li key={i.id} className={TILT[idx % TILT.length]}>
                  <button
                    type="button"
                    onClick={() => openIdea(i)}
                    disabled={busy === i.id}
                    aria-label={`${i.title}, ${tickets} ${tickets === 1 ? "ticket" : "tickets"}${i.voted ? ", you voted" : ""}`}
                    className={`flex h-full w-full flex-col rounded-2xl border-2 bg-panel p-5 text-left transition hover:-translate-y-1 ${flash === i.id ? "border-lime" : "border-line"}`}
                    style={{ boxShadow: `6px 6px 0 ${SHADOWS[idx % SHADOWS.length]}` }}
                  >
                    <span className="font-display text-2xl font-bold leading-tight">{i.title}</span>
                    {i.description && <span className="mt-1 text-mist">{i.description}</span>}
                    <span className="mt-2 text-sm text-mist">
                      by {i.anonymous ? "Anonymous" : `@${i.author}`}
                      {i.mine && " (you)"}
                    </span>
                    <span className="mt-auto flex w-full items-center justify-between gap-3 pt-5">
                      <span>
                        <span key={i.votes} className="pop font-bungee text-2xl text-lime">{tickets}</span>
                        <span className="ml-1.5 text-sm font-bold">{tickets === 1 ? "ticket" : "tickets"}</span>
                        <span className="ml-2 text-sm text-mist">
                          ({i.votes} {i.votes === 1 ? "vote" : "votes"})
                        </span>
                      </span>
                      <span className={`rounded-full border-2 px-4 py-2 text-sm font-extrabold ${i.voted ? "border-ink bg-lime text-ink" : "border-line"}`}>
                        {i.voted ? "Voted ✓" : "Vote"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="space-y-6 self-start lg:sticky lg:top-24">
          <Card className="shadow-[6px_6px_0_var(--color-grape)]">
            <H2>Got a skill in mind?</H2>
            <p className="text-mist">Suggest it. A mod checks it, then chat can vote it onto the wheel.</p>
            <Btn variant="lime" className="mt-5 hidden w-full lg:inline-flex" disabled={locked} onClick={() => suggest()}>
              Suggest a skill
            </Btn>
          </Card>

          {mine.length > 0 && (
            <Card>
              <H2>Your ideas</H2>
              <ul className="space-y-3">
                {mine.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3">
                    <span>{i.title}</span>
                    <Badge tone={i.status === "selected" ? "lime" : i.status === "rejected" ? "pink" : "grape"}>{STATUS[i.status]}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-30 lg:hidden">
        <Btn variant="lime" className="w-full" disabled={locked} onClick={() => suggest()}>
          Suggest a skill
        </Btn>
      </div>
    </main>
  );
}
