export const field =
  "w-full rounded-xl border-2 border-line bg-raised px-3 py-2 text-bone placeholder:text-mist focus:border-lime [color-scheme:dark]";
export const label = "mb-1.5 block text-sm font-bold text-mist";

export function Card({ className = "", children }) {
  return <section className={`rounded-2xl border-2 border-line bg-panel p-6 ${className}`}>{children}</section>;
}

export function H2({ children }) {
  return <h2 className="mb-4 font-display text-2xl font-extrabold">{children}</h2>;
}

export function Btn({ variant = "grape", className = "", ...props }) {
  return <button className={`btn btn-${variant} ${className}`} {...props} />;
}

export function Badge({ tone = "grape", children }) {
  const look = { lime: "bg-lime text-ink", pink: "bg-pink text-ink", grape: "bg-raised text-grape-text" }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${look}`}>{children}</span>;
}

export function Field({ as: Tag = "input", value, onSave, className = "", ...props }) {
  // Date and time pickers get set without ever blurring, so they save on change as well.
  // Text fields must not: that would fire a write on every keystroke.
  const picker = props.type === "date" || props.type === "time";
  return (
    <Tag
      key={value}
      defaultValue={value}
      onChange={picker ? (e) => e.target.value !== value && onSave(e.target.value) : undefined}
      onBlur={(e) => e.target.value !== value && onSave(e.target.value)}
      className={`${field} ${className}`}
      {...props}
    />
  );
}

export function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16" aria-busy="true">
      <div className="h-6 w-40 animate-pulse rounded-full bg-panel" />
      <div className="mt-6 h-16 w-2/3 animate-pulse rounded-2xl bg-panel" />
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl bg-panel" />
        <div className="h-64 animate-pulse rounded-2xl bg-panel" />
      </div>
    </main>
  );
}
