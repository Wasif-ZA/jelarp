"use client";

import { useSyncExternalStore } from "react";
import { DEMO, demoAct, demoSignIn, demoSignOut, demoView } from "@/lib/demo";

const POLL_MS = 15000;
const DRAW_POLL_MS = 4000;
const listeners = new Set();
let state = null;
let notice = "";
let poller = null;
let noticeTimer = null;
let writes = 0;

const notify = () => listeners.forEach((cb) => cb());

export function setNotice(text) {
  notice = text;
  notify();
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice = "";
    notify();
  }, 4500);
}

export async function refresh() {
  if (DEMO) {
    state = demoView();
    return notify();
  }
  const startedAt = writes;
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return setNotice(data.error || "Could not load the board.");
    if (startedAt !== writes) return;
    state = data;
    notify();
  } catch {
    setNotice("Could not reach the server.");
  }
}

export async function act(type, payload = {}, { quiet = false } = {}) {
  writes += 1;
  if (DEMO) {
    try {
      const { notice: message, ...view } = demoAct({ ...payload, type });
      state = view;
      notify();
      if (message) setNotice(message);
      return { ok: true, view };
    } catch (e) {
      if (!quiet) setNotice(e.message);
      return { ok: false, status: e.status ?? 500, error: e.message };
    }
  }
  try {
    const res = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, type }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = data.error || `Something went wrong (${res.status}).`;
      if (!quiet) setNotice(error);
      return { ok: false, status: res.status, error };
    }
    const { notice: message, ...view } = data;
    state = view;
    notify();
    if (message) setNotice(message);
    return { ok: true, view };
  } catch {
    const error = "Could not reach the server.";
    if (!quiet) setNotice(error);
    return { ok: false, status: 0, error };
  }
}

export async function auth(method, body) {
  writes += 1;
  if (DEMO) {
    try {
      if (method === "DELETE") demoSignOut();
      else demoSignIn(body?.login, body?.role);
    } catch (e) {
      setNotice(e.message);
      return false;
    }
    await refresh();
    return true;
  }
  let ok = false;
  try {
    const res = await fetch("/api/auth", {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    ok = res.ok;
    if (!ok) setNotice((await res.json().catch(() => ({}))).error || "Sign-in failed.");
  } catch {
    setNotice("Could not reach the server.");
  }
  await refresh();
  return ok;
}

function schedule() {
  poller = setTimeout(async () => {
    if (!document.hidden) await refresh();
    if (listeners.size) schedule();
  }, state?.draw ? DRAW_POLL_MS : POLL_MS);
}

function subscribe(cb) {
  listeners.add(cb);
  if (!poller) {
    refresh();
    if (DEMO) {
      poller = true;
      addEventListener("storage", refresh);
    } else schedule();
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      if (DEMO) removeEventListener("storage", refresh);
      else clearTimeout(poller);
      poller = null;
    }
  };
}

export const useDb = () => useSyncExternalStore(subscribe, () => state, () => null);
export const useNotice = () => useSyncExternalStore(subscribe, () => notice, () => "");
