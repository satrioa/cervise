"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { LacakForm } from "@/components/public/lacak-form";
import { PublicFooter } from "@/components/public/public-footer";
import { TestimonialsCarousel } from "@/components/public/testimonials-carousel";
import { initialsOf } from "@/lib/photos";
import { saveLacakAppearance } from "@/app/app/pengaturan/tampilan/actions";
import {
  DEFAULT_LACAK_APPEARANCE,
  LACAK_DENSITIES,
  LACAK_FONTS,
  LACAK_PALETTES,
  resolveLacakScheme,
  type LacakAppearance,
} from "@/lib/operational/lacak-appearance";
import { LandingSection } from "@/components/settings-appearance-landing";
import type { PublicTenant } from "@/lib/public/landing";

const PALETTE_LABEL: Record<(typeof LACAK_PALETTES)[number], string> = {
  graphite: "Graphite",
  indigo: "Indigo",
  crimson: "Crimson",
  sage: "Sage",
  amber: "Amber",
  violet: "Violet",
};

const PALETTE_SWATCH: Record<(typeof LACAK_PALETTES)[number], [string, string]> = {
  graphite: ["#71717a", "#a1a1aa"],
  indigo: ["#3b82f6", "#1e40af"],
  crimson: ["#ef4444", "#991b1b"],
  sage: ["#22c55e", "#15803d"],
  amber: ["#f59e0b", "#b45309"],
  violet: ["#a855f7", "#7e22ce"],
};

const FONT_LABEL: Record<(typeof LACAK_FONTS)[number], string> = {
  geist: "Geist",
  inter: "Inter",
  mono: "Geist Mono",
};

/**
 * Nama keluarga untuk pratinjau huruf di kartu pilihan. Harus sama dengan
 * blok `.lacak-theme[data-font=...]` di `globals.css`, bukan dengan nama
 * `* Variable` yang tidak pernah dimuat.
 */
const FONT_SAMPLE_STACK: Record<(typeof LACAK_FONTS)[number], string> = {
  geist: "Geist, system-ui, sans-serif",
  inter: "Inter, system-ui, sans-serif",
  mono: '"Geist Mono", ui-monospace, "SF Mono", monospace',
};

const DENSITY_LABEL: Record<(typeof LACAK_DENSITIES)[number], string> = {
  comfortable: "Longgar",
  cozy: "Sedang",
  compact: "Padat",
};

export function SettingsAppearanceShowcasePage({ initial, tenant }: { initial: LacakAppearance; tenant: PublicTenant }) {
  const [tenantData, setTenant] = useState<PublicTenant>(tenant);
  const [draft, setDraft] = useState<LacakAppearance>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const set = <K extends keyof LacakAppearance>(key: K, value: LacakAppearance[K]) =>
    setDraft((sekarang) => ({ ...sekarang, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveLacakAppearance(draft);
      toast.success("Tampilan Lacak diperbarui");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => setDraft(initial);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <PageHeader
        title="Tampilan halaman Lacak"
        titleClassName="font-heading text-2xl"
        description="Berlaku untuk halaman lacak publik milik toko ini. Pengaturan di sini tidak mengubah tampilan aplikasi yang Anda pakai sendiri."
      />

      {dirty ? (
        <div className="fixed bottom-[84px] left-1/2 z-40 flex w-fit max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-3 rounded-2xl border bg-background/95 px-3 py-2.5 shadow-2xl shadow-black/15 backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl animate-in slide-in-from-bottom-2 fade-in-0 lg:bottom-6">
          <div aria-hidden className="absolute -top-1.5 left-1/2 hidden h-1 w-10 -translate-x-1/2 rounded-full bg-foreground/10 lg:block" />
          <span className="px-1 text-sm font-medium whitespace-nowrap">Ada perubahan</span>
          <span aria-hidden className="hidden h-4 w-px bg-border/60 sm:block" />
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" type="button" disabled={saving} onClick={handleDiscard}>
              Buang
            </Button>
            <Button size="sm" type="button" disabled={saving} onClick={handleSave}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <section>
              <SectionHeader title="Mode" hint="Terang, gelap, atau mengikuti perangkat pengunjung." />
              <div className="mt-4 grid max-w-2xl grid-cols-3 gap-3">
                <ModeCard
                  id="light"
                  label="Terang"
                  icon={<SunIcon className="size-3.5" />}
                  active={draft.mode === "light"}
                  onSelect={() => set("mode", "light")}
                  scheme="light"
                />
                <ModeCard
                  id="dark"
                  label="Gelap"
                  icon={<MoonIcon className="size-3.5" />}
                  active={draft.mode === "dark"}
                  onSelect={() => set("mode", "dark")}
                  scheme="dark"
                />
                <ModeCard
                  id="system"
                  label="Sistem"
                  icon={<MonitorIcon className="size-3.5" />}
                  active={draft.mode === "system"}
                  onSelect={() => set("mode", "system")}
                  scheme="split"
                />
              </div>
            </section>

            <section className="mt-10">
              <SectionHeader title="Palette" hint="Warna utama dan aksen." />
              <div className="mt-4 grid max-w-2xl grid-cols-3 gap-3 sm:grid-cols-6">
                {LACAK_PALETTES.map((p) => {
                  const swatch = PALETTE_SWATCH[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => set("palette", p)}
                      aria-pressed={draft.palette === p}
                      className={`group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                        draft.palette === p
                          ? "border-foreground/60 bg-foreground/[0.04]"
                          : "border-border/60 bg-background/40 hover:border-border"
                      }`}
                    >
                      <div className="relative flex size-12 items-center justify-center">
                        <span
                          className="absolute size-12 rounded-full opacity-30 blur-md"
                          style={{ background: swatch[0] }}
                        />
                        <span
                          className="relative size-7 rounded-full ring-2 ring-background"
                          style={{ background: swatch[0] }}
                        />
                        <span
                          className="-ml-3 relative size-7 rounded-full ring-2 ring-background"
                          style={{ background: swatch[1] }}
                        />
                      </div>
                      <span className="font-medium text-xs">{PALETTE_LABEL[p]}</span>
                      {draft.palette === p ? (
                        <CheckIcon className="absolute top-1.5 right-1.5 size-3 opacity-80" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-10">
              <SectionHeader title="Density" hint="Renggang untuk dibaca, rapat untuk layar kecil." />
              <div className="mt-4 max-w-2xl rounded-xl border border-border/60 bg-background/40 p-1">
                <div className="grid grid-cols-3 gap-1">
                  {LACAK_DENSITIES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => set("density", d)}
                      aria-pressed={draft.density === d}
                      className={`rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        draft.density === d
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
                      }`}
                    >
                      {DENSITY_LABEL[d]}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-10">
              <SectionHeader title="Font" hint="Berlaku untuk halaman Lacak, bukan untuk aplikasi." />
              <div className="mt-4 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                {LACAK_FONTS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => set("font", f)}
                    aria-pressed={draft.font === f}
                    className={`relative rounded-xl border p-4 text-left transition-colors ${
                      draft.font === f
                        ? "border-foreground/60 bg-foreground/[0.04]"
                        : "border-border/60 bg-background/40 hover:border-border"
                    }`}
                  >
                    <div className="text-xl tracking-tight" style={{ fontFamily: FONT_SAMPLE_STACK[f] }}>
                      AaBbCc 0123
                    </div>
                    <div className="mt-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
                      {FONT_LABEL[f]}
                    </div>
                    {draft.font === f ? (
                      <CheckIcon className="absolute top-2.5 right-2.5 size-3.5 opacity-80" />
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-12 lg:self-start">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Pratinjau</div>
            <div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
              <span>Menampilkan halaman Lacak sungguhan.</span>
              <button
                type="button"
                onClick={() => setDraft({ ...DEFAULT_LACAK_APPEARANCE })}
                className="font-mono text-[10px] uppercase tracking-[0.25em] transition-colors hover:text-foreground"
              >
                Default
              </button>
            </div>
            <div className="mt-2 overflow-hidden rounded-xl border border-border/60">
              <LacakPreview appearance={draft} tenant={tenantData} />
            </div>
          </aside>
        </div>

        <LandingSection tenant={tenantData} onSaved={setTenant} />
      </div>
    </div>
  );
}

/**
 * Pratinjau memakai komponen halaman Lacak yang sungguhan di dalam pembungkus
 * `.lacak-theme`, bukan tiruan dengan hex hardcode. Hex di sini dulu tidak
 * cocok dengan `globals.css`, jadi apa yang dilihat admin tidak sama dengan
 * yang dilihat pelanggan; sekarang keduanya membaca token yang sama.
 */
function LacakPreview({ appearance, tenant }: { appearance: LacakAppearance; tenant: PublicTenant }) {
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const scheme = resolveLacakScheme(appearance.mode, prefersDark);

  return (
    <div
      className={`lacak-theme ${scheme} max-h-[620px] overflow-y-auto bg-background`}
      data-palette={appearance.palette}
      data-density={appearance.density}
      data-font={appearance.font}
    >
      <div className="relative h-[168px] shrink-0 overflow-hidden">
        <div className="absolute inset-0">
          {tenant.bannerUrl ? (
            <Image src={tenant.bannerUrl} alt="" fill sizes="360px" unoptimized className="object-cover" />
          ) : (
            <div className="size-full bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary)_55%,var(--background)))]" />
          )}
        </div>
        <div className="absolute inset-0 bg-background/45" aria-hidden />
        <div className="absolute inset-0 flex items-center gap-2 px-3 pt-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-[10px] font-bold">
            {initialsOf(tenant.name)}
          </span>
          <span className="min-w-0 flex-1 truncate text-center font-heading text-xs font-bold">{tenant.name}</span>
          <span className="size-8 shrink-0" aria-hidden />
        </div>
        {tenant.tagline ? (
          <p className="absolute inset-x-0 bottom-3 px-4 text-center text-[13px] font-bold leading-tight">{tenant.tagline}</p>
        ) : null}
      </div>

      <div className="relative -mt-5 rounded-t-2xl border-t bg-background px-3 pb-2">
        <LacakForm tenant={tenant} preview />
        <TestimonialsCarousel items={tenant.testimonials} />
      </div>

      <PublicFooter
        name={tenant.name}
        instagramUrl={tenant.instagramUrl}
        tiktokUrl={tenant.tiktokUrl}
        address={tenant.branchAddress}
        phone={tenant.branchPhone}
      />
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="font-heading text-base">{title}</h2>
      {hint ? <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ModeCard({
  id,
  label,
  icon,
  active,
  onSelect,
  scheme,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onSelect: () => void;
  scheme: "light" | "dark" | "split";
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
        active ? "border-foreground/60 bg-foreground/[0.04]" : "border-border/60 bg-background/40 hover:border-border"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {label}
        </span>
        {active ? <CheckIcon className="size-3.5 opacity-80" /> : null}
      </div>
      <ModePreview scheme={scheme} />
      {id ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}

function ModePreview({ scheme }: { scheme: "light" | "dark" | "split" }) {
  if (scheme === "split") {
    return (
      <div className="flex h-14 w-full overflow-hidden rounded-md ring-1 ring-border/60">
        <div className="w-1/2 bg-[#fafafa]" />
        <div className="w-1/2 bg-[#0a0a0a]" />
      </div>
    );
  }
  return (
    <div
      className={`h-14 w-full rounded-md ring-1 ring-border/60 ${scheme === "light" ? "bg-[#fafafa]" : "bg-[#0a0a0a]"}`}
    />
  );
}
