"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { act, useDb } from "@/lib/store";
import { signIn } from "@/lib/twitch";
import { weight } from "@/lib/logic";
import Wheel, { slices } from "@/components/Wheel";
import Confetti from "@/components/Confetti";
import { ask } from "@/components/Ask";
import { Btn, Loading } from "@/components/ui";

let audio;
function beep(freq, duration, type = "square", volume = 0.05) {
  audio ??= new AudioContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

const fanfare = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.22, "triangle", 0.1), i * 120));

function angleOf(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return 0;
  const m = new DOMMatrixReadOnly(t);
  return ((Math.atan2(m.b, m.a) * 180) / Math.PI + 360) % 360;
}

export default function Draw() {
  const db = useDb();
  const wheelRef = useRef(null);
  const spinning = useRef(false);
  const [rot, setRot] = useState(0);
  const [spinningTo, setSpinningTo] = useState(null);
  const [streamView, setStreamView] = useState(false);
  const [sound, setSound] = useState(true);
  const [burst, setBurst] = useState(0);

  if (!db) return <Loading />;
  if (db.me?.role !== "creator") {
    return (
      <main className="mx-auto max-w-6xl px-4 py-24">
        <h1 className="font-display text-5xl font-extrabold">Only Jelarp spins the wheel.</h1>
        <p className="mt-3 text-lg text-mist">Sign in with the Twitch account that runs the channel.</p>
        <div className="mt-6 flex gap-3">
          {!db.me && <Btn onClick={() => signIn()}>Sign in with Twitch</Btn>}
          <Link href="/" className="btn btn-ghost">Back to the site</Link>
        </div>
      </main>
    );
  }

  const draw = db.draw;
  const pool =
    draw?.pool ??
    db.ideas.filter((i) => i.status === "approved").map((i) => ({ id: i.id, title: i.title, votes: i.votes, weight: weight(i.votes) }));
  const parts = slices(pool);
  const winner = draw?.status === "revealed" && !spinningTo ? pool.find((p) => p.id === draw.winnerId) : null;

  function reveal() {
    spinning.current = false;
    setSpinningTo(null);
    setBurst((b) => b + 1);
    if (sound) fanfare();
  }

  function tick() {
    let last = -1;
    const step = () => {
      if (!spinning.current || !wheelRef.current) return;
      const under = (360 - angleOf(wheelRef.current)) % 360;
      const idx = parts.findIndex((p) => under >= p.a0 && under < p.a1);
      if (idx !== last && last !== -1) beep(1400, 0.025);
      last = idx;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async function spin() {
    if (spinningTo) return;
    setSpinningTo("waiting");
    const res = await act("spin");
    const w = parts.find((p) => p.id === res.view?.draw?.winnerId);
    if (!w) return setSpinningTo(null);
    const land = w.a0 + (w.a1 - w.a0) * (0.15 + 0.7 * Math.random());
    setRot(rot - (rot % 360) + 360 * 7 + (360 - land));
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return reveal();
    spinning.current = true;
    setSpinningTo(w.id);
    if (sound) tick();
  }

  async function voidWinner() {
    const reason = await ask({
      title: "Void this result?",
      body: "The spin gets logged with your reason, then the pool goes back to locked so you can spin again.",
      input: { label: "Reason", placeholder: "Stream dropped mid-spin", required: true },
      confirm: "Void and redraw",
      danger: true,
    });
    if (reason) act("void", { reason });
  }

  return (
    <main className={`grid min-h-[100dvh] gap-6 p-4 ${streamView ? "place-items-center" : "lg:grid-cols-[1fr_22rem]"}`}>
      {winner && burst > 0 && <Confetti burst={burst} />}

      <section className="flex flex-col items-center justify-center gap-6">
        <p className="font-bungee text-2xl md:text-3xl">
          Jelarp <span className="text-grape-text">of all trades</span>
        </p>

        {parts.length < 2 ? (
          <p className="text-mist">Approve at least 2 ideas to spin.</p>
        ) : (
          <Wheel
            parts={parts}
            wheelRef={wheelRef}
            className="w-[min(85vw,34rem)]"
            svgStyle={{ transform: `rotate(${rot}deg)`, transition: "transform 7s cubic-bezier(0.1, 0.75, 0.15, 1)" }}
            onTransitionEnd={() => spinningTo && spinningTo !== "waiting" && reveal()}
          />
        )}

        <div aria-live="polite" className="min-h-28 text-center">
          {spinningTo && <p className="font-bungee text-3xl text-mist">Spinning…</p>}
          {winner && (
            <div key={burst} className="stamp-in">
              <p className="font-bungee text-lg text-pink">Jelarp's next LARP</p>
              <p className="font-display text-5xl font-extrabold text-lime md:text-7xl">{winner.title}</p>
            </div>
          )}
        </div>

        {streamView && (
          <button className="fixed bottom-3 right-3 text-xs text-mist/60 hover:text-bone" onClick={() => setStreamView(false)}>
            exit stream view
          </button>
        )}
      </section>

      {!streamView && (
        <aside className="space-y-5 self-start rounded-2xl border-2 border-line bg-panel p-5 shadow-[6px_6px_0_var(--color-grape)] lg:sticky lg:top-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-extrabold">Draw controls</h1>
            <Link href="/studio" className="text-sm font-bold text-mist underline">Studio</Link>
          </div>
          <p className="text-sm text-mist">Only you see this panel. Hit Stream view before you share the screen.</p>

          <div className="flex flex-wrap gap-2">
            {!draw && <Btn variant="grape" onClick={() => act("lock")} disabled={parts.length < 2}>Lock the pool</Btn>}
            {draw?.status === "locked" && (
              <>
                <Btn variant="lime" onClick={spin} disabled={Boolean(spinningTo)}>Spin</Btn>
                <Btn variant="ghost" onClick={() => act("unlock")} disabled={Boolean(spinningTo)}>Unlock</Btn>
              </>
            )}
            {winner && (
              <>
                <Btn variant="lime" onClick={() => act("confirm")}>Confirm winner</Btn>
                <Btn variant="ghost" onClick={voidWinner}>Void and redraw</Btn>
              </>
            )}
            <Btn variant="ghost" onClick={() => setStreamView(true)}>Stream view</Btn>
            <Btn variant="ghost" aria-pressed={sound} onClick={() => setSound(!sound)}>{sound ? "Sound on" : "Sound off"}</Btn>
          </div>

          {winner && db.current?.outcome === "active" && (
            <p className="rounded-xl border-2 border-orange p-3 text-sm font-bold text-orange">
              {db.current.title} is still Active. Confirming files it in the Hall of LARPs as No grade. Set Passed or Not passed in Studio first.
            </p>
          )}

          <div>
            <p className="mb-2 text-sm font-bold">{draw ? "Locked pool" : "Pool if you lock now"}: 1 ticket + 1 per vote</p>
            <ul className="space-y-1.5 text-sm">
              {parts.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color[0] }} />
                  <span className="mr-auto">{p.title}</span>
                  <span className="whitespace-nowrap text-mist">
                    {p.weight} {p.weight === 1 ? "ticket" : "tickets"}, {Math.round(p.share * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </main>
  );
}
