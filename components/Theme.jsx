"use client";

import { useDb } from "@/lib/store";
import { DEFAULT_PALETTE, paletteCss } from "@/lib/palettes";

// R-37: the whole site takes its colours from whichever way Orchi picked in Studio.
export default function Theme() {
  const db = useDb();
  return <style id="colour-way">{paletteCss(db?.settings?.palette || DEFAULT_PALETTE)}</style>;
}
