"use client";

import { useEffect, useState } from "react";
import { act, useDb } from "@/lib/store";
import { signIn } from "@/lib/twitch";
import { ask } from "@/components/Ask";

const BUBBLES = ["bg-lime", "bg-pink", "bg-cyan", "bg-orange", "bg-bone"];

// R-19: the Twitch account comes from the session, so the form only asks for the proof.
export async function applyToJoin(db) {
  if (!db.me) return signIn();
  const values = await ask({
    title: "Apply to join the LARP",
    body: `Applying as @${db.me.login}. Link your first stream or clip of you doing this month's LARP. A mod watches it, and that is the whole bar.`,
    fields: [
      {
        name: "vod",
        label: "Your VOD or clip",
        placeholder: "https://www.twitch.tv/videos/...",
        required: true,
        maxLength: 300,
        hint: "A twitch.tv video or clip link.",
      },
      { name: "note", label: "Anything to add (optional)", as: "textarea", maxLength: 280, placeholder: "First attempt, it went badly." },
    ],
    confirm: "Send it",
  });
  if (values) act("apply", values);
}

function Status({ application, partner }) {
  if (partner) {
    return (
      <span className="inline-block rounded-full bg-lime px-3 py-1 text-sm font-bold text-ink">
        You are in. Open your panel
      </span>
    );
  }
  if (application?.status === "pending") {
    return <span className="inline-block rounded-full border-2 border-line px-3 py-1 text-sm font-bold text-mist">Application with the mods</span>;
  }
  if (application?.status === "rejected") {
    return (
      <span className="inline-block rounded-full border-2 border-pink px-3 py-1 text-sm font-bold text-pink">
        Not this time{application.reason ? `: ${application.reason}` : ""}
      </span>
    );
  }
  return null;
}

// R-22: the outcome shows as a badge on the site, no email and no Discord notice.
export function ApplicationStatus() {
  const db = useDb();
  if (!db?.me) return null;
  const { partner, application } = db.me;
  if (!partner && !application) return null;
  return <Status application={application} partner={partner} />;
}

export function PartnerList() {
  const db = useDb();
  const [live, setLive] = useState(null);

  // The list renders from the doc immediately; Twitch only ever adds avatars and live dots.
  useEffect(() => {
    let stop = false;
    fetch("/api/live", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => !stop && data?.partners && setLive(data))
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, []);

  const logins = db?.partners ?? [];
  if (logins.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-line p-8 text-center">
        <p className="text-lg text-mist">No one else yet. Be the first.</p>
        <button onClick={() => applyToJoin(db)} className="btn btn-lime mt-4">
          Apply to join as a creator
        </button>
      </div>
    );
  }

  const enriched = live?.partners?.length ? live.partners : logins.map((login) => ({ login, display: login, avatar: "", live: false, title: "" }));

  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {enriched.map((p, i) => (
          <li key={p.login}>
            <a
              href={`https://www.twitch.tv/${p.login}`}
              className="flex items-center gap-3 rounded-2xl border-2 border-line bg-panel p-3 transition-colors hover:border-lime"
            >
              {p.avatar ? (
                <img src={p.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full border-2 border-line object-cover" />
              ) : (
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black text-ink ${BUBBLES[i % BUBBLES.length]}`}>
                  {p.login.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{p.display}</span>
                <span className="block truncate text-sm text-mist">{p.live ? p.title || "Live now" : "Offline"}</span>
              </span>
              {p.live && (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-pink px-2.5 py-1 text-xs font-black text-ink">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink" />
                  LIVE
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
      {live && !live.ready && (
        <p className="mt-3 text-sm text-mist">Live dots are off for now.</p>
      )}
    </div>
  );
}
