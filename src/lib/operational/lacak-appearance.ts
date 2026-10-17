export const LACAK_MODES = ["light", "dark", "system"] as const;
export const LACAK_PALETTES = ["graphite", "indigo", "crimson", "sage", "amber", "violet"] as const;
export const LACAK_DENSITIES = ["comfortable", "cozy", "compact"] as const;
export const LACAK_FONTS = ["geist", "inter", "mono"] as const;

export type LacakMode = (typeof LACAK_MODES)[number];
export type LacakPalette = (typeof LACAK_PALETTES)[number];
export type LacakDensity = (typeof LACAK_DENSITIES)[number];
export type LacakFont = (typeof LACAK_FONTS)[number];

export type LacakAppearance = {
  mode: LacakMode;
  palette: LacakPalette;
  density: LacakDensity;
  font: LacakFont;
};

export type LacakScheme = "lacak-light" | "lacak-dark";

export const DEFAULT_LACAK_APPEARANCE: LacakAppearance = {
  mode: "system",
  palette: "graphite",
  density: "cozy",
  font: "geist",
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Satu-satunya pintu masuk untuk nilai `organizations.lacak_appearance`.
 *
 * Nilainya berakhir sebagai nama class dan atribut `data-*` di halaman publik.
 * Karena itu setiap field diperiksa satu per satu dan yang tidak dikenal
 * jatuh ke default, bukan diteruskan. Pembacaan `value[field]` secara
 * langsung membuat `__proto__` milik baris JSON tidak pernah ikut terbaca.
 */
export function readLacakAppearance(value: unknown): LacakAppearance {
  const base = DEFAULT_LACAK_APPEARANCE;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ...base };
  const row = value as Record<string, unknown>;
  return {
    mode: pick(row.mode, LACAK_MODES, base.mode),
    palette: pick(row.palette, LACAK_PALETTES, base.palette),
    density: pick(row.density, LACAK_DENSITIES, base.density),
    font: pick(row.font, LACAK_FONTS, base.font),
  };
}

export function resolveLacakScheme(mode: LacakMode, prefersDark: boolean | undefined): LacakScheme {
  const gelap = prefersDark === true;
  const efektif = mode === "system" ? (gelap ? "dark" : "light") : mode;
  return efektif === "dark" ? "lacak-dark" : "lacak-light";
}

export type LacakThemeProps = {
  scheme: LacakScheme;
  "data-palette": LacakPalette;
  "data-density": LacakDensity;
  "data-font": LacakFont;
};

/**
 * Atribut untuk elemen pembungkus halaman Lacak.
 *
 * Tidak pernah memuat `style`: nilai theme masuk ke CSS lewat selector
 * `data-*` di `globals.css`, bukan lewat string CSS yang dirakit di sini.
 */
export function lacakThemeProps(appearance: LacakAppearance, scheme: LacakScheme): LacakThemeProps {
  const aman = readLacakAppearance(appearance);
  return {
    scheme,
    "data-palette": aman.palette,
    "data-density": aman.density,
    "data-font": aman.font,
  };
}
