"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  ClockIcon,
  GlobeIcon,
  HashIcon,
  LanguagesIcon,
  SearchIcon,
  CalendarDaysIcon,
  CoinsIcon,
  CalendarRangeIcon,
} from "lucide-react";
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "@/components/ui/autocomplete";
import { Label } from "@/components/ui/label";
import { RadioGroup, Radio } from "@/components/ui/radio-group";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useLocale,
  LANGUAGES,
  TIMEZONES,
  CURRENCIES,
  DATE_FORMATS,
  NUMBER_FORMATS,
  formatDate,
  formatTime,
  buildWeek,
  firstDayLabel,
  type FirstDay,
  type TimeFormat,
  type DateFormatId,
  type NumberFormatId,
  type LocaleState,
  type TimezoneItem,
} from "@/lib/localization-context";
import { updateLocale as updateLocaleAction } from "@/app/app/pengaturan/lokalisasi/actions";

export function SettingsLocalizationShowcasePage() {
  const { locale, setLocale } = useLocale();
  const [draft, setDraft] = useState<LocaleState>(locale);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(locale);
  }, [locale]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(locale);

  const language = draft.language;
  const timezone = draft.timezone;
  const firstDay = draft.firstDay;
  const dateFormat = draft.dateFormat;
  const timeFormat = draft.timeFormat;
  const currency = draft.currency;
  const numberFormat = draft.numberFormat;

  const set = (patch: Partial<LocaleState>) => setDraft((p) => ({ ...p, ...patch }));

  const previewDate = useMemo(() => new Date(), []);

  const formattedDate = useMemo(() => formatDate(previewDate, dateFormat, timezone), [previewDate, dateFormat, timezone]);
  const formattedTime = useMemo(() => formatTime(previewDate, timeFormat, language, timezone), [previewDate, timeFormat, language, timezone]);
  const formattedNumber = useMemo(() => {
    const loc = NUMBER_FORMATS.find((n) => n.id === numberFormat)?.locale;
    return new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234567.89);
  }, [numberFormat]);
  const formattedCurrency = useMemo(() => {
    const loc = NUMBER_FORMATS.find((n) => n.id === numberFormat)?.locale;
    return new Intl.NumberFormat(loc, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(99999);
  }, [numberFormat, currency]);
  const formattedRelative = useMemo(() => {
    try {
      const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
      return rtf.format(-2, "hour");
    } catch {
      return "2 hours ago";
    }
  }, [language]);
  const week = useMemo(() => buildWeek(previewDate, firstDay, language), [previewDate, firstDay, language]);
  const tzItem = TIMEZONES.find((t) => t.value === timezone);

  const handleSave = async () => {
    setSaving(true);
    try {
      setLocale(draft);
      await updateLocaleAction(draft);
      toast.success("Lokalisasi diperbarui");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };
  const handleDiscard = () => setDraft(locale);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-10 sm:py-14 pb-32">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Account · Localization</div>
        <h1 className="mt-1 font-heading text-3xl">Localization</h1>
        <p className="mt-1.5 max-w-xl text-muted-foreground text-sm">
          Pick how dates, times, numbers, and currencies are shown to you across the app. Perubahan tersimpan ke akun dan berlaku global.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex flex-col">
            <Section title="Language" icon={<LanguagesIcon className="size-4" />} hint="The language used across menus, emails, and notifications.">
              <Field label="Display language" htmlFor="loc-lang">
                <Select value={language} onValueChange={(v) => v && set({ language: v })}>
                  <SelectTrigger id="loc-lang" className="w-full">
                    <SelectValue>
                      {(() => {
                        const l = LANGUAGES.find((x) => x.value === language);
                        return l ? (
                          <span className="flex items-center gap-2">
                            <span aria-hidden className="text-base">
                              {l.flag}
                            </span>
                            <span>{l.label}</span>
                          </span>
                        ) : null;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        <span className="flex items-center gap-2">
                          <span aria-hidden className="text-base">
                            {l.flag}
                          </span>
                          <span>{l.label}</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{l.bcp47}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </Field>
            </Section>

            <Separator className="my-8" />

            <Section title="Time & region" icon={<GlobeIcon className="size-4" />} hint="Used for times, dates, and the calendar grid.">
              <Field label="Timezone" htmlFor="loc-tz" hint="Search any city or region.">
                <TimezoneAutocomplete value={timezone} label={tzItem?.label ?? timezone} onChange={(v) => set({ timezone: v })} />
              </Field>
              <Field label="First day of week" htmlFor="loc-first">
                <ToggleGroup
                  value={[firstDay]}
                  onValueChange={(v) => {
                    const next = (v as string[])[0];
                    if (next === "sun" || next === "mon" || next === "sat") set({ firstDay: next as FirstDay });
                  }}
                  variant="outline"
                  aria-label="First day of week"
                >
                  <ToggleGroupItem value="sun">Sunday</ToggleGroupItem>
                  <ToggleGroupItem value="mon">Monday</ToggleGroupItem>
                  <ToggleGroupItem value="sat">Saturday</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field label="Date format">
                <RadioGroup value={dateFormat} onValueChange={(v) => v && set({ dateFormat: v as DateFormatId })} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DATE_FORMATS.map((d) => {
                    const checked = dateFormat === d.id;
                    return (
                      <label
                        key={d.id}
                        className={`group relative flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${checked ? "border-ring bg-accent/40" : "border-border/60 hover:bg-foreground/[0.03]"}`}
                      >
                        <Radio value={d.id} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-mono text-sm">{d.example}</span>
                            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">{d.hint}</span>
                          </div>
                          <p className="mt-0.5 text-muted-foreground text-xs">{d.label}</p>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </Field>
              <Field label="Time format">
                <div className="grid grid-cols-2 gap-2">
                  {(["h12", "h24"] as const).map((id) => {
                    const checked = timeFormat === id;
                    const example = formatTime(previewDate, id, language, timezone);
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => set({ timeFormat: id })}
                        className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${checked ? "border-ring bg-accent/40" : "border-border/60 hover:bg-foreground/[0.03]"}`}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="font-medium text-sm">{id === "h12" ? "12-hour" : "24-hour"}</span>
                          {checked ? <CheckIcon className="size-3.5 text-primary" /> : null}
                        </div>
                        <span className="font-mono text-muted-foreground text-xs">{example}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </Section>

            <Separator className="my-8" />

            <Section title="Numbers & currency" icon={<HashIcon className="size-4" />} hint="How numeric values are grouped, separated, and prefixed.">
              <Field label="Currency" htmlFor="loc-currency">
                <Select value={currency} onValueChange={(v) => v && set({ currency: v })}>
                  <SelectTrigger id="loc-currency" className="w-full">
                    <SelectValue>
                      {(() => {
                        const c = CURRENCIES.find((x) => x.value === currency);
                        return c ? (
                          <span className="flex items-center gap-2">
                            <span className="inline-flex size-5 items-center justify-center rounded bg-foreground/[0.06] font-mono text-xs">{c.symbol}</span>
                            <span>{c.label}</span>
                          </span>
                        ) : null;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <span className="inline-flex size-5 items-center justify-center rounded bg-foreground/[0.06] font-mono text-xs">{c.symbol}</span>
                          <span>{c.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <p className="text-muted-foreground text-xs">Harga dalam {currency} — global ke seluruh app.</p>
              </Field>
              <Field label="Number format">
                <RadioGroup value={numberFormat} onValueChange={(v) => v && set({ numberFormat: v as NumberFormatId })} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {NUMBER_FORMATS.map((n) => {
                    const checked = numberFormat === n.id;
                    return (
                      <label
                        key={n.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${checked ? "border-ring bg-accent/40" : "border-border/60 hover:bg-foreground/[0.03]"}`}
                      >
                        <Radio value={n.id} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-sm">{n.example}</div>
                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">{n.hint}</div>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </Field>
            </Section>
          </div>

          <aside className="lg:sticky lg:top-12 lg:self-start">
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs/5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Today&apos;s preview</div>
                  <div className="mt-1 font-heading text-base">Live formatting</div>
                </div>
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-foreground/[0.06]">
                  <GlobeIcon className="size-4 opacity-70" />
                </span>
              </div>
              <Separator className="my-4" />
              <dl className="flex flex-col divide-y divide-border/50">
                <PreviewRow icon={<CalendarDaysIcon className="size-3.5" />} label="Date" value={formattedDate} />
                <PreviewRow icon={<ClockIcon className="size-3.5" />} label="Time" value={formattedTime} />
                <PreviewRow icon={<HashIcon className="size-3.5" />} label="Number" value={formattedNumber} />
                <PreviewRow icon={<CoinsIcon className="size-3.5" />} label="Currency" value={formattedCurrency} />
                <PreviewRow icon={<CalendarRangeIcon className="size-3.5" />} label="Relative" value={formattedRelative} />
              </dl>
              <Separator className="my-4" />
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Calendar</span>
                  <span className="text-muted-foreground text-xs">Week starts {firstDayLabel(firstDay)}</span>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {week.map((d) => (
                    <div
                      key={d.iso}
                      className={`flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-center ${d.isToday ? "border-ring bg-accent/40" : "border-border/50 bg-background/40"}`}
                    >
                      <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.18em]">{d.weekday}</span>
                      <span className={`font-medium text-sm ${d.isToday ? "text-foreground" : "text-foreground/80"}`}>{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-foreground/[0.04] p-3">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Preview uses <span className="font-mono text-[11px]">Intl.DateTimeFormat</span> and <span className="font-mono text-[11px]">Intl.NumberFormat</span> for <span className="font-medium text-foreground">{language}</span>.
                </p>
              </div>
            </div>
            <p className="mt-3 px-1 text-muted-foreground text-xs">Tip: relative time strings translate automatically when supported by your browser.</p>
          </aside>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3 sm:px-10">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">{dirty ? "Unsaved changes" : "All saved"}</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" type="button" disabled={!dirty || saving} onClick={handleDiscard}>
              Discard
            </Button>
            <Button size="sm" type="button" disabled={!dirty || saving} onClick={handleSave}>
              {saving ? "Menyimpan..." : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, hint, children }: { title: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2">
        {icon ? <span className="inline-flex size-6 items-center justify-center rounded-md bg-foreground/[0.06]">{icon}</span> : null}
        <h2 className="font-heading text-base">{title}</h2>
      </div>
      {hint ? <p className="mt-1 text-muted-foreground text-xs leading-relaxed">{hint}</p> : null}
      <div className="mt-4 flex flex-col gap-5">{children}</div>
    </section>
  );
}
function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {htmlFor ? <Label htmlFor={htmlFor}>{label}</Label> : <span className="inline-flex font-medium text-foreground text-sm">{label}</span>}
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}
function PreviewRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className="inline-flex size-5 items-center justify-center rounded bg-foreground/[0.05] text-foreground/70">{icon}</span>
        {label}
      </dt>
      <dd className="truncate font-mono text-foreground text-sm">{value}</dd>
    </div>
  );
}
function TimezoneAutocomplete({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(label);
  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q || q === label.toLowerCase()) return TIMEZONES;
    return TIMEZONES.filter((t) => t.label.toLowerCase().includes(q) || t.value.toLowerCase().includes(q) || t.region.toLowerCase().includes(q));
  }, [text, label]);
  const grouped = useMemo(() => {
    const groups: Record<TimezoneItem["region"], TimezoneItem[]> = { Americas: [], Europe: [], Asia: [], Pacific: [] };
    for (const tz of filtered) groups[tz.region].push(tz);
    return groups;
  }, [filtered]);
  return (
    <Autocomplete
      value={text}
      onValueChange={setText}
      onItemHighlighted={() => {}}
      onOpenChange={(open) => {
        if (!open) {
          const hit = TIMEZONES.find((t) => t.label.toLowerCase() === text.trim().toLowerCase());
          if (!hit) setText(label);
        }
      }}
    >
      <AutocompleteInput id="loc-tz" placeholder="Search a city or region…" startAddon={<SearchIcon />} showClear />
      <AutocompletePopup className="w-(--anchor-width)">
        <AutocompleteList>
          <AutocompleteEmpty>No timezones match.</AutocompleteEmpty>
          {(Object.keys(grouped) as TimezoneItem["region"][]).map((region) => {
            const items = grouped[region];
            if (items.length === 0) return null;
            return (
              <AutocompleteGroup key={region}>
                <AutocompleteGroupLabel>{region}</AutocompleteGroupLabel>
                {items.map((tz) => (
                  <AutocompleteItem
                    key={tz.value}
                    value={tz.label}
                    onClick={() => {
                      onChange(tz.value);
                      setText(tz.label);
                    }}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="flex-1 truncate">{tz.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{tz.value}</span>
                      {tz.value === value ? <CheckIcon className="size-3.5 text-primary" /> : null}
                    </span>
                  </AutocompleteItem>
                ))}
              </AutocompleteGroup>
            );
          })}
        </AutocompleteList>
      </AutocompletePopup>
    </Autocomplete>
  );
}
