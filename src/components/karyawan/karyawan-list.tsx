"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EllipsisIcon, MailIcon, PencilIcon, ShieldIcon, TrashIcon, UserMinusIcon, UserCheckIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { IdentityAvatar } from "@/components/identity-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KaryawanFormDialog, TempPasswordDialog } from "./karyawan-form-dialog";
import { deleteKaryawan, resetKaryawanPassword, setKaryawanActive, updateKaryawan } from "@/app/app/karyawan/actions";
import type { KaryawanRow } from "@/app/app/karyawan/actions";
import { playPageTransition } from "@/components/layout/page-transition";

const ROLES: { label: string; value: string }[] = [
  { label: "Master Admin", value: "MASTER_ADMIN" },
  { label: "Admin", value: "ADMIN" },
  { label: "Frontliner", value: "FRONTLINER" },
  { label: "Teknisi", value: "TECHNICIAN" },
];

const toneFor = (role: string) => {
  if (role === "MASTER_ADMIN") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
  if (role === "ADMIN") return "bg-amber-500/15 text-amber-600 dark:text-amber-300";
  if (role === "FRONTLINER") return "bg-sky-500/15 text-sky-600 dark:text-sky-300";
  return "bg-violet-500/15 text-violet-600 dark:text-violet-300";
};
const initialsFor = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "U";

export function KaryawanList({ rows, branches }: { rows: KaryawanRow[]; branches: { id: string; name: string }[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<KaryawanRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [del, setDel] = useState<KaryawanRow | null>(null);
  const [toggle, setToggle] = useState<KaryawanRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const refresh = () => router.refresh();

  const handleRoleChange = async (row: KaryawanRow, nextRole: string) => {
    setBusy(true);
    try {
      await updateKaryawan({ profileId: row.profileId, employeeId: row.employeeId, fullName: row.fullName, phone: row.phone ?? "", email: row.email ?? "", role: nextRole, branchId: row.branchId ?? branches[0]?.id ?? "" });
      toast.success("Role diperbarui");
      playPageTransition();
      refresh();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Gagal"); }
    finally { setBusy(false); }
  };

  const handleToggle = async () => {
    if (!toggle) return;
    setBusy(true);
    try {
      await setKaryawanActive(toggle.employeeId, !toggle.isActive);
      toast.success(toggle.isActive ? "Dinonaktifkan" : "Diaktifkan");
      playPageTransition();
      refresh();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Gagal"); }
    finally { setBusy(false); setToggle(null); }
  };

  const handleDelete = async () => {
    if (!del) return;
    setBusy(true);
    try {
      await deleteKaryawan(del.profileId, del.employeeId);
      toast.success("Karyawan dihapus (login ikut terhapus)");
      playPageTransition();
      refresh();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Gagal hapus"); }
    finally { setBusy(false); setDel(null); }
  };

  const handleReset = async (row: KaryawanRow) => {
    setBusy(true);
    try {
      await resetKaryawanPassword(row.profileId);
      playPageTransition();
      toast.success(`Email reset dikirim ke ${row.email ?? "akun tersebut"}`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Gagal reset"); }
    finally { setBusy(false); }
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  // reset page if rows shrink below current page
  if (safePage !== page) setPage(safePage);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card shadow-xs/5">
        <Table>
          <TableHeader><TableRow><TableHead className="ps-4">Karyawan</TableHead><TableHead>Cabang</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Terakhir aktif</TableHead><TableHead className="pe-4 w-px" /></TableRow></TableHeader>
          <TableBody><TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Tidak ada karyawan yang cocok</TableCell></TableRow></TableBody>
        </Table>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card shadow-xs/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">Karyawan</TableHead>
              <TableHead>Cabang</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Terakhir aktif</TableHead>
              <TableHead className="pe-4 w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((m) => {
              const tone = toneFor(m.role);
              const initials = initialsFor(m.fullName);
              const cabangName = m.branchName ?? "—";
              return (
                <TableRow key={m.employeeId}>
                  <TableCell className="ps-4">
                    <div className="flex items-center gap-3">
                      {m.avatarUrl ? (
                        <IdentityAvatar
                          photoUrl={m.avatarUrl}
                          name={m.fullName}
                          className={"size-8 text-[11px] " + tone}
                        />
                      ) : (
                        <Avatar className={"size-8 " + tone}><AvatarFallback className="bg-transparent font-medium text-[11px]">{initials}</AvatarFallback></Avatar>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{m.fullName}</span>
                          {!m.isActive && <Badge variant="outline" size="sm" className="font-mono text-[9px] uppercase tracking-wider">nonaktif</Badge>}
                        </div>
                        <div className="text-muted-foreground text-xs">{m.email ?? "—"}</div>
                        <div className="text-muted-foreground text-xs">
                          {m.phone ?? (m.role === "TECHNICIAN" ? <Badge variant="outline" size="sm" className="text-[9px] uppercase tracking-wider">belum ada nomor</Badge> : "—")}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{cabangName}</TableCell>
                  <TableCell>
                    {m.role === "MASTER_ADMIN" ? (
                      <Badge variant="outline" className="gap-1"><ShieldIcon className="size-3" /> Master Admin</Badge>
                    ) : (
                      <Select value={m.role} onValueChange={(v) => v && handleRoleChange(m, v)} disabled={busy}>
                        <SelectTrigger className="h-8 w-36 text-sm" size="sm"><SelectValue /></SelectTrigger>
                        <SelectPopup>{ROLES.filter((r) => r.value !== "MASTER_ADMIN").map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectPopup>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-1.5">
                      <span className={"size-1.5 rounded-full " + (m.isActive ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                      <span className="text-muted-foreground text-xs">{m.isActive ? "Aktif" : "Nonaktif"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums text-sm">{new Date(m.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                  <TableCell className="pe-4">
                    <Menu>
                      <MenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${m.fullName}`} />}><EllipsisIcon /></MenuTrigger>
                      <MenuPopup align="end">
                        <MenuItem onClick={() => { setEdit(m); setEditOpen(true); }}><PencilIcon /> Edit data</MenuItem>
                        <MenuItem onClick={() => handleReset(m)}><MailIcon /> Kirim reset password</MenuItem>
                        <MenuItem onClick={() => setToggle(m)}>{m.isActive ? <><UserMinusIcon /> Nonaktifkan</> : <><UserCheckIcon /> Aktifkan</>}</MenuItem>
                        <MenuSeparator />
                        <MenuItem variant="destructive" onClick={() => setDel(m)}><TrashIcon /> Hapus karyawan</MenuItem>
                      </MenuPopup>
                    </Menu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {rows.length > 0 ? (
          <div className="flex flex-col items-center gap-3 border-t px-4 py-3 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Per halaman</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger size="sm" className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectPopup>
              </Select>
              <span>· Menampilkan {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, rows.length)} dari {rows.length}</span>
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (safePage > 1) setPage(safePage - 1); }} aria-disabled={safePage === 1} className={safePage === 1 ? "pointer-events-none opacity-50" : ""} />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, safePage - 3), Math.max(0, safePage - 3) + 5).map((p) => (
                  <PaginationItem key={p}>
                    <PaginationLink href="#" isActive={p === safePage} onClick={(e) => { e.preventDefault(); setPage(p); }}>{p}</PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (safePage < totalPages) setPage(safePage + 1); }} aria-disabled={safePage === totalPages} className={safePage === totalPages ? "pointer-events-none opacity-50" : ""} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        ) : null}
      </div>

      <KaryawanFormDialog open={editOpen} onOpenChange={setEditOpen} editing={edit ? { profileId: edit.profileId, employeeId: edit.employeeId, fullName: edit.fullName, email: edit.email, phone: edit.phone, role: edit.role, branchId: edit.branchId } : null} onDone={refresh} />

      <Dialog open={!!toggle} onOpenChange={(v) => !v && setToggle(null)}>
        <DialogContent><DialogHeader><DialogTitle>{toggle?.isActive ? "Nonaktifkan karyawan?" : "Aktifkan karyawan?"}</DialogTitle><DialogDescription>{toggle ? `${toggle.fullName} — ${toggle.isActive ? "tidak bisa login sampai diaktifkan lagi" : "akan bisa login kembali"}` : ""}</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setToggle(null)} disabled={busy}>Batal</Button><Button variant={toggle?.isActive ? "destructive" : "default"} onClick={handleToggle} disabled={busy}>{busy ? "Memproses…" : toggle?.isActive ? "Nonaktifkan" : "Aktifkan"}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!del} onOpenChange={(v) => !v && setDel(null)}>
        <DialogContent><DialogHeader><DialogTitle>Hapus karyawan?</DialogTitle><DialogDescription>{del ? `${del.fullName} — login (${del.email ?? "tanpa email"}) ikut dihapus permanen. Tidak bisa dibatalkan.` : ""}</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDel(null)} disabled={busy}>Batal</Button><Button variant="destructive" onClick={handleDelete} disabled={busy}>{busy ? "Menghapus…" : "Hapus + hapus login"}</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function KaryawanHeaderActions({ initialCreateOpen = false }: { branches: { id: string; name: string }[]; initialCreateOpen?: boolean }) {
  const [open, setOpen] = useState(initialCreateOpen);
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const router = useRouter();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Tambah Karyawan</Button>
      <KaryawanFormDialog open={open} onOpenChange={setOpen} editing={null} onDone={(info) => { router.refresh(); if (info?.tempPassword) setTemp({ email: info.email!, password: info.tempPassword }); }} />
      <TempPasswordDialog open={!!temp} onOpenChange={(v) => !v && setTemp(null)} email={temp?.email ?? ""} password={temp?.password ?? ""} />
    </>
  );
}
