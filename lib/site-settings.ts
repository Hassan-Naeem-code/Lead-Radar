// The live, DB-driven theme + brand. Palette keys map 1:1 to the CSS custom
// properties in app/globals.css, so getSiteSettings() -> themeCss() can override
// the static defaults site-wide.
//
// This module is CLIENT-SAFE (no server imports) so client components can import
// the types/constants. The DB read lives in lib/site-settings.server.ts.

export type SiteSettings = {
  brand_name: string;
  tagline: string;
  logo_url: string | null;
  bg: string;
  panel: string;
  panel2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  hot: string;
  warm: string;
  cool: string;
};

// Defaults mirror app/globals.css :root — so the site looks identical before
// anything is configured, and unset fields always fall back cleanly.
export const DEFAULT_SETTINGS: SiteSettings = {
  brand_name: "Fresh Leads",
  tagline: "Verified local business leads, on demand.",
  logo_url: null,
  bg: "#0a0e17",
  panel: "#121826",
  panel2: "#1a2233",
  border: "#26304a",
  text: "#e7ecf5",
  muted: "#8a97b1",
  accent: "#4f8cff",
  accent2: "#23b673",
  hot: "#ff5470",
  warm: "#ffb23e",
  cool: "#46c1a0",
};

// Palette fields only (excludes brand_name/tagline/logo_url), in CSS order.
export const PALETTE_KEYS = [
  "bg", "panel", "panel2", "border", "text", "muted",
  "accent", "accent2", "hot", "warm", "cool",
] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

export const SETTINGS_SELECT_COLS =
  "brand_name,tagline,logo_url,bg,panel,panel2,border,text,muted,accent,accent2,hot,warm,cool";

// Build the CSS that overrides globals.css. `html:root` outspecifies the file's
// `:root`, so DB values win regardless of stylesheet order.
export function themeCss(s: SiteSettings): string {
  const decls = PALETTE_KEYS.map((k) => `--${k}:${s[k]}`).join(";");
  return `html:root{${decls}}`;
}
