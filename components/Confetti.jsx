"use client";

import { useMemo } from "react";

const COLORS = ["#c6ff3d", "#9146ff", "#ff5fa2", "#3ddcff", "#ffb23d", "#f6f1ff"];

export default function Confetti({ burst }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 90 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.4 + Math.random() * 1.8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 7 + Math.random() * 8,
        spin: Math.random() * 1080 - 540,
        drift: Math.random() * 200 - 100,
      })),
    [burst],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={`${burst}-${i}`}
          className="confetti"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size * 0.45,
            background: b.color,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
            "--spin": `${b.spin}deg`,
            "--drift": `${b.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
