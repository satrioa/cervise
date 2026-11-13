"use client";

import * as React from "react";

export type StyleWorld = "minimal" | "scifi" | "toy" | "craft";

const STORAGE_KEY = "cervise-style-world";
const COOKIE_KEY = "cervise-style-world";

const VALID: StyleWorld[] = ["minimal", "scifi", "toy", "craft"];

export const STYLE_WORLDS: { value: StyleWorld; label: string; comingSoon?: boolean }[] = [
  { value: "minimal", label: "Minimal" },
  { value: "scifi", label: "Scifi" },
  { value: "toy", label: "Toy", comingSoon: true },
  { value: "craft", label: "Craft", comingSoon: true },
];

type Ctx = { world: StyleWorld; setWorld: (w: StyleWorld) => void };

const StyleWorldContext = React.createContext<Ctx | null>(null);

function readStored(): StyleWorld {
  if (typeof window === "undefined") return "minimal";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (VALID as string[]).includes(raw)) return raw as StyleWorld;
  } catch {}
  return "minimal";
}

export function StyleWorldProvider({ children }: { children: React.ReactNode }) {
  const [world, setWorldState] = React.useState<StyleWorld>("minimal");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setWorldState(readStored());
    setMounted(true);
  }, []);

  const setWorld = React.useCallback((w: StyleWorld) => {
    setWorldState(w);
    try {
      window.localStorage.setItem(STORAGE_KEY, w);
    } catch {}
    try {
      document.cookie = `${COOKIE_KEY}=${w}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
  }, []);

  // Apply attribute to document root for global scoping
  React.useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-ui-world", world);
  }, [world, mounted]);

  const value = React.useMemo(() => ({ world, setWorld }), [world, setWorld]);
  return <StyleWorldContext.Provider value={value}>{children}</StyleWorldContext.Provider>;
}

export function useStyleWorld(): Ctx {
  const ctx = React.useContext(StyleWorldContext);
  if (!ctx) return { world: "minimal", setWorld: () => {} };
  return ctx;
}
