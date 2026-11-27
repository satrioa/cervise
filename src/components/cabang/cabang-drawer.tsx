"use client";

import { useEffect, useState } from "react";
import { CheckCircle2Icon, MoreHorizontalIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getCabangMembers, toggleCabangIntensif, updateCabang, updateCabangCardVisibility, updateCabangIntensif, updateCabangTarget, updateCabangWorkHours } from "@/app/app/cabang/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { playPageTransition } from "@/components/layout/page-transition";
import { friendlyErrorMessage } from "@/lib/error-message";

type BranchItem = {
  id: string;
  name: string;
  city: string;
  phone: string;
  is_active: boolean;
  is_intensif_enabled?: boolean;
  intensif_mode?: "percent" | "fixed" | "flat";
  intensif_value?: number;
  intensif_target_count?: number | null;
  target_type?: "penghasilan" | "jumlah_servis";
  target_value?: number | null;
  show_target_to_teknisi?: boolean;
  show_intensif_to_teknisi?: boolean;
  check_in_time?: string;
  check_out_time?: string;
  created_at: string;
  teknisiCount: number;
};

type Member = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  status: "online" | "away" | "off";
  customStatus?: string;
  active: string;
  permission: "Owner" | "Admin" | "Member" | "Viewer";
};

/**
 * Mode insentif cabang.
 *
 * Dipakai lewat alias, bukan union yang ditulis ulang di tiap tempat --
 * `flat` pernah hilang dari `branch-cards.tsx` tepat karena union-nya ditulis
 * manual di beberapa lokasi dan satu saja lupa diperbarui.
 */
type IntensifMode = "percent" | "fixed" | "flat";

/** Hanya mode flat yang memakai target. */
const TARGET_MODES: ReadonlySet<IntensifMode> = new Set<IntensifMode>(["flat"]);

const AMOUNT_LABEL: Record<IntensifMode, string> = {
  percent: "Persentase %",
  fixed: "Nominal per servis (Rp)",
  flat: "Nominal flat bulanan (Rp)",
};

const AMOUNT_HELP: Record<IntensifMode, string> = {
  percent: "Dihitung dari total pendapatan servis selesai bulan ini.",
  fixed: "Dibayar untuk setiap servis selesai, berapa pun hasilnya.",
  flat: "Dibayar sekali penuh ke tiap teknisi yang mencapai target bulan ini, bukan per servis.",
};

const STATUS_DOT: Record<Member["status"], string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  off: "bg-muted-foreground/40",
};

const PERMISSION_TONE: Record<Member["permission"], string> = {
  Owner: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  Admin: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  Member: "bg-foreground/[0.06] text-foreground",
  Viewer: "bg-muted text-muted-foreground",
};

export function CabangDrawer({ branch, open, onOpenChange }: { branch: BranchItem | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [alamat, setAlamat] = useState("");
  const [telepon, setTelepon] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [intensifEnabled, setIntensifEnabled] = useState(true);
  const [intensifMode, setIntensifMode] = useState<IntensifMode>("percent");
  const [intensifValue, setIntensifValue] = useState<string>("5");
  const [intensifTarget, setIntensifTarget] = useState<string>("");
  const [savingIntensif, setSavingIntensif] = useState(false);
  const [errorIntensif, setErrorIntensif] = useState<string | null>(null);
  const [intensifFieldErrors, setIntensifFieldErrors] = useState<Record<string, string>>({});
  const [targetType, setTargetType] = useState<"penghasilan" | "jumlah_servis">("jumlah_servis");
  const [targetValue, setTargetValue] = useState<string>("");
  const [showTarget, setShowTarget] = useState(true);
  const [showIntensif, setShowIntensif] = useState(true);
  const [savingTarget, setSavingTarget] = useState(false);
  const [checkIn, setCheckIn] = useState("08:00");
  const [checkOut, setCheckOut] = useState("17:00");
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (!open || !branch) return;
    setName(branch.name);
    setAlamat(branch.city);
    setTelepon(branch.phone);
    setError(null);
    setFieldErrors({});
    setEditOpen(false);
    setIntensifEnabled(branch.is_intensif_enabled ?? true);
    setIntensifMode(branch.intensif_mode ?? "percent");
    setIntensifValue(String(branch.intensif_value ?? 5));
    setIntensifTarget(branch.intensif_target_count ? String(branch.intensif_target_count) : "");
    setErrorIntensif(null);
    setIntensifFieldErrors({});
    setTargetType(branch.target_type === "penghasilan" ? "penghasilan" : "jumlah_servis");
    setTargetValue(branch.target_value ? String(branch.target_value) : "");
    setShowTarget(branch.show_target_to_teknisi ?? true);
    setShowIntensif(branch.show_intensif_to_teknisi ?? true);
    setCheckIn(branch.check_in_time ?? "08:00");
    setCheckOut(branch.check_out_time ?? "17:00");
    setLoading(true);
    getCabangMembers(branch.id)
      .then((rows) => setMembers(rows as Member[]))
      .catch((e: any) => {
        toast.error(e?.message ?? "Gagal memuat anggota");
        setMembers([]);
      })
      .finally(() => setLoading(false));
  }, [open, branch]);

  const handleSave = async () => {
    if (!branch) return;
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Nama cabang wajib";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setError(null);
    try {
      await updateCabang(branch.id, { name, alamat, telepon });
      playPageTransition();
      toast.success(`Cabang "${name.trim()}" diperbarui`);
      setEditOpen(false);
      router.refresh();
      onOpenChange(false);
    } catch (e: any) {
      setError(friendlyErrorMessage(e, "Gagal menyimpan"));
      toast.error(friendlyErrorMessage(e, "Gagal menyimpan"));
    } finally {
      setSaving(false);
    }
  };

  const handleIntensifToggle = async (next: boolean) => {
    if (!branch) return;
    setSavingIntensif(true);
    setErrorIntensif(null);
    const prev = intensifEnabled;
    setIntensifEnabled(next);
    try {
      await toggleCabangIntensif(branch.id, next);
      playPageTransition();
      toast.success(next ? "Insentif diaktifkan" : "Insentif dinonaktifkan");
      router.refresh();
    } catch (e: any) {
      setIntensifEnabled(prev);
      setErrorIntensif(e?.message ?? "Gagal menyimpan");
      toast.error(e?.message ?? "Gagal menyimpan");
    } finally {
      setSavingIntensif(false);
    }
  };

  const handleSaveIntensif = async () => {
    if (!branch) return;
    const val = Number(intensifValue);
    const errors: Record<string, string> = {};
    if (isNaN(val) || val < 0) errors.value = "Nilai harus angka ≥ 0";
    else if (intensifMode === "percent" && val > 100) errors.value = "Persentase maksimal 100%";
    // Target hanya bermakna di mode flat. Di mode lain dipaksa null supaya
    // tidak ada sisa target yang diam-diam menggerakkan KPI/progress.
    const rawTarget = intensifTarget.trim() === "" ? null : Number(intensifTarget);
    if (rawTarget !== null && (isNaN(rawTarget) || rawTarget <= 0)) errors.target = "Target harus lebih dari 0";
    if (intensifMode === "flat" && rawTarget === null) errors.target = "Mode Flat bulanan wajib diisi target per teknisi";
    setIntensifFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setErrorIntensif(Object.values(errors)[0]);
      return;
    }
    const target = TARGET_MODES.has(intensifMode) ? rawTarget : null;
    setSavingIntensif(true);
    setErrorIntensif(null);
    try {
      await updateCabangIntensif(branch.id, { mode: intensifMode, value: val, targetCount: target });
      playPageTransition();
      toast.success("Insentif cabang diperbarui");
      router.refresh();
    } catch (e: any) {
      setErrorIntensif(e?.message ?? "Gagal menyimpan");
      toast.error(e?.message ?? "Gagal menyimpan");
    } finally {
      setSavingIntensif(false);
    }
  };

  const saveVisibility = async (next: { showTarget: boolean; showIntensif: boolean }) => {
    if (!branch) return;
    setSavingTarget(true);
    try {
      await updateCabangCardVisibility(branch.id, next);
      setShowTarget(next.showTarget);
      setShowIntensif(next.showIntensif);
      playPageTransition();
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal mengubah tampilan kartu");
    } finally {
      setSavingTarget(false);
    }
  };

  const saveTarget = async () => {
    if (!branch) return;
    const raw = targetValue.trim();
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      toast.error("Nilai target harus lebih dari 0");
      return;
    }
    setSavingTarget(true);
    try {
      await updateCabangTarget(branch.id, { type: targetType, value });
      playPageTransition();
      toast.success("Target cabang diperbarui");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menyimpan target");
    } finally {
      setSavingTarget(false);
    }
  };

  if (!branch) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle className="truncate">{branch.name}</SheetTitle>
        </SheetHeader>

        <div className="p-5 space-y-5">
          {/* Compact identity card like header of compact-card */}
          <div className="rounded-xl border bg-card p-4 shadow-xs/5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{branch.name}</span>
                <Badge variant="outline" size="sm" className="gap-1.5 font-mono text-[10px] uppercase">
                  <span className={"size-1.5 rounded-full " + (branch.is_active ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                  {branch.is_active ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {branch.is_active ? "Aktif" : "Tidak aktif"}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                {branch.is_active ? <CheckCircle2Icon className="size-3 text-emerald-600" /> : null}
                dibuat {new Date(branch.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditOpen((v) => !v)}>
                {editOpen ? "Tutup edit" : "Edit cabang"}
              </Button>
              <span className="rounded border bg-background px-2 py-1 font-mono text-[10px] text-muted-foreground">{branch.teknisiCount} teknisi</span>
            </div>

            {editOpen && (
              <div className="mt-4 space-y-3 rounded-lg border bg-muted/20 p-3">
                <div className="space-y-1.5">
                  <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Nama cabang</Label>
                  <Input aria-invalid={Boolean(fieldErrors.name)} value={name} onChange={(e) => { setName(e.target.value); setFieldErrors((prev) => ({ ...prev, name: "" })); }} maxLength={50} />
                  {fieldErrors.name ? <p className="text-xs text-destructive">{fieldErrors.name}</p> : <div className="text-xs text-muted-foreground">{name.length} / 50</div>}
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Alamat</Label>
                  <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Jl. ..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Telepon</Label>
                  <Input value={telepon} onChange={(e) => setTelepon(e.target.value)} placeholder="0812xxxx" />
                </div>
                {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">{error}</div>}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)} disabled={saving}>Batal</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-xl border bg-card p-4 shadow-xs/5">
            <div>
              <div className="font-heading text-sm font-semibold">Jam kerja cabang</div>
              <p className="text-xs text-muted-foreground">Dipakai untuk status Terlambat dan Pulang awal pada absensi.</p>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="check-in-time">Jam masuk</Label>
                <Input id="check-in-time" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="check-out-time">Jam pulang</Label>
                <Input id="check-out-time" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
              </div>
            </div>
            <Button
              size="sm"
              disabled={savingHours || !branch}
              onClick={async () => {
                if (!branch) return;
                setSavingHours(true);
                try {
                  await updateCabangWorkHours(branch.id, { checkInTime: checkIn, checkOutTime: checkOut });
                  toast.success("Jam kerja tersimpan");
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Gagal menyimpan jam kerja");
                } finally {
                  setSavingHours(false);
                }
              }}
            >
              {savingHours ? "Menyimpan..." : "Simpan jam kerja"}
            </Button>
          </div>

          {/* Intensif per cabang — Q1 % or fixed, Q3 per cabang, Q4 Selesai+Sudah Diambil */}
          <div className="rounded-xl border bg-card p-4 shadow-xs/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-heading text-sm font-semibold">Insentif Teknisi</div>
                <p className="text-xs text-muted-foreground">Per cabang · dihitung dari servis Selesai + Sudah Diambil pada bulan berjalan</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2.5">
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  Aktif
                  <Switch checked={intensifEnabled} disabled={savingIntensif || !branch.is_active} onCheckedChange={handleIntensifToggle} />
                </label>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  Tampilkan kartu Intensif ke teknisi
                  <Switch checked={showIntensif} disabled={savingTarget || !branch.is_active} onCheckedChange={(v) => void saveVisibility({ showTarget, showIntensif: v })} />
                </label>
              </div>
            </div>
            {!branch.is_active && <p className="mt-2 text-xs text-amber-600">Aktifkan cabang dulu untuk mengatur insentif.</p>}
            {intensifEnabled && branch.is_active && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Mode</Label>
                    <Select
                      value={intensifMode}
                      onValueChange={(v) => {
                        const next = v as IntensifMode;
                        setIntensifMode(next);
                        // Pindah keluar dari flat berarti target tidak berlaku
                        // lagi. Dibiarkan, nilainya akan terkirim ulang dan
                        // tersimpan di cabang yang tidak memakainya.
                        if (!TARGET_MODES.has(next)) setIntensifTarget("");
                      }}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Persentase dari pendapatan</SelectItem>
                        <SelectItem value="fixed">Nominal per servis</SelectItem>
                        <SelectItem value="flat">Flat bulanan bila target tercapai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">{AMOUNT_LABEL[intensifMode]}</Label>
                    <Input aria-invalid={Boolean(intensifFieldErrors.value)} type="number" min={0} max={intensifMode === "percent" ? 100 : undefined} value={intensifValue} onChange={(e) => { setIntensifValue(e.target.value); setIntensifFieldErrors((prev) => ({ ...prev, value: "" })); }} placeholder={intensifMode === "percent" ? "5" : "50000"} />
                    {intensifFieldErrors.value ? <p className="text-xs text-destructive">{intensifFieldErrors.value}</p> : <p className="text-[11px] text-muted-foreground">{AMOUNT_HELP[intensifMode]}</p>}
                  </div>
                </div>
                {/* Target hanya ada di mode flat. Di mode lain tidak ada
                   meaningful gate, dan membiarkannya terlihat hanya
                   membingungkan -- sisa target lama akan diam-diam menggerakkan
                   KPI "Target" dan progress bar di dashboard. */}
                {TARGET_MODES.has(intensifMode) && (
                  <div className="space-y-1.5">
                    <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Target per teknisi per bulan</Label>
                    <Input aria-invalid={Boolean(intensifFieldErrors.target)} type="number" min={1} value={intensifTarget} onChange={(e) => { setIntensifTarget(e.target.value); setIntensifFieldErrors((prev) => ({ ...prev, target: "" })); }} placeholder="mis. 20" />
                    {intensifFieldErrors.target ? <p className="text-xs text-destructive">{intensifFieldErrors.target}</p> : <p className="text-[11px] text-muted-foreground">
                      Wajib diisi. Bonus hanya dibayar kalau satu teknisi menyelesaikan minimal sebanyak ini dalam bulan berjalan. Kalau belum tercapai, bonusnya nol.
                    </p>}
                  </div>
                )}
                {errorIntensif && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">{errorIntensif}</div>}
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSaveIntensif} disabled={savingIntensif}>{savingIntensif ? "Menyimpan..." : "Simpan insentif"}</Button>
                </div>
              </div>
            )}
            {!intensifEnabled && branch.is_active && <p className="mt-3 text-xs text-muted-foreground">Insentif nonaktif — teknisi di cabang ini tidak mendapat insentif.</p>}
          </div>

          {/* Target Cabang — target Home teknisi, terpisah dari syarat bonus intensif */}
          <div className="rounded-xl border bg-card p-4 shadow-xs/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-heading text-sm font-semibold">Target Cabang</div>
                <p className="text-xs text-muted-foreground">Target bulanan teknisi — tampilan di Home, terpisah dari syarat bonus.</p>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                Tampilkan kartu Target ke teknisi
                <Switch checked={showTarget} disabled={savingTarget || !branch.is_active} onCheckedChange={(v) => void saveVisibility({ showTarget: v, showIntensif })} />
              </label>
            </div>
            {branch.is_active ? (
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Jenis target</Label>
                  <Select value={targetType} onValueChange={(v) => setTargetType(v as "penghasilan" | "jumlah_servis")}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jumlah_servis">Jumlah Servis</SelectItem>
                      <SelectItem value="penghasilan">Penghasilan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono text-[10px] uppercase tracking-[0.2em]">Nilai target</Label>
                  <Input type="number" min={1} step={1} value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder={targetType === "penghasilan" ? "mis. 10000000" : "mis. 20"} />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => void saveTarget()} disabled={savingTarget}>{savingTarget ? "Menyimpan..." : "Simpan target"}</Button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Members compact-card list */}
          <div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Anggota cabang · {members.length} orang</div>
            </div>

            {loading ? (
              // Bentuk kartu anggota yang akan dirender: avatar + dot status,
              // nama/@email, baris status, kolom role, dan tombol aksi.
              <ul aria-hidden className="mt-3 flex flex-col gap-2">
                {Array.from({ length: 3 }, (_, row) => (
                  <li
                    key={row}
                    className="grid grid-cols-[44px_1fr_28px] items-center gap-2 rounded-xl border bg-background px-3 py-2.5 shadow-sm sm:grid-cols-[44px_1fr_110px_28px]"
                  >
                    <div className="relative">
                      <Skeleton className="size-10 rounded-full" />
                      <Skeleton className="absolute right-0 bottom-0 size-3 rounded-full" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Skeleton
                        className="h-3.5"
                        style={{ width: `${45 + ((row * 13) % 30)}%` }}
                      />
                      <Skeleton
                        className="h-2.5"
                        style={{ width: `${30 + ((row * 7) % 25)}%` }}
                      />
                    </div>
                    <div className="hidden sm:block space-y-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-2.5 w-14" />
                    </div>
                    <Skeleton className="size-4 rounded-full" />
                  </li>
                ))}
              </ul>
            ) : members.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada teknisi di cabang ini</div>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="grid grid-cols-[44px_1fr_28px] items-center gap-2 rounded-xl border bg-background px-3 py-2.5 shadow-sm transition-colors hover:bg-background/95 sm:grid-cols-[44px_1fr_110px_28px]"
                  >
                    <div className="relative">
                      <Avatar className="size-10">
                        <AvatarFallback className="text-xs">{m.initials}</AvatarFallback>
                      </Avatar>
                      <span className={"absolute right-0 bottom-0 size-3 rounded-full border-2 border-background " + STATUS_DOT[m.status]} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{m.name}</span>
                        <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground">@{m.email.split("@")[0]}</span>
                      </div>
                      {m.customStatus ? (
                        <div className="mt-0.5 truncate text-xs text-foreground/80">{m.customStatus}</div>
                      ) : (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{m.active}</div>
                      )}
                      <div className="sm:hidden mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{m.role} · {m.active}</div>
                    </div>

                    <div className="hidden sm:block text-xs text-muted-foreground">
                      <div className="truncate">{m.role}</div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em]">{m.active}</div>
                    </div>

                    <button
                      type="button"
                      className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
