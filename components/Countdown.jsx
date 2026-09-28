"use client";

import { useEffect, useState } from "react";
import { countdown, cycleRemaining, sydneyTime } from "@/lib/logic";

// R-07: the cycle ends at the next spin, computed in Sydney so every viewer sees the same number.
export function useCycleLeft(date, time) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const target = sydneyTime(date, time);
  if (now === null || Number.isNaN(target)) return { loading: true, left: null };
  return { loading: false, left: cycleRemaining(target - now) };
}

export default function Countdown({ date, time, className = "" }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const target = sydneyTime(date, time);
  if (Number.isNaN(target)) return <span className={className}>Date to be announced</span>;
  const text = now === null ? "--d --h --m --s" : countdown(target - now) ?? "Spin time!";
  return <span className={`block tabular-nums ${className}`}>{text}</span>;
}
