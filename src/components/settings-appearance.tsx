"use client";

"use client";

import { useState } from "react";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

type Mode = "light" | "dark" | "system";
type Density = "comfortable" | "cozy" | "compact";
type Palette = "graphite" | "indigo" | "crimson" | "sage" | "amber" | "violet";
type FontId = "geist" | "inter" | "mono";

const PALETTES: { id: Palette; name: string; swatch: [string, string] }[] = [
  { id: "graphite", name: "Graphite", swatch: ["#71717a", "#a1a1aa"] },
  { id: "indigo", name: "Indigo", swatch: ["#3b82f6", "#1e40af"] },
  { id: "crimson", name: "Crimson", swatch: ["#ef4444", "#991b1b"] },
  { id: "sage", name: "Sage", swatch: ["#22c55e", "#15803d"] },
  { id: "amber", name: "Amber", swatch: ["#f59e0b", "#b45309"] },
  { id: "violet", name: "Violet", swatch: ["#a855f7", "#7e22ce"] },
];

const FONTS: { id: FontId; label: string; sample: string; stack: string }[] = [
  {
    id: "geist",
    label: "Geist",
    sample: "AaBbCc 0123",
    stack: '"Geist Variable", "Geist", system-ui, sans-serif',
  },
  {
    id: "inter",
    label: "Inter",
    sample: "AaBbCc 0123",
    stack: '"Inter Variable", "Inter", system-ui, sans-serif',
  },
  {
    id: "mono",
    label: "Geist Mono",
    sample: "AaBbCc 0123",
    stack:
      '"Geist Mono Variable", "Geist Mono", ui-monospace, "SF Mono", monospace',
  },
];

const DENSITY: Record<
  Density,
  { padCard: string; padRow: string; gapStack: string; rowH: string; text: string }
> = {
  comfortable: { padCard: "20px", padRow: "12px 14px", gapStack: "14px", rowH: "44px", text: "14px" },
  cozy: { padCard: "16px", padRow: "10px 12px", gapStack: "10px", rowH: "38px", text: "13.5px" },
  compact: { padCard: "12px", padRow: "6px 10px", gapStack: "6px", rowH: "30px", text: "12.5px" },
};

const SCHEMES = {
  light: {
    bg: "#fafafa",
    surface: "#ffffff",
    surfaceMuted: "#f4f4f5",
    text: "#0a0a0a",
    textMuted: "#71717a",
    border: "#e4e4e7",
    rail: "#f4f4f5",
    railBorder: "#e4e4e7",
    activeWash: "rgba(0,0,0,0.05)",
  },
  dark: {
    bg: "#0a0a0a",
    surface: "#141416",
    surfaceMuted: "#101012",
    text: "#fafafa",
    textMuted: "#a1a1aa",
    border: "#27272a",
    rail: "#101012",
    railBorder: "#27272a",
    activeWash: "rgba(255,255,255,0.06)",
  },
} as const;

type Scheme = (typeof SCHEMES)[keyof typeof SCHEMES];

function getOsScheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function SettingsAppearanceShowcasePage() {
  const [mode, setMode] = useState<Mode>("system");
  const [density, setDensity] = useState<Density>("cozy");
  const [palette, setPalette] = useState<Palette>("graphite");
  const [font, setFont] = useState<FontId>("geist");

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
          Settings · Appearance
        </div>
        <h1 className="mt-1 font-heading text-3xl">Make it yours</h1>
        <p className="mt-1.5 text-muted-foreground text-sm">
          Tweak everything from the comfort of one screen. Changes preview live
          on the right — they don't touch the rest of the app.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <section>
              <SectionHeader
                title="Mode"
                hint="Light, dark, or follow your system."
              />
              <div className="mt-4 grid max-w-2xl grid-cols-3 gap-3">
                <ModeCard
                  id="light"
                  label="Light"
                  icon={<SunIcon className="size-3.5" />}
                  active={mode === "light"}
                  onSelect={setMode}
                  scheme="light"
                />
                <ModeCard
                  id="dark"
                  label="Dark"
                  icon={<MoonIcon className="size-3.5" />}
                  active={mode === "dark"}
                  onSelect={setMode}
                  scheme="dark"
                />
                <ModeCard
                  id="system"
                  label="System"
                  icon={<MonitorIcon className="size-3.5" />}
                  active={mode === "system"}
                  onSelect={setMode}
                  scheme="split"
                />
              </div>
            </section>

            <section className="mt-10">
              <SectionHeader
                title="Palette"
                hint="Accent and primary colours."
              />
              <div className="mt-4 grid max-w-2xl grid-cols-3 gap-3 sm:grid-cols-6">
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPalette(p.id)}
                    aria-pressed={palette === p.id}
                    className={`group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                      palette === p.id
                        ? "border-foreground/60 bg-foreground/[0.04]"
                        : "border-border/60 bg-background/40 hover:border-border"
                    }`}
                  >
                    <div className="relative flex size-12 items-center justify-center">
                      <span
                        className="absolute size-12 rounded-full opacity-30 blur-md"
                        style={{ background: p.swatch[0] }}
                      />
                      <span
                        className="relative size-7 rounded-full ring-2 ring-background"
                        style={{ background: p.swatch[0] }}
                      />
                      <span
                        className="-ml-3 relative size-7 rounded-full ring-2 ring-background"
                        style={{ background: p.swatch[1] }}
                      />
                    </div>
                    <span className="font-medium text-xs">{p.name}</span>
                    {palette === p.id ? (
                      <CheckIcon className="absolute top-1.5 right-1.5 size-3 opacity-80" />
                    ) : null}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-10">
              <SectionHeader
                title="Density"
                hint="Tighter spacing for power users, looser for clarity."
              />
              <div className="mt-4 max-w-2xl rounded-xl border border-border/60 bg-background/40 p-1">
                <div className="grid grid-cols-3 gap-1">
                  {(["comfortable", "cozy", "compact"] as Density[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDensity(d)}
                      aria-pressed={density === d}
                      className={`rounded-lg px-3 py-2.5 text-sm capitalize transition-colors ${
                        density === d
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-10">
              <SectionHeader title="Font" hint="Used everywhere except code." />
              <div className="mt-4 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFont(f.id)}
                    aria-pressed={font === f.id}
                    className={`relative rounded-xl border p-4 text-left transition-colors ${
                      font === f.id
                        ? "border-foreground/60 bg-foreground/[0.04]"
                        : "border-border/60 bg-background/40 hover:border-border"
                    }`}
                  >
                    <div
                      className="text-xl tracking-tight"
                      style={{ fontFamily: f.stack }}
                    >
                      {f.sample}
                    </div>
                    <div className="mt-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
                      {f.label}
                    </div>
                    {font === f.id ? (
                      <CheckIcon className="absolute top-2.5 right-2.5 size-3.5 opacity-80" />
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-12 lg:self-start">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
              Preview
            </div>
            <div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
              <span>Reflects only this page.</span>
              <button
                type="button"
                onClick={() => {
                  setMode("system");
                  setDensity("cozy");
                  setPalette("graphite");
                  setFont("geist");
                }}
                className="font-mono text-[10px] uppercase tracking-[0.25em] transition-colors hover:text-foreground"
              >
                Reset
              </button>
            </div>
            <PreviewPane
              mode={mode}
              palette={palette}
              density={density}
              font={font}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function PreviewPane({
  mode,
  palette,
  density,
  font,
}: {
  mode: Mode;
  palette: Palette;
  density: Density;
  font: FontId;
}) {
  const effectiveMode: "light" | "dark" =
    mode === "system" ? getOsScheme() : mode;
  const s = SCHEMES[effectiveMode];
  const accent = PALETTES.find((p) => p.id === palette)!.swatch[0];
  const accentSoft = PALETTES.find((p) => p.id === palette)!.swatch[1];
  const fontStack = FONTS.find((f) => f.id === font)!.stack;
  const d = DENSITY[density];

  return (
    <div
      className="mt-3 overflow-hidden rounded-xl ring-1 ring-border/60 shadow-sm"
      style={{
        background: s.bg,
        color: s.text,
        fontFamily: fontStack,
        fontSize: d.text,
      }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-1.5 text-[10px] uppercase tracking-[0.25em]"
        style={{ borderColor: s.border, color: s.textMuted }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="size-1.5 rounded-full"
            style={{ background: accent }}
          />
          Acme · Workspace
        </div>
        <div className="flex items-center gap-1">
          <span className="size-1.5 rounded-full" style={{ background: "#ef4444", opacity: 0.7 }} />
          <span className="size-1.5 rounded-full" style={{ background: "#f59e0b", opacity: 0.7 }} />
          <span className="size-1.5 rounded-full" style={{ background: "#22c55e", opacity: 0.7 }} />
        </div>
      </div>

      <div className="grid grid-cols-[80px_1fr]">
        <div
          className="flex flex-col items-center gap-1.5 border-r"
          style={{
            background: s.rail,
            borderColor: s.railBorder,
            padding: "10px 0",
          }}
        >
          <div
            className="flex size-7 items-center justify-center rounded-md text-[11px] font-medium"
            style={{
              background: accent,
              color: effectiveMode === "light" ? "#fff" : "#fff",
            }}
          >
            A
          </div>
          <RailItem active scheme={s} accent={accent}>
            ●
          </RailItem>
          <RailItem scheme={s}>○</RailItem>
          <RailItem scheme={s}>◇</RailItem>
          <div className="mt-auto" />
          <RailItem scheme={s}>⚙</RailItem>
        </div>

        <div
          className="flex flex-col"
          style={{ padding: d.padCard, gap: d.gapStack }}
        >
          <div
            className="flex items-center justify-between"
            style={{ minHeight: d.rowH }}
          >
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.25em]"
                style={{ color: s.textMuted }}
              >
                Project · Q3 planning
              </div>
              <div
                className="mt-0.5 font-medium"
                style={{ fontSize: `calc(${d.text} + 4px)` }}
              >
                Roadmap notes
              </div>
            </div>
            <button
              type="button"
              className="rounded-md px-2.5 font-medium"
              style={{
                background: accent,
                color: "#fff",
                fontSize: `calc(${d.text} - 1px)`,
                height: `calc(${d.rowH} - 8px)`,
              }}
            >
              Save
            </button>
          </div>

          <div
            className="rounded-lg border"
            style={{
              background: s.surface,
              borderColor: s.border,
              padding: d.padCard,
            }}
          >
            <div
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em]"
              style={{ color: s.textMuted }}
            >
              <span
                className="rounded-full px-1.5 py-0.5"
                style={{
                  background: `${accent}22`,
                  color: accentSoft,
                  letterSpacing: "0.2em",
                }}
              >
                Pro
              </span>
              Updated 2m ago
            </div>
            <div
              className="mt-2 font-medium"
              style={{ fontSize: `calc(${d.text} + 1px)` }}
            >
              Three things shipped this week.
            </div>
            <p
              className="mt-1 leading-relaxed"
              style={{ color: s.textMuted, fontSize: `calc(${d.text} - 1px)` }}
            >
              The audit log API, scoped invites, and a simpler pricing page.
              Light read.
            </p>
          </div>

          <div className="flex flex-col" style={{ gap: d.gapStack }}>
            <Row scheme={s} density={d}>
              <span
                className="inline-flex items-center gap-2"
                style={{ color: s.text }}
              >
                <span
                  className="flex size-3.5 items-center justify-center rounded-sm"
                  style={{ background: accent }}
                >
                  <CheckIcon className="size-2.5" style={{ color: "#fff" }} />
                </span>
                Two-factor auth
              </span>
              <ToggleDot on accent={accent} scheme={s} />
            </Row>
            <Row scheme={s} density={d}>
              <span style={{ color: s.text }}>Public sign-up</span>
              <ToggleDot accent={accent} scheme={s} />
            </Row>
            <Row scheme={s} density={d}>
              <span style={{ color: s.text }}>Show project IDs</span>
              <ToggleDot on accent={accent} scheme={s} />
            </Row>
          </div>

          <div
            className="flex items-center justify-between border-t pt-2 text-[10px] uppercase tracking-[0.25em]"
            style={{ borderColor: s.border, color: s.textMuted }}
          >
            <span>Mode · {effectiveMode}</span>
            <span>{density}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RailItem({
  children,
  active,
  scheme,
  accent,
}: {
  children: React.ReactNode;
  active?: boolean;
  scheme: Scheme;
  accent?: string;
}) {
  return (
    <div className="relative">
      {active ? (
        <span
          className="-translate-y-1/2 absolute top-1/2 -left-2 h-3 w-1 rounded-r-full"
          style={{ background: accent }}
        />
      ) : null}
      <div
        className="flex size-7 items-center justify-center rounded-md text-[10px]"
        style={{
          background: active ? scheme.activeWash : "transparent",
          color: active ? scheme.text : scheme.textMuted,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({
  children,
  scheme,
  density,
}: {
  children: React.ReactNode;
  scheme: Scheme;
  density: (typeof DENSITY)[Density];
}) {
  return (
    <div
      className="flex items-center justify-between rounded-md border"
      style={{
        background: scheme.surface,
        borderColor: scheme.border,
        padding: density.padRow,
      }}
    >
      {children}
    </div>
  );
}

function ToggleDot({
  on,
  accent,
  scheme,
}: {
  on?: boolean;
  accent: string;
  scheme: Scheme;
}) {
  return (
    <span
      className="relative inline-block h-4 w-7 rounded-full transition-colors"
      style={{
        background: on ? accent : scheme.border,
      }}
    >
      <span
        className="absolute top-0.5 size-3 rounded-full transition-all"
        style={{
          background: "#fff",
          left: on ? "calc(100% - 14px)" : "2px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }}
      />
    </span>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <header>
      <h2 className="font-heading text-base">{title}</h2>
      {hint ? (
        <p className="mt-1 text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </header>
  );
}

function ModeCard({
  id,
  label,
  icon,
  scheme,
  active,
  onSelect,
}: {
  id: Mode;
  label: string;
  icon: React.ReactNode;
  scheme: "light" | "dark" | "split";
  active: boolean;
  onSelect: (m: Mode) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={active}
      className={`group flex flex-col gap-3 overflow-hidden rounded-xl border transition-colors ${
        active
          ? "border-foreground/60 bg-foreground/[0.04]"
          : "border-border/60 bg-background/40 hover:border-border"
      }`}
    >
      <ModePreview scheme={scheme} />
      <div className="flex items-center justify-between px-3 pb-3 text-sm">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        {active ? <CheckIcon className="size-3.5 opacity-80" /> : null}
      </div>
    </button>
  );
}

function ModePreview({ scheme }: { scheme: "light" | "dark" | "split" }) {
  if (scheme === "split") {
    return (
      <div className="relative h-24 w-full">
        <div
          className="absolute inset-0"
          style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
        >
          <MiniChrome scheme="light" />
        </div>
        <div
          className="absolute inset-0"
          style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
        >
          <MiniChrome scheme="dark" />
        </div>
      </div>
    );
  }
  return <MiniChrome scheme={scheme} />;
}

function MiniChrome({ scheme }: { scheme: "light" | "dark" }) {
  const s = SCHEMES[scheme];
  return (
    <div className="flex h-24" style={{ background: s.bg }}>
      <div
        className="flex w-[26px] flex-col items-center gap-1.5 border-r py-2"
        style={{ background: s.rail, borderColor: s.railBorder }}
      >
        <span
          className="size-2.5 rounded"
          style={{ background: "var(--primary)" }}
        />
        <span className="size-1.5 rounded-sm" style={{ background: s.textMuted, opacity: 0.45 }} />
        <span className="size-1.5 rounded-sm" style={{ background: s.textMuted, opacity: 0.25 }} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
        <span
          className="h-1 w-12 rounded-full"
          style={{ background: s.textMuted, opacity: 0.45 }}
        />
        <div
          className="flex flex-1 flex-col justify-between rounded-md border p-1.5"
          style={{ background: s.surface, borderColor: s.border }}
        >
          <span
            className="h-1 w-10 rounded-full"
            style={{ background: s.textMuted, opacity: 0.45 }}
          />
          <span
            className="inline-flex h-3 items-center rounded px-1.5 font-semibold text-[7px] text-white"
            style={{ background: "var(--primary)" }}
          >
            Go
          </span>
        </div>
      </div>
    </div>
  );
}
