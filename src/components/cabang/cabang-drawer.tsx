"use client";

import { useEffect, useState } from "react";
import { CheckCircle2Icon, MoreHorizontalIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getCabangMembers, updateCabang } from "@/app/app/cabang/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type BranchItem = {
  id: string;
  name: string;
  city: string;
  phone: string;
  is_active: boolean;
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

  useEffect(() => {
    if (!open || !branch) return;
    setName(branch.name);
    setAlamat(branch.city);
    setTelepon(branch.phone);
    setError(null);
    setEditOpen(false);
    setLoading(true);
    // Wired: real fetch for real ids, mock fallback only for demo ids
    if (branch.id.startsWith("mock-")) {
      setMembers([
        { id: "1", name: "Rudi Teknisi", initials: "RT", email: "rudi@cabang.local", role: "Teknisi", status: "online", customStatus: "🛠 Sedang servis", active: "active now", permission: "Member" },
        { id: "2", name: "Sari Admin", initials: "SA", email: "sari@cabang.local", role: "Admin", status: "away", customStatus: "🚂 Istirahat", active: "active 12m ago", permission: "Admin" },
      ]);
      setLoading(false);
      return;
    }
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
    if (!name.trim()) { setError("Nama cabang wajib"); return; }
    if (branch.id.startsWith("mock-")) {
      setError("Cabang demo tidak bisa disimpan. Buat cabang baru dulu.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateCabang(branch.id, { name, alamat, telepon });
      toast.success(`Cabang "${name.trim()}" diperbarui`);
      setEditOpen(false);
      router.refresh();
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message ?? "Gagal menyimpan");
      toast.error(e?.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  if (!branch) return null;

  const letter = (branch.name.trim()[0] ?? "?").toUpperCase();
  const status: Member["status"] = branch.is_active ? "online" : "off";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-foreground/[0.06] font-heading font-semibold">
              {letter}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate">{branch.name}</SheetTitle>
            </div>
          </div>
        </SheetHeader>

        <div className="p-5 space-y-5">
          {/* Compact identity card like header of compact-card */}
          <div className="rounded-xl border bg-card p-4 shadow-xs/5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="size-10">
                  <AvatarFallback className="text-xs">{letter}</AvatarFallback>
                </Avatar>
                <span className={"absolute right-0 bottom-0 size-3 rounded-full border-2 border-background " + STATUS_DOT[status]} />
              </div>
              <div className="min-w-0 flex-1">
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
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
                  <div className="text-xs text-muted-foreground">{name.length} / 50</div>
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

          {/* Members compact-card list */}
          <div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Anggota cabang · {members.length} orang</div>
            </div>

            {loading ? (
              <div className="mt-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Memuat anggota...</div>
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
