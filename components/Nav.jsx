"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { refresh, useDb, useNotice } from "@/lib/store";
import { finishSignIn, signIn, signOut } from "@/lib/twitch";
import { DEMO, demoReset } from "@/lib/demo";
import { ask } from "@/components/Ask";

const BARE = ["/draw", "/overlay"];

/* Any screen can go in OBS, not just the draw and the overlay.

   Add ?obs=1 to any URL and the site drops its own chrome, so the board, the
   archive or a partner page can be a browser source without anyone building a
   separate view for each one. Same flag as the hub, so there is one thing to
   remember rather than two. */
function useBare() {
  const path = usePathname();
  const params = useSearchParams();
  return BARE.includes(path) || params.get("obs") === "1";
}

async function resetDemo() {
  const ok = await ask({ title: "Reset the demo?", body: "This brings back the sample data and signs you out, in this browser only.", confirm: "Reset", danger: true });
  if (!ok) return;
  demoReset();
  refresh();
}

const LINKS = [
  ["/", "This month"],
  ["/board", "Vote"],
  ["/archive", "Hall of LARPs"],
];

export default function Nav() {
  const path = usePathname();
  const bare = useBare();
  const db = useDb();
  useEffect(() => {
    finishSignIn();
  }, []);
  if (bare) return null;

  const staff = db?.me && db.me.role !== "viewer";
  const ideas = db ? db.ideas.filter((i) => i.status === "approved").map((i) => i.title) : [];
  const strip = [...ideas, ...ideas, ...ideas];
  const links = [...LINKS, ...(staff ? [["/studio", "Studio"]] : [])].map(([href, text]) => (
    <Link
      key={href}
      href={href}
      aria-current={path === href ? "page" : undefined}
      className={`whitespace-nowrap text-sm font-bold ${path === href ? "text-lime" : "text-mist hover:text-bone"}`}
    >
      {text}
    </Link>
  ));

  return (
    <>
      <header className="sticky top-0 z-40 border-b-2 border-line bg-ink/90 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="mr-auto flex items-center gap-2.5">
            {db?.settings.logoUrl ? (
              <img src={db.settings.logoUrl} alt="" className="h-10 w-10 rounded-full border-2 border-bone object-cover" />
            ) : (
              <img src="/logo.png" alt="" className="h-11 w-11" />
            )}
            <span className="font-bungee text-lg leading-none">
              Jelarp
              <span className="block text-[10px] tracking-[0.2em] text-grape-text">of all trades</span>
            </span>
            {DEMO && <span className="-rotate-3 rounded-full bg-pink px-2 py-0.5 text-xs font-black text-ink">DEMO</span>}
          </Link>
          <div className="hidden items-center gap-6 md:flex">{links}</div>
          {!db ? (
            <span className="h-9 w-36 animate-pulse rounded-full bg-panel" />
          ) : db.me ? (
            <div className="flex items-center gap-3">
              <span className="rounded-full border-2 border-grape px-3 py-1 text-sm font-bold">@{db.me.login}</span>
              <button onClick={() => signOut()} className="text-sm font-bold text-mist hover:text-bone">
                Sign out
              </button>
            </div>
          ) : (
            <button onClick={() => signIn()} className="btn btn-grape btn-sm">
              {DEMO ? "Try the demo" : "Sign in with Twitch"}
            </button>
          )}
        </nav>
        <div className="flex gap-5 overflow-x-auto px-4 pb-3 md:hidden">{links}</div>
      </header>

      {ideas.length > 0 && (
        <Link
          href="/board"
          aria-label="See the ideas on next month's wheel"
          className="block overflow-hidden border-b-2 border-ink bg-grape py-2 text-sm font-bold text-white"
        >
          <span className="marquee flex w-max">
            {[0, 1].map((copy) => (
              <span key={copy} aria-hidden="true" className="flex gap-6 pr-6">
                {strip.map((title, i) => (
                  <span key={i}>✦ {title}</span>
                ))}
                <span className="text-lime">✦ Add yours</span>
              </span>
            ))}
          </span>
        </Link>
      )}
    </>
  );
}

export function Footer() {
  const bare = useBare();
  const db = useDb();
  if (bare) return null;
  return (
    <footer className="mx-auto mt-10 flex max-w-6xl flex-wrap justify-between gap-3 border-t-2 border-line px-4 py-8 text-sm text-mist">
      <p>
        Jelarp of All Trades. One skill a month, picked by chat.
        {DEMO && (
          <button onClick={resetDemo} className="ml-3 font-bold text-pink underline underline-offset-4">
            Reset demo
          </button>
        )}
      </p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {db?.settings.twitch && (
          <a
            href={`https://www.twitch.tv/${db.settings.twitch}`}
            className="font-bold text-bone underline decoration-grape decoration-2 underline-offset-4"
          >
            twitch.tv/{db.settings.twitch}
          </a>
        )}
        <span>
          Site by{" "}
          <a href="https://github.com/Wasif-ZA" className="font-bold text-bone underline decoration-lime decoration-2 underline-offset-4">
            Wasif
          </a>
        </span>
      </p>
    </footer>
  );
}

export function Toast() {
  const notice = useNotice();
  if (!notice) return null;
  return (
    <p
      role="status"
      className="fixed left-1/2 top-20 z-50 max-w-[90vw] -translate-x-1/2 rounded-full border-2 border-ink bg-lime px-5 py-2.5 text-center font-bold text-ink shadow-[4px_4px_0_var(--color-grape)]"
    >
      {notice}
    </p>
  );
}
