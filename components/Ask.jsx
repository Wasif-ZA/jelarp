"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { field, label } from "@/components/ui";

const listeners = new Set();
let request = null;
let seq = 0;

const notify = () => listeners.forEach((cb) => cb());
const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function ask(options) {
  request?.resolve(null);
  return new Promise((resolve) => {
    request = { ...options, resolve, id: ++seq };
    notify();
  });
}

function AskField({ f, first }) {
  if (f.type === "select") {
    return (
      <label className="block">
        <span className={label}>{f.label}</span>
        <select name={f.name} defaultValue={f.defaultValue} className={field}>
          {f.options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (f.type === "checkbox") {
    return (
      <div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" name={f.name} defaultChecked={Boolean(f.defaultValue)} className="h-4 w-4 accent-lime" />
          {f.label}
        </label>
        {f.hint && <p className="mt-1.5 text-xs text-mist">{f.hint}</p>}
      </div>
    );
  }
  const shared = {
    name: f.name,
    autoFocus: first,
    autoComplete: "off",
    required: f.required,
    minLength: f.minLength,
    maxLength: f.maxLength ?? 200,
    placeholder: f.placeholder,
    defaultValue: f.defaultValue,
    className: field,
  };
  return (
    <label className="block">
      <span className={label}>{f.label}</span>
      {f.as === "textarea" ? <textarea rows={3} {...shared} /> : <input pattern={f.pattern} {...shared} />}
      {f.hint && <span className="mt-1.5 block text-xs text-mist">{f.hint}</span>}
    </label>
  );
}

export function AskDialog() {
  const req = useSyncExternalStore(subscribe, () => request, () => null);
  const ref = useRef(null);

  useEffect(() => {
    if (req && !ref.current.open) ref.current.showModal();
  }, [req]);

  if (!req) return null;

  const fields = req.fields ?? (req.input ? [{ name: "value", ...req.input }] : []);

  function close(value) {
    ref.current?.close();
    request = null;
    notify();
    req.resolve(value);
  }

  function submit(e) {
    e.preventDefault();
    if (!fields.length) return close(true);
    const data = new FormData(e.currentTarget);
    const values = Object.fromEntries(
      fields.map((f) => [f.name, f.type === "checkbox" ? data.has(f.name) : String(data.get(f.name) ?? "").trim()]),
    );
    if (fields.some((f) => f.required && !values[f.name])) return;
    close(req.input ? values.value : values);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="ask-title"
      onCancel={(e) => {
        e.preventDefault();
        close(null);
      }}
      onClick={(e) => e.target === e.currentTarget && close(null)}
      className="dialog-pop m-auto max-h-[90dvh] w-[min(92vw,30rem)] overflow-y-auto rounded-2xl border-2 border-line bg-panel p-0 text-bone shadow-[8px_8px_0_var(--color-grape)] backdrop:bg-ink/80 backdrop:backdrop-blur-sm"
    >
      <form key={req.id} onSubmit={submit} className="space-y-5 p-6">
        <h2 id="ask-title" className="font-display text-2xl font-extrabold leading-tight">
          {req.title}
        </h2>
        {req.error && (
          <p role="alert" className="rounded-xl border-2 border-pink p-3 text-sm font-bold text-pink">
            {req.error}
          </p>
        )}
        {req.body && <div className="text-mist">{req.body}</div>}
        {fields.map((f, n) => (
          <AskField key={f.name} f={f} first={n === 0} />
        ))}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => close(null)}>
            {req.cancel ?? "Cancel"}
          </button>
          {req.confirm !== false && (
            <button type="submit" autoFocus={!fields.length} className={`btn ${req.danger ? "btn-pink" : "btn-lime"}`}>
              {req.confirm ?? "OK"}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
