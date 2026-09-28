"use client";

import { useDb } from "@/lib/store";
import { OUTCOMES, monthLabel, parseLinks, youtubeId } from "@/lib/logic";
import { Loading } from "@/components/ui";

const STAMP = {
  passed: ["PASSED", "text-lime"],
  "not-passed": ["NOT PASSED", "text-pink"],
  ungraded: ["NO GRADE", "text-cyan"],
  active: ["IN PROGRESS", "text-orange"],
};
const SHADOWS = ["var(--color-lime)", "var(--color-pink)", "var(--color-cyan)", "var(--color-orange)"];

export default function Archive() {
  const db = useDb();
  if (!db) return <Loading />;
  const { archive } = db;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-5xl font-extrabold leading-none md:text-7xl">
        Hall of <span className="text-lime">LARPs</span>
      </h1>
      <p className="mt-4 max-w-[48ch] text-lg text-mist">Every skill Jelarp has taken on, and how each one ended.</p>

      {archive.length === 0 && (
        <p className="mt-10 rounded-2xl border-2 border-dashed border-line p-10 text-center text-mist">
          Nothing finished yet. The first LARP lands here after week 4.
        </p>
      )}

      <ul className="mt-12 grid gap-8 md:grid-cols-2">
        {archive.map((a, i) => {
          const links = parseLinks(a.links);
          const video = links.map((l) => youtubeId(l.url)).find(Boolean);
          const [stamp, tone] = STAMP[a.outcome] ?? STAMP.ungraded;
          return (
            <li
              key={`${a.month}-${a.title}-${i}`}
              className="flex flex-col rounded-2xl border-2 border-line bg-panel p-6"
              style={{ boxShadow: `7px 7px 0 ${SHADOWS[i % SHADOWS.length]}` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-mist">{monthLabel(a.month)}</p>
                  <h2 className="mt-1 font-display text-3xl font-extrabold leading-tight">{a.title}</h2>
                </div>
                <span title={OUTCOMES[a.outcome]} className={`mt-2 shrink-0 -rotate-12 rounded-lg border-4 border-current px-3 py-1 font-bungee text-lg ${tone}`}>
                  {stamp}
                </span>
              </div>
              {a.summary && <p className="mt-3 text-mist">{a.summary}</p>}
              <p className="mt-4 text-sm font-bold">
                ↻ {a.tryAgains ?? 0} Try Agains <span className="text-mist">|</span> {a.along ?? 0} LARPed along
              </p>
              {video && (
                <iframe
                  title={`${a.title} on YouTube`}
                  src={`https://www.youtube-nocookie.com/embed/${video}`}
                  loading="lazy"
                  allowFullScreen
                  className="mt-5 aspect-video w-full rounded-xl border-2 border-line"
                />
              )}
              {links.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {links.map((l) => (
                    <a key={l.url + l.title} href={l.url} className="rounded-full border-2 border-line px-4 py-2 text-sm font-bold hover:border-lime">
                      {l.title} ↗
                    </a>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
