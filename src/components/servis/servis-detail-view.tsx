"use client";

import { useEffect, useState, useMemo } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  UserIcon,
  WrenchIcon,
  SmartphoneIcon,
  ShieldCheckIcon,
  ClipboardCheckIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  HashIcon,
  TagIcon,
  PackageIcon,
  LockIcon,
  WalletIcon,
  PencilIcon,
  UserCogIcon,
  KeyIcon,
  Trash2Icon,
  ShieldIcon,
  UserPlusIcon,
  ChevronDownIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { KONDISI_ITEMS } from "@/lib/servis-constants";
import type { ServisDetail } from "@/app/app/servis/actions";
import { getPembayaranHistory, getServisLogs } from "@/app/app/servis/actions";
import { ServisBayarForm } from "./servis-bayar-drawer";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { getServisSpareparts } from "@/app/app/servis/sparepart-actions";
import { SparepartPickDialog } from "./sparepart-dialogs";
import { canAddSparepart } from "@/lib/servis-status-map";

function PatternPreview({ value }: { value: string }) {
  const path = value ? value.split(",").map(Number).filter((n) => n >= 0 && n < 9) : [];
  const pos = (idx: number) => ({ r: Math.floor(idx / 3), c: idx % 3 });
  if (path.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="relative grid h-[72px] w-[72px] grid-cols-3 grid-rows-3 gap-1 rounded-lg border bg-muted/20 p-1.5">
      <svg className="pointer-events-none absolute inset-0 h-full w-full p-1.5">
        {path.map((idx, i) => {
          if (i === 0) return null;
          const a = pos(path[i - 1]);
          const b = pos(idx);
          const cellW = 100 / 3;
          const cellH = 100 / 3;
          const x1 = a.c * cellW + cellW / 2;
          const y1 = a.r * cellH + cellH / 2;
          const x2 = b.c * cellW + cellW / 2;
          const y2 = b.r * cellH + cellH / 2;
          return <line key={i} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="currentColor" strokeWidth={1.5} className="text-primary" strokeLinecap="round" />;
        })}
      </svg>
      {Array.from({ length: 9 }, (_, idx) => {
        const active = path.includes(idx);
        const order = path.indexOf(idx);
        return (
          <div key={idx} className="flex items-center justify-center">
            <div className={`flex size-5 items-center justify-center rounded-full border text-[9px] font-mono ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
              {active ? order + 1 : <span className="size-1 rounded-full bg-muted-foreground/30" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  data: ServisDetail | null;
  dummy?: {
    id: string;
    device: string;
    status: string;
    price: number;
    date: string;
    complaint?: string;
    merk?: string;
    tipe?: string;
    imei1?: string;
    imei2?: string;
    kerusakan?: string[];
    kelengkapan?: string[];
    password_type?: string;
    password_value?: string;
    garansi_value?: number;
    garansi_unit?: string;
    garansi_until?: string | null;
    kondisi_awal?: Record<string, { status: "normal" | "tidak_normal"; note: string }>;
    created_at?: string;
  };
};

function initials(name?: string | null) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

function formatInvoiceNo(createdAt: string | null, id: string) {
  try {
    const d = createdAt ? new Date(createdAt) : new Date();
    return `INV-${format(d, "ddMMyyyyHHmmss")}`;
  } catch {
    return `INV-${id.slice(0, 8).toUpperCase()}`;
  }
}

type TimelineSeverity = "info" | "warn" | "danger";
interface TimelineEvent {
  actor: string;
  initials: string;
  action: string;
  target?: string;
  Icon: ComponentType<{ className?: string }>;
  severity: TimelineSeverity;
  time: string;
  diff?: { before: string; after: string };
}

const SEV_RING: Record<TimelineSeverity, string> = {
  info: "bg-foreground/[0.06] text-foreground",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  danger: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};
const SEV_DOT: Record<TimelineSeverity, string> = {
  info: "bg-foreground/40",
  warn: "bg-amber-500",
  danger: "bg-rose-500",
};

function mapLogsToEvents(logs: any[], history: any[], detail: any): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  // logs from DB
  for (const log of logs) {
    const actor = log.actor?.full_name ?? log.actor?.email ?? "System";
    const init = initials(actor);
    const time = log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: localeId }) : "—";
    let Icon: ComponentType<{ className?: string }> = PencilIcon;
    let severity: TimelineSeverity = "info";
    let action = log.action;
    let target: string | undefined = log.to_value ?? undefined;
    let diff: { before: string; after: string } | undefined;
    if (log.action === "create") {
      Icon = UserPlusIcon; severity = "info"; action = "membuat servis"; target = log.to_value ?? detail?.device;
    } else if (log.action === "status_change") {
      Icon = WrenchIcon; severity = log.to_value === "Batal" ? "danger" : "warn"; action = "ubah status"; target = `${log.from_value ?? "—"} → ${log.to_value ?? "—"}`; diff = { before: log.from_value ?? "", after: log.to_value ?? "" };
    } else if (log.action === "assign_teknisi") {
      Icon = UserCogIcon; severity = "warn"; action = "ganti teknisi"; target = log.to_value ? `→ ${log.to_value.slice(0, 8)}` : undefined; diff = { before: log.from_value ?? "", after: log.to_value ?? "" };
    } else if (log.action === "edit_field") {
      Icon = PencilIcon; severity = "info"; action = "edit field"; target = log.to_value?.slice(0, 80); diff = log.payload ? { before: JSON.stringify(log.payload).slice(0, 120), after: log.to_value ?? "" } : undefined;
    } else if (log.action === "pembayaran") {
      Icon = WalletIcon; severity = "info"; action = "pembayaran"; target = log.payload ? `${formatCurrencyPlain(Number(log.payload.amount ?? log.to_value))} ${log.payload.metode ?? ""}` : log.to_value;
    } else if (log.action === "kondisi_check") {
      Icon = ClipboardCheckIcon; severity = "info"; action = "check kondisi";
    }
    events.push({ actor, initials: init, action, target, Icon, severity, time, diff });
  }
  // history fallback for pembayaran if no log yet
  if (events.filter((e) => e.action === "pembayaran").length === 0 && history.length) {
    for (const h of history) {
      events.push({
        actor: "Kasir",
        initials: "KS",
        action: "pembayaran",
        target: `${formatCurrencyPlain(Number(h.amount))} ${h.metode ?? ""}`,
        Icon: WalletIcon,
        severity: "info",
        time: h.kas_date ? format(new Date(h.kas_date), "d MMM yyyy") : formatDistanceToNow(new Date(h.created_at), { addSuffix: true, locale: localeId }),
      });
    }
  }
  // if no logs at all, create synthetic create event from detail
  if (events.length === 0 && detail) {
    events.push({
      actor: detail.creator?.full_name ?? detail.teknisi?.full_name ?? "System",
      initials: initials(detail.creator?.full_name ?? detail.teknisi?.full_name),
      action: "membuat servis",
      target: detail.device,
      Icon: UserPlusIcon,
      severity: "info",
      time: detail.created_at ? formatDistanceToNow(new Date(detail.created_at), { addSuffix: true, locale: localeId }) : "baru saja",
    });
  }
  // sort by time desc? logs already asc, keep asc for timeline top->bottom old to new, but show newest first? keep asc
  return events;
}

export function ServisDetailView({ data, dummy }: Props) {
  const d: any = data ?? dummy;
  if (!d) return <div className="p-6 text-sm text-muted-foreground">Data tidak tersedia</div>;

  const id = d.id ?? "—";
  const device = d.device ?? (`${d.merk ?? ""} ${d.tipe ?? ""}`.trim() || "—");
  const status = d.status ?? "Masuk";
  const price = d.price ?? 0;
  const createdAt = d.created_at ?? d.date ?? null;
  const invoiceNo = formatInvoiceNo(createdAt, id);
  const merk = d.merk ?? d.device?.split(" ")[0] ?? "—";
  const tipe = d.tipe ?? d.device?.split(" ").slice(1).join(" ") ?? "—";
  const imei1 = d.imei1 ?? "—";
  const imei2 = d.imei2 ?? null;
  const kerusakan: string[] = d.kerusakan ?? (d.complaint ? [d.complaint] : d.cervise_customers ? [] : []);
  const kerusakanList: string[] = Array.isArray(kerusakan) && kerusakan.length ? kerusakan : d.complaint ? [d.complaint] : [];
  const kelengkapan: string[] = d.kelengkapan ?? [];
  const passwordType: string = d.password_type ?? "PIN";
  const passwordValue: string = d.password_value ?? "—";
  const garansiValue = d.garansi_value ?? null;
  const garansiUnit = d.garansi_unit ?? null;
  const garansiUntil = d.garansi_until ?? null;
  const kondisi: Record<string, { status: string; note: string }> = d.kondisi_awal ?? {};
  const customer = d.cervise_customers ?? (d.customer ? { name: d.customer.split("·")[0]?.trim() ?? d.customer, phone: d.customer.split("·")[1]?.trim() ?? "—", address: null } : null);
  const teknisi = d.teknisi ?? (d.teknisi ? { full_name: d.teknisi, email: null } : null);
  const creator = d.creator ?? null;

  const whoName = (creator as any)?.full_name ?? (teknisi as any)?.full_name ?? d.teknisi ?? "—";
  const whoEmail = (creator as any)?.email ?? (teknisi as any)?.email ?? null;

  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [openBayar, setOpenBayar] = useState(false);
  const [tab, setTab] = useState("informasi");
  const [spareparts, setSpareparts] = useState<any[]>([]);
  const [spLoading, setSpLoading] = useState(false);
  const [openAddPart, setOpenAddPart] = useState(false);
  const totalPaid = history.length ? history.reduce((a, b) => a + Number(b.amount), 0) : Number(d.price ?? 0);
  const estimasiVal = d.price_estimasi ?? null;
  const sisa = estimasiVal != null ? Math.max(0, estimasiVal - totalPaid) : null;
  const canAdd = canAddSparepart(status as any);

  const refreshSpareparts = () => {
    if (!d?.id || d.id === "—") return;
    setSpLoading(true);
    getServisSpareparts(d.id)
      .then((r) => setSpareparts(r as any[]))
      .catch(() => setSpareparts([]))
      .finally(() => setSpLoading(false));
  };

  useEffect(() => {
    if (!d?.id || d.id === "—") return;
    setHistoryLoading(true);
    getPembayaranHistory(d.id)
      .then((h) => setHistory(h as any[]))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
    setLogsLoading(true);
    getServisLogs(d.id)
      .then((l) => setLogs(l as any[]))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
    refreshSpareparts();
  }, [d?.id]);

  const timelineEvents = useMemo(() => mapLogsToEvents(logs, history, d), [logs, history, d]);

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
      <Card className="overflow-hidden shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs rounded bg-muted px-2 py-1">
                  <CalendarIcon className="size-3" />
                  {createdAt ? format(new Date(createdAt), "d MMM yyyy", { locale: localeId }) : "—"}
                </span>
                <span className="font-mono text-xs rounded bg-muted px-2 py-1 border border-primary/20">Nomor Invoice: {invoiceNo}</span>
                <Badge variant={status === "Sudah Diambil" ? "default" : status === "Selesai" ? "secondary" : "outline"} className="capitalize">
                  {status}
                </Badge>
              </div>
              <CardTitle className="mt-2 text-xl leading-tight truncate">{device}</CardTitle>
              <CardDescription className="flex items-center gap-1.5 mt-1">
                {garansiUntil ? <span className="inline-flex items-center gap-1"><ShieldCheckIcon className="size-3.5" /> Garansi s/d {format(new Date(garansiUntil), "d MMM yyyy", { locale: localeId })}</span> : <span className="text-xs text-muted-foreground">ID Servis: <span className="font-mono">{id}</span> · Jam {createdAt ? format(new Date(createdAt), "HH:mm", { locale: localeId }) : "—"}</span>}
              </CardDescription>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
              <div className="font-mono text-lg font-semibold">{formatCurrencyPlain(Number(price))}</div>
              <Badge variant="secondary" className="font-mono text-xs">
                <HashIcon className="size-3" />
                {garansiValue && garansiUnit ? `${garansiValue} ${garansiUnit}` : "Garansi custom"}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="w-full flex-1 min-h-0 flex flex-col">
        <div className="shrink-0 sticky top-0 z-20 -mx-4 sm:-mx-6 border-b bg-background/95 px-4 sm:px-6 py-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
          <TabsList className="w-full">
            <TabsTrigger value="informasi" className="flex-1 gap-1.5"><SmartphoneIcon className="size-4" /> Informasi Servis</TabsTrigger>
            <TabsTrigger value="sparepart" className="flex-1 gap-1.5"><PackageIcon className="size-4" /> Sparepart {spareparts.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{spareparts.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="timeline" className="flex-1 gap-1.5"><ClockIcon className="size-4" /> Timeline</TabsTrigger>
            <TabsTrigger value="pembayaran" className="flex-1 gap-1.5"><WalletIcon className="size-4" /> Pembayaran</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="informasi" className="flex-1 min-h-0 overflow-hidden mt-4 data-[state=active]:flex data-[state=active]:flex-col">
          <ScrollArea scrollFade className="flex-1 min-h-0">
            <div className="flex flex-col gap-4 pr-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex gap-3 rounded-lg border bg-muted/20 p-3">
                <Avatar className="size-9 shrink-0"><AvatarFallback className="text-xs">{initials(whoName)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium"><UserIcon className="size-3.5 opacity-70" /> diinput oleh</div>
                  <div className="font-medium text-sm truncate">{whoName}</div>
                  {whoEmail && <div className="text-xs text-muted-foreground truncate">{whoEmail}</div>}
                  <div className="mt-1 text-[11px] text-muted-foreground">Dicatat {createdAt ? format(new Date(createdAt), "d MMM yyyy HH:mm", { locale: localeId }) : "—"} · hidden di form, tercatat di DB</div>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 shrink-0"><WrenchIcon className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">Teknisi penanggung jawab *</div>
                  <div className="font-medium text-sm truncate">{(teknisi as any)?.full_name ?? whoName ?? "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">{(teknisi as any)?.email ?? whoEmail ?? "Wajib diisi saat input"}</div>
                </div>
              </div>
            </div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><SmartphoneIcon className="size-4" /></div>
                <div><CardTitle className="text-base">Informasi Device</CardTitle><CardDescription>Merk, IMEI & kelengkapan saat terima</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Merk</div><div className="font-medium">{merk}</div></div>
                <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Tipe</div><div className="font-medium">{tipe}</div></div>
                <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><HashIcon className="size-3" /> IMEI / SN 1</div><div className="font-mono font-medium break-all">{imei1}</div></div>
                <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">IMEI / SN 2</div><div className="font-mono font-medium break-all">{imei2 ?? <span className="text-muted-foreground">— (opsional)</span>}</div></div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium"><TagIcon className="size-4 opacity-70" /> Kerusakan</div>
                {kerusakanList.length ? <div className="flex flex-wrap gap-1.5">{kerusakanList.map((k: string) => <Badge key={k} variant="secondary" className="rounded-full">{k}</Badge>)}</div> : <span className="text-sm text-muted-foreground">—</span>}
                <p className="text-[11px] text-muted-foreground">Tag tersimpan & dipakai untuk analitik Top Servis Problems di dashboard.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium"><PackageIcon className="size-4 opacity-70" /> Kelengkapan</div>
                {kelengkapan.length ? <div className="flex flex-wrap gap-1.5">{kelengkapan.map((k: string) => <Badge key={k} variant="outline" className="rounded-full">{k}</Badge>)}</div> : <span className="text-sm text-muted-foreground">—</span>}
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium"><LockIcon className="size-4 opacity-70" /> Password Device · {passwordType}</div>
                {passwordType === "PIN" ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono rounded border bg-muted px-3 py-1.5 text-sm tracking-widest">{passwordValue !== "—" ? "•".repeat(Math.min(String(passwordValue).length, 6)) + (String(passwordValue).length > 6 ? ` (${String(passwordValue).length} digit)` : "") : "—"}</span>
                    <span className="text-xs text-muted-foreground">PIN asli tersimpan plain di DB (sesuai setting)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <PatternPreview value={String(passwordValue)} />
                    <div className="text-xs text-muted-foreground">Pola tersimpan: <span className="font-mono text-foreground">{String(passwordValue)}</span><br />Bisa melangkahi dot (0→2 / 0→6) tanpa intermediate.</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500 text-white"><UserIcon className="size-4" /></div>
                <div><CardTitle className="text-base">Informasi Customer</CardTitle><CardDescription>Auto-create jika belum ada di DB cabang</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent>
              {customer ? (
                <div className="flex gap-3">
                  <Avatar className="size-10 shrink-0"><AvatarFallback className="text-xs">{initials(customer.name)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="font-medium">{customer.name}</div>
                    <div className="flex items-center gap-1.5 text-sm"><PhoneIcon className="size-3.5 opacity-60" /><a href={`https://wa.me/${String(customer.phone).replace(/\D/g, "").replace(/^0/, "62")}`} target="_blank" className="font-mono text-primary hover:underline">{customer.phone}</a><Badge variant="secondary" className="ml-1 text-[10px]">WhatsApp</Badge></div>
                    <div className="flex items-start gap-1.5 text-sm text-muted-foreground"><MapPinIcon className="size-3.5 mt-0.5 opacity-60" /><span className="break-words">{customer.address ?? <em className="opacity-60">Alamat tidak diisi (opsional)</em>}</span></div>
                  </div>
                </div>
              ) : <span className="text-sm text-muted-foreground">—</span>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShieldCheckIcon className="size-4" /> Garansi</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs px-2.5 py-1">{garansiValue ?? "—"} {garansiUnit ?? ""}</Badge>
                <span className="text-sm text-muted-foreground">· Override 90 hari default. Hitung `garansi_until` saat Sudah Diambil.</span>
              </div>
              {garansiUntil && <div className="mt-2 text-sm">Sampai: <span className="font-medium">{format(new Date(garansiUntil), "d MMM yyyy", { locale: localeId })}</span></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ClipboardCheckIcon className="size-4" /> Check Kondisi Awal</CardTitle><CardDescription>11 item · teknisi tandai Normal / Tidak Normal + note (opsional, bisa dilewati saat input)</CardDescription></CardHeader>
            <CardContent>
              {Object.keys(kondisi).length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada check kondisi — bisa diisi setelah servis dibuat (popover kedua).</div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <div className="hidden sm:grid grid-cols-[1fr_140px_1fr] gap-2 bg-muted/50 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    <span>Item</span><span className="text-center">Status</span><span>Note</span>
                  </div>
                  <div className="divide-y">
                    {KONDISI_ITEMS.map((item) => {
                      const v = kondisi[item];
                      if (!v) return <div key={item} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_1fr] gap-2 px-3 py-2.5 text-sm"><span className="font-medium">{item}</span><span className="text-muted-foreground">—</span><span className="text-muted-foreground">—</span></div>;
                      const isNormal = v.status === "normal";
                      return (
                        <div key={item} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_1fr] gap-2 px-3 py-2.5 text-sm items-center">
                          <span className="font-medium">{item}</span>
                          <span className={`inline-flex justify-center rounded-full px-2.5 py-1 text-xs font-medium border w-fit sm:w-auto mx-0 ${isNormal ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20"}`}>{isNormal ? "Normal" : "Tidak Normal"}</span>
                          <span className="text-muted-foreground break-words text-xs sm:text-sm">{v.note || "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="sparepart" className="flex-1 min-h-0 overflow-hidden mt-4 data-[state=active]:flex data-[state=active]:flex-col">
          <ScrollArea scrollFade className="flex-1 min-h-0">
            <div className="pr-3">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2"><PackageIcon className="size-4" /> Sparepart Terpakai</CardTitle>
                      <CardDescription>Pemakaian mengurangi stok inventory langsung. Tambah hanya saat Dikerjakan.</CardDescription>
                    </div>
                    {canAdd ? <Button size="sm" onClick={() => setOpenAddPart(true)}>+ Tambah Sparepart</Button> : <Badge variant="outline" className="text-xs">{status === "Selesai" || status === "Sudah Diambil" ? "Tidak bisa tambah setelah Selesai" : status === "Batal" ? "Servis Batal" : "Hanya saat Dikerjakan"}</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  {spLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">Memuat sparepart...</div>
                  ) : spareparts.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada sparepart dipakai. {canAdd ? "Klik + Tambah Sparepart atau ubah status ke Dikerjakan untuk memilih." : "Sparepart dipilih saat status Dikerjakan."}</div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border">
                      <div className="hidden sm:grid grid-cols-[1fr_90px_80px_90px_110px] gap-2 bg-muted/50 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        <span>Sparepart</span><span>SKU</span><span className="text-center">Qty</span><span className="text-right">Harga</span><span className="text-center">Status</span>
                      </div>
                      <div className="divide-y">
                        {spareparts.map((r: any) => (
                          <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_80px_90px_110px] gap-1 sm:gap-2 px-3 py-2.5 text-sm items-center">
                            <span className="font-medium truncate">{r.name ?? r.description}</span>
                            <span className="font-mono text-xs text-muted-foreground">{r.sku ?? "—"}</span>
                            <span className="text-center font-mono">×{r.qty}</span>
                            <span className="text-right font-mono text-xs">{formatCurrencyPlain((Number(r.unit_price_cents ?? 0) / 100))}</span>
                            <span className="flex justify-center">{r.is_returned ? <Badge variant="warning">Dikembalikan</Badge> : status === "Batal" ? <Badge variant="secondary">Terpakai</Badge> : <Badge variant="success">Terpakai</Badge>}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 min-h-0 overflow-hidden mt-4 data-[state=active]:flex data-[state=active]:flex-col">
          <ScrollArea scrollFade className="flex-1 min-h-0">
            <div className="pr-3">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Timeline</CardTitle><CardDescription>Status, pembayaran, edit field, ganti teknisi — reten 30 hari</CardDescription></CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Memuat timeline...</div>
              ) : timelineEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada aktivitas. Timeline akan terisi saat status/pembayaran/edit terjadi.</div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-background/40 px-5 py-3">
                  <ol className="relative">
                    <span aria-hidden className="absolute top-2 bottom-2 left-[1.0625rem] w-px bg-border/50" />
                    {timelineEvents.map((e, i) => (
                      <li key={i} className="relative grid grid-cols-[34px_1fr_auto] items-start gap-3 py-3">
                        <span className={"z-10 grid size-[34px] place-items-center rounded-full ring-4 ring-background " + SEV_RING[e.severity]}>
                          <e.Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 pt-1.5">
                          <div className="flex items-center gap-2 text-sm">
                            <Avatar className="size-5"><AvatarFallback className="text-[9px]">{e.initials}</AvatarFallback></Avatar>
                            <span className="font-medium">{e.actor}</span>
                            <span className="text-muted-foreground">{e.action}</span>
                            {e.target ? <span className="truncate text-foreground/85">{e.target}</span> : null}
                          </div>
                          {e.diff ? (
                            <details className="group mt-2">
                              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] hover:bg-foreground/[0.06]">
                                <ChevronDownIcon className="size-3 -rotate-90 transition-transform group-open:rotate-0" /> diff
                              </summary>
                              <div className="mt-2 overflow-hidden rounded-md border border-border/60 font-mono text-[11px]">
                                <div className="border-rose-500/20 border-b bg-rose-500/[0.06] px-2 py-1 text-rose-700 dark:text-rose-400">- {e.diff.before}</div>
                                <div className="bg-emerald-500/[0.06] px-2 py-1 text-emerald-700 dark:text-emerald-400">+ {e.diff.after}</div>
                              </div>
                            </details>
                          ) : null}
                          <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                            <span className={"size-1 rounded-full " + SEV_DOT[e.severity]} /> {e.time}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </CardContent>
            </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="pembayaran" className="flex-1 min-h-0 overflow-hidden mt-4 data-[state=active]:flex data-[state=active]:flex-col">
          <ScrollArea scrollFade className="flex-1 min-h-0">
            <div className="pr-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2"><WalletIcon className="size-4" /> Pembayaran</CardTitle>
                <Button size="sm" onClick={() => setOpenBayar(true)}>Bayar / DP</Button>
              </div>
              <CardDescription>Terpisah dari form create. Bisa DP awal atau di akhir. Hanya admin/kasir (akan dicek server).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Estimasi {formatCurrencyPlain((estimasiVal ?? 0))}</Badge>
                <Badge variant="secondary">Terbayar {formatCurrencyPlain(totalPaid)}</Badge>
                {sisa !== null && <Badge variant={sisa === 0 ? "default" : "outline"}>Sisa {formatCurrencyPlain(sisa)}</Badge>}
                {d.price != null && <Badge variant="outline" className="font-mono">Total di DB {formatCurrencyPlain(Number(d.price))}</Badge>}
              </div>
              {historyLoading ? (
                <div className="text-sm text-muted-foreground py-4">Memuat riwayat...</div>
              ) : history.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Belum ada pembayaran. Bisa DP awal atau bayar di akhir.</div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <div className="hidden sm:grid grid-cols-[110px_100px_1fr_90px] gap-2 bg-muted/50 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    <span>Tanggal</span><span>Metode</span><span>Keterangan</span><span className="text-right">Nominal</span>
                  </div>
                  <div className="divide-y">
                    {history.map((h: any) => (
                      <div key={h.id} className="grid grid-cols-1 sm:grid-cols-[110px_100px_1fr_90px] gap-1 sm:gap-2 px-3 py-2.5 text-sm items-center">
                        <span className="font-mono text-xs">{h.kas_date ? format(new Date(h.kas_date), "d MMM yyyy", { locale: localeId }) : format(new Date(h.created_at), "d MMM yyyy", { locale: localeId })}</span>
                        <Badge variant="outline" className="w-fit text-[11px]">{h.metode ?? "—"}</Badge>
                        <span className="text-muted-foreground break-words text-xs sm:text-sm">{h.keterangan ?? h.description ?? "—"}</span>
                        <span className="font-mono font-medium text-right">{formatCurrencyPlain(Number(h.amount))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
                      </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <DialogPrimitive.Root open={openBayar} onOpenChange={setOpenBayar}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md" />
          <DialogPrimitive.Popup className="dark scheme-dark fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-background p-6 text-foreground shadow-2xl max-h-[90vh] overflow-y-auto">
            <DialogPrimitive.Title className="font-semibold text-white">Catat Pembayaran</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Admin/kasir saja. Bisa DP atau pelunasan. Metode dari pengaturan nanti (sekarang 5 aktif).</DialogPrimitive.Description>
            <div className="mt-4">
              <ServisBayarForm servisId={id} estimasi={estimasiVal} totalPaid={totalPaid} onSuccess={(total) => { setOpenBayar(false); setHistoryLoading(true); getPembayaranHistory(id).then((h) => setHistory(h as any[])).finally(() => setHistoryLoading(false)); }} onClose={() => setOpenBayar(false)} />
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <SparepartPickDialog open={openAddPart} onOpenChange={setOpenAddPart} servis={{ id, device }} mode="add" onSuccess={refreshSpareparts} />
    </div>
  );
}