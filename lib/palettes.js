// R-37: Orchi picks the colours himself, from options that are guaranteed to sit together.
// Every way keeps the same twelve token names and the same jobs, so only the hues move and no
// pick can break contrast: a near-black ground, one bright primary, one darker secondary that
// carries white text, and three decorative accents that always sit under ink-coloured text.
// R-36, his brand story: an overload of sugar that dies quickly. Saturated, sweet, short-lived.

export const PALETTES = {
  twitch: {
    name: "Twitch purple",
    note: "The one it launched with. Grape and lime.",
    tokens: { ink: "#0f0b17", panel: "#1a1326", raised: "#251b35", line: "#3a2d52", bone: "#f6f1ff", mist: "#b3a6c9", grape: "#9146ff", "grape-text": "#b48cff", lime: "#c6ff3d", pink: "#ff5fa2", cyan: "#3ddcff", orange: "#ffb23d" },
  },
  bubblegum: {
    name: "Bubblegum",
    note: "Pink first, sherbet yellow on top.",
    tokens: { ink: "#14090f", panel: "#22101a", raised: "#2e1724", line: "#4d2740", bone: "#fff0f7", mist: "#cba3bb", grape: "#d6006e", "grape-text": "#ff8ec4", lime: "#ffd166", pink: "#ff5fa2", cyan: "#56e0e0", orange: "#ff8a5c" },
  },
  slushie: {
    name: "Slushie",
    note: "Blue raspberry. Ice over deep navy.",
    tokens: { ink: "#070e1a", panel: "#0f1a2e", raised: "#16243d", line: "#294060", bone: "#eef6ff", mist: "#9db4d0", grape: "#2f6bff", "grape-text": "#8fb4ff", lime: "#45f0d0", pink: "#ff6ba8", cyan: "#3ddcff", orange: "#ffc14d" },
  },
  sherbet: {
    name: "Sherbet",
    note: "Warm dark, orange and peach.",
    tokens: { ink: "#17100a", panel: "#251a10", raised: "#322418", line: "#56371f", bone: "#fff3e6", mist: "#cdae91", grape: "#e2542a", "grape-text": "#ffa47a", lime: "#ffcf4d", pink: "#ff7a9a", cyan: "#57d6c4", orange: "#ffb23d" },
  },
  arcade: {
    name: "Arcade",
    note: "Cabinet green and magenta.",
    tokens: { ink: "#0a0f0a", panel: "#121b12", raised: "#1a261a", line: "#2e4a2e", bone: "#eaffea", mist: "#9dc39d", grape: "#a21caf", "grape-text": "#f0a6ff", lime: "#7dff5c", pink: "#ff4d9d", cyan: "#4de0ff", orange: "#ffc04d" },
  },
  mint: {
    name: "Mint",
    note: "Spearmint on a cold ground.",
    tokens: { ink: "#06110f", panel: "#0d1d19", raised: "#142a24", line: "#245045", bone: "#e9fff8", mist: "#94c2b3", grape: "#0f8f6c", "grape-text": "#7fe3c0", lime: "#7dffc4", pink: "#ff7ab3", cyan: "#57e5e5", orange: "#ffc46b" },
  },
};

export const PALETTE_KEYS = Object.keys(PALETTES);
export const DEFAULT_PALETTE = "twitch";
export const paletteOr = (key) => PALETTES[key] || PALETTES[DEFAULT_PALETTE];

// Rendered into a style tag after Tailwind's own :root block, so it wins on document order.
// The key never reaches the CSS: only values from the hardcoded set above are ever emitted.
// body already reads background-color from var(--color-ink) in globals.css, so the dot grid
// and every utility class follow these without another rule.
export function paletteCss(key) {
  const vars = Object.entries(paletteOr(key).tokens)
    .map(([name, value]) => `--color-${name}:${value};`)
    .join("");
  return `:root{${vars}}`;
}
