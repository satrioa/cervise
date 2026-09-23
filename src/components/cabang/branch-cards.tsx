"use client";

import { useEffect, useState } from "react";
import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toggleCabangActive, toggleCabangIntensif } from "@/app/app/cabang/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type BranchItem = {
  id: string;
  name: string;
  city: string;
  phone: string;
  is_active: boolean;
  is_intensif_enabled: boolean;
  intensif_mode: "percent" | "fixed";
  intensif_value: number;
  intensif_target_count: number | null;
  created_at: string;
  teknisiCount: number;
};

const TONES = [
  "from-emerald-500/20 to-teal-500/10",
  "from-slate-500/20 to-slate-500/5",
  "from-violet-500/20 to-fuchsia-500/10",
  "from-amber-500/20 to-orange-500/10",
  "from-sky-500/20 to-sky-500/5",
];

function statusFor(b: BranchItem): "ok" | "warn" | "off" {
  if (!b.is_active) return "off";
  if (!b.city && !b.phone) return "warn";
  return "ok";
}

const STATUS_LABEL: Record<string, string> = { ok: "Aktif", warn: "Perlu perhatian", off: "Nonaktif" };
const STATUS_DOT: Record<string, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", off: "bg-muted-foreground/40" };

export function BranchCards({ branches, onKelola }: { branches: BranchItem[]; onKelola?: (b: BranchItem) => void }) {
  const router = useRouter();
  const [items, setItems] = useState(branches);
  const [confirm, setConfirm] = useState<BranchItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Wire up: sync when server prop changes after router.refresh()
  useEffect(() => {
    setItems(branches);
  }, [branches]);

  const activeCount = items.filter((b) => b.is_active).length;
  const inactiveCount = items.length - activeCount;

  const handleToggle = (branch: BranchItem, next: boolean) => {
    if (!next) {
      setConfirm(branch);
      return;
    }
    doToggle(branch, true);
  };

  const doToggle = async (branch: BranchItem, enabled: boolean) => {
    if (branch.id.startsWith("mock-")) {
      toast.error("Cabang demo tidak bisa diubah. Buat cabang baru dulu.");
      setConfirm(null);
      return;
    }
    setSaving(true);
    const prev = items;
    setItems((cur) => cur.map((b) => (b.id === branch.id ? { ...b, is_active: enabled } : b)));
    try {
      await toggleCabangActive(branch.id, enabled);
      toast.success(enabled ? `Cabang "${branch.name}" diaktifkan` : `Cabang "${branch.name}" dinonaktifkan`);
      router.refresh();
    } catch (e: any) {
      setItems(prev);
      toast.error(e?.message ?? "Gagal mengubah status cabang");
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  };

  const handleIntensifToggle = async (branch: BranchItem, next: boolean) => {
    if (branch.id.startsWith("mock-")) {
      toast.error("Cabang demo tidak bisa diubah. Buat cabang baru dulu.");
      return;
    }
    const prev = items;
    setItems((cur) => cur.map((b) => (b.id === branch.id ? { ...b, is_intensif_enabled: next } : b)));
    setSaving(true);
    try {
      await toggleCabangIntensif(branch.id, next);
      toast.success(next ? `Insentif "${branch.name}" diaktifkan` : `Insentif "${branch.name}" dinonaktifkan`);
      router.refresh();
    } catch (e: any) {
      setItems(prev);
      toast.error(e?.message ?? "Gagal mengubah intensif");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
        <span>
          {activeCount} aktif · {inactiveCount} nonaktif
        </span>
        {saving && <span className="normal-case text-[11px]">Menyimpan...</span>}
      </div>

      <div className="flex flex-col gap-3">
        {items.map((b, idx) => {
          const enabled = b.is_active;
          const status = enabled ? statusFor(b) : "off";
          const tone = TONES[idx % TONES.length];
          const letter = (b.name.trim()[0] ?? "?").toUpperCase();
          const lastSync = enabled ? `dibuat ${new Date(b.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}` : "Nonaktif";
          return (
            <Card key={b.id} className="overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <div className={"flex size-11 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br font-heading font-semibold text-base " + tone}>
                  {letter}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-semibold text-base">{b.name}</span>
                    <Badge variant="outline" className="gap-1.5 font-mono text-[10px] uppercase">
                      <span className={"size-1.5 rounded-full " + STATUS_DOT[status]} />
                      {STATUS_LABEL[status]}
                    </Badge>
                  </div>
                  <p className="truncate text-muted-foreground text-sm">{b.city || "Belum ada alamat"}{b.phone ? ` · ${b.phone}` : ""}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {b.teknisiCount} teknisi
                    </span>
                    <span className={"rounded border px-1.5 py-0.5 font-mono text-[10px] " + (b.is_intensif_enabled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                      {b.is_intensif_enabled ? (b.intensif_mode === "percent" ? `Insentif ${Number(b.intensif_value).toString()}%` : `Insentif Rp ${Number(b.intensif_value).toLocaleString("id-ID")}`) + (b.intensif_target_count ? ` · target ${b.intensif_target_count}` : "") : "Insentif off"}
                    </span>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                    {status === "ok" ? <CheckCircle2Icon className="size-3 text-emerald-600" /> : null}
                    {lastSync}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Aktif</span>
                    <Switch checked={enabled} disabled={saving} onCheckedChange={(v) => handleToggle(b, Boolean(v))} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Insentif</span>
                    <Switch checked={!!b.is_intensif_enabled} disabled={saving || !enabled} onCheckedChange={(v) => handleIntensifToggle(b, Boolean(v))} />
                  </div>
                  <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => onKelola?.(b)}>
                    Kelola
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Confirm disable */}
      <DialogPrimitive.Root open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
            <DialogPrimitive.Title className="font-heading text-base font-semibold">Nonaktifkan cabang?</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
              Cabang <span className="font-medium text-foreground">{confirm?.name}</span> akan dinonaktifkan. User yang terhubung ke cabang ini <span className="font-medium text-destructive">tidak bisa login</span> sampai diaktifkan kembali.
            </DialogPrimitive.Description>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)} disabled={saving}>
                Batal
              </Button>
              <Button variant="destructive" onClick={() => confirm && doToggle(confirm, false)} disabled={saving}>
                {saving ? "Memproses..." : "Nonaktifkan"}
              </Button>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
              <span className="sr-only">Close</span>×
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

export function CreateCabangCardButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 p-4 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
    >
      <span className="flex size-8 items-center justify-center rounded-lg border bg-background text-lg leading-none">+</span>
      Tambah Cabang
    </button>
  );
}
