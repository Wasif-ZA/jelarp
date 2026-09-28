"use client";

import { useEffect, useRef } from "react";
import { WEEKS, monthLabel, rankFor, tryAgainTotal } from "@/lib/logic";
import { setNotice } from "@/lib/store";
import { DEMO } from "@/lib/demo";
import { Btn } from "@/components/ui";

const W = 1200;
const H = 630;
const SLICES = ["#9146ff", "#c6ff3d", "#ff5fa2", "#3ddcff", "#ffb23d", "#5b2bd6"];

function wrap(ctx, text, max) {
  const out = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function pill(ctx, x, y, text, bg, fg) {
  const w = ctx.measureText(text).width + 40;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 50, 25);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.fillText(text, x + 20, y + 34);
  return x + w + 14;
}

async function paint(canvas, c, site) {
  await document.fonts.ready;
  const vars = getComputedStyle(document.documentElement);
  const bungee = vars.getPropertyValue("--nf-bungee").trim() || "sans-serif";
  const sans = vars.getPropertyValue("--nf-bricolage").trim() || "sans-serif";
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0f0b17";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  for (let x = 11; x < W; x += 22) for (let y = 11; y < H; y += 22) ctx.fillRect(x, y, 2, 2);

  SLICES.forEach((color, i) => {
    ctx.beginPath();
    ctx.moveTo(1160, 330);
    ctx.arc(1160, 330, 300, (i / 6) * 2 * Math.PI, ((i + 1) / 6) * 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#0f0b17";
    ctx.lineWidth = 6;
    ctx.stroke();
  });

  ctx.fillStyle = "#c6ff3d";
  ctx.font = `30px ${bungee}`;
  ctx.fillText("JELARP OF ALL TRADES", 64, 92);
  ctx.fillStyle = "#b3a6c9";
  ctx.font = `600 30px ${sans}`;
  ctx.fillText(`${monthLabel(c.month)}: this month's LARP`, 64, 146);

  ctx.fillStyle = "#f6f1ff";
  ctx.font = `800 92px ${sans}`;
  const title = wrap(ctx, c.title, 760).slice(0, 2);
  title.forEach((line, i) => ctx.fillText(line, 64, 250 + i * 96));

  let y = 250 + (title.length - 1) * 96 + 46;
  ctx.font = `20px ${bungee}`;
  const x = pill(ctx, 64, y, `WEEK ${c.week}/4: ${WEEKS[c.week - 1].name.toUpperCase()}`, "#c6ff3d", "#0f0b17");
  pill(ctx, x, y, `RANK: ${rankFor(c).toUpperCase()}`, "#ff5fa2", "#0f0b17");

  y += 110;
  const goal = c.goals.find((g) => !g.done && g.text);
  if (goal) {
    ctx.fillStyle = "#f6f1ff";
    ctx.font = `600 32px ${sans}`;
    ctx.fillText(wrap(ctx, `Next goal: ${goal.text}`, 760)[0], 64, y);
  }
  ctx.fillStyle = "#b3a6c9";
  ctx.font = `600 28px ${sans}`;
  ctx.fillText(`Try Agains so far: ${tryAgainTotal(c)}${site ? `   |   ${site}` : ""}`, 64, H - 48);
}

export default function DiscordCard({ current, site }) {
  const canvas = useRef(null);

  useEffect(() => {
    if (current && canvas.current) paint(canvas.current, current, site);
  }, [current, site]);

  const blob = () => new Promise((resolve) => canvas.current.toBlob(resolve, "image/png"));

  async function download() {
    const url = URL.createObjectURL(await blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `jelarp-${current.month}-week-${current.week}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copy() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob() })]);
      setNotice("Copied. Paste it straight into Discord.");
    } catch {
      setNotice("This browser blocked copying. Use Download instead.");
    }
  }

  async function post() {
    if (DEMO) return setNotice("Posting to Discord is off in the demo. Use Copy or Download.");
    setNotice("Posting to Discord...");
    const form = new FormData();
    form.append("file", await blob(), "jelarp.png");
    try {
      const res = await fetch("/api/discord", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      setNotice(data.error || data.notice || `Discord post failed (${res.status}).`);
    } catch {
      setNotice("Could not reach the server. Download the card and post it by hand.");
    }
  }

  return (
    <div className="space-y-4">
      <canvas ref={canvas} width={W} height={H} className="w-full rounded-xl border-2 border-line" aria-label="Discord update card preview" />
      <div className="flex flex-wrap items-center gap-3">
        <Btn variant="lime" onClick={post}>Post to Discord</Btn>
        <Btn variant="ghost" onClick={copy}>Copy image</Btn>
        <Btn variant="ghost" onClick={download}>Download</Btn>
      </div>
    </div>
  );
}
