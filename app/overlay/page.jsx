"use client";

import { useEffect } from "react";
import { useDb } from "@/lib/store";
import { WEEKS, rankFor, tryAgainTotal, weight } from "@/lib/logic";

export default function Overlay() {
  const db = useDb();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.overlay = new URLSearchParams(location.search).get("bg") === "green" ? "green" : "clear";
    return () => delete root.dataset.overlay;
  }, []);

  if (!db) return null;
  const c = db.current;
  const top = db.ideas
    .filter((i) => i.status === "approved")
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 3);

  return (
    <main className="flex min-h-[100dvh] items-end p-10">
      <section className="w-[34rem] rounded-3xl border-4 border-ink bg-panel/95 p-7 text-bone shadow-[10px_10px_0_var(--color-grape)]">
        <p className="font-bungee text-lg text-grape-text">Jelarp of all trades</p>
        {c ? (
          <>
            <p className="mt-3 text-sm font-bold text-mist">This month's LARP</p>
            <h1 className="font-display text-5xl font-extrabold leading-none text-lime">{c.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2 font-bungee text-sm text-ink">
              <span className="rounded-full bg-lime px-3 py-1">
                Week {c.week}/4: {WEEKS[c.week - 1].name}
              </span>
              <span className="rounded-full bg-pink px-3 py-1">Rank: {rankFor(c)}</span>
              <span className="rounded-full bg-cyan px-3 py-1">↻ {tryAgainTotal(c)} Try Again</span>
            </div>
          </>
        ) : (
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight">The first LARP gets picked soon</h1>
        )}

        {top.length > 0 && (
          <div className="mt-6 border-t-2 border-line pt-5">
            <p className="text-sm font-bold text-mist">Leading for next month</p>
            <ol className="mt-3 space-y-2">
              {top.map((i, n) => (
                <li key={i.id} className="flex items-center gap-3 text-lg font-bold">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-raised font-bungee text-lime">{n + 1}</span>
                  <span className="mr-auto">{i.title}</span>
                  <span className="font-bungee text-lime">{weight(i.votes)}</span>
                </li>
              ))}
            </ol>
            {db.settings.siteUrl && (
              <p className="mt-4 font-bold">
                Vote at <span className="text-lime">{db.settings.siteUrl}</span>
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
