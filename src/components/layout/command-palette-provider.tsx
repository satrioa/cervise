"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { CerviseCommandPalette } from "./command-palette";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type CommandPaletteContextValue = {
  openPalette: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return ctx;
}

export function CommandPaletteProvider({
  children,
  role,
}: {
  children: ReactNode;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ openPalette }}>
      {children}
      <CerviseCommandPalette open={open} onOpenChange={setOpen} role={role} />
    </CommandPaletteContext.Provider>
  );
}

export function CommandSearchTrigger({
  className,
  "aria-label": ariaLabel,
}: {
  className?: string;
  "aria-label"?: string;
}) {
  const { openPalette } = useCommandPalette();
  const t = useTranslations("nav");
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label={ariaLabel ?? t("search.placeholder")}
      className={cn(
        "flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.04]",
        className,
      )}
    >
      <Search className="size-3.5 shrink-0 opacity-50" />
      <span className="hidden truncate text-xs text-muted-foreground md:inline">{t("search.placeholder")}</span>
      <kbd className="hidden rounded border border-border/60 bg-background/80 px-1 font-mono text-[9px] text-muted-foreground sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
