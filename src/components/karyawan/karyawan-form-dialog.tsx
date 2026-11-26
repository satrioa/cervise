/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createKaryawan, updateKaryawan, getKaryawanBranches } from "@/app/app/karyawan/actions";
import { validatePhone } from "@/lib/phone";
import { playPageTransition } from "@/components/layout/page-transition";
import { normalizePinInput } from "@/app/app/karyawan/pin-input";
import { validPin } from "@/lib/attendance/pin";
import { TempPasswordDialog } from "@/components/temp-password-dialog";

type Editing = { profileId: string; employeeId: string; fullName: string; email: string | null; phone: string | null; role: string; branchId: string | null } | null;

const ROLES = [
  { label: "Master Admin", value: "MASTER_ADMIN" },
  { label: "Admin", value: "ADMIN" },
  { label: "Frontliner", value: "FRONTLINER" },
  { label: "Teknisi", value: "TECHNICIAN" },
];

export function KaryawanFormDialog({ open, onOpenChange, editing, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Editing; onDone: (info?: { tempPassword?: string; email?: string; pin?: string }) => void }) {
  const isEdit = !!editing;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("TECHNICIAN");
  const [branchId, setBranchId] = useState("");
  const [pin, setPin] = useState("");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Select (Base UI) hanya bisa mengubah value menjadi label yang tampil di
  // trigger kalau menerima prop `items`. Tanpa itu ia menampilkan value mentah,
  // jadi kolom "Cabang" menampilkan UUID seperti "f5d43167-036b-4f2e-...".
  const branchOptions = useMemo(
    () => branches.map((branch) => ({ label: branch.name, value: branch.id })),
    [branches],
  );

  useEffect(() => {
    if (!open) return;
    setPin("");
    getKaryawanBranches().then(setBranches).catch(() => setBranches([]));
    if (editing) {
      setFullName(editing.fullName);
      setEmail(editing.email ?? "");
      setPhone(editing.phone ?? "");
      setRole(editing.role);
      setBranchId(editing.branchId ?? "");
    } else {
      setFullName(""); setEmail(""); setPhone(""); setRole("TECHNICIAN");
    }
  }, [open, editing]);

  // keep branchId default when branches load for create
  useEffect(() => {
    if (!open || editing || branchId) return;
    if (branches.length) setBranchId(branches[0].id);
  }, [branches, open, editing, branchId]);

  const submit = async () => {
    const n = fullName.trim();
    const e = email.trim().toLowerCase();
    if (!n) { toast.error("Nama wajib"); return; }
    if (!e || !e.includes("@")) { toast.error("Email tidak valid"); return; }
    if (!branchId) { toast.error("Cabang wajib"); return; }
    if (pin && !validPin(pin)) { toast.error("PIN harus 6 digit angka"); return; }
    // Server yang menegakkan; cek di sini supaya admin tahu sebelum satu
    // putaran request. Role selain teknisi tetap boleh tanpa nomor.
    if (role === "TECHNICIAN") {
      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.ok) { toast.error(phoneCheck.error); return; }
      if (!phoneCheck.value) { toast.error("Nomor WhatsApp wajib untuk teknisi"); return; }
    }
    setSaving(true);
    try {
      if (isEdit && editing) {
        await updateKaryawan({ profileId: editing.profileId, employeeId: editing.employeeId, fullName: n, phone, email: e, role, branchId, pin });
        playPageTransition();
        toast.success("Karyawan diperbarui");
        onOpenChange(false); onDone();
      } else {
        const res = await createKaryawan({ fullName: n, email: e, phone, role, branchId, pin });
        playPageTransition();
        toast.success("Karyawan dibuat");
        onOpenChange(false);
        // shortcut: popup form masih keluar ~100ms; mount dialog kredensial di
        // render yang sama membuatnya inert (tombol terlihat tapi klik mati).
        setTimeout(() => onDone({ tempPassword: res.tempPassword, email: e, pin }), 150);
      }
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit karyawan" : "Tambah karyawan"}</DialogTitle>
          <DialogDescription>{isEdit ? "Ubah data, role, atau cabang. Email diubah akan mengubah login." : "Buat login baru. Password sementara akan ditampilkan sekali."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5"><Label>Nama lengkap *</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Budi Santoso" /></div>
          <div className="grid gap-1.5"><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="budi@kaggo.id" /></div>
          <div className="grid gap-1.5"><Label>Telepon{role === "TECHNICIAN" ? " *" : ""}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder={role === "TECHNICIAN" ? "0812xxxx (wajib)" : "0812xxxx (opsional)"} /></div>
          <div className="grid gap-1.5">
            <Label>PIN absen (6 digit, opsional)</Label>
            <Input value={pin} onChange={(e) => setPin(normalizePinInput(e.target.value))} inputMode="numeric" autoComplete="off" maxLength={6} placeholder="Kosongkan untuk tidak mengubah" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Role</Label><Select items={ROLES} value={role} onValueChange={(v) => setRole(v ?? "TECHNICIAN")}><SelectTrigger><SelectValue /></SelectTrigger><SelectPopup>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectPopup></Select></div>
            <div className="grid gap-1.5"><Label>Cabang</Label><Select items={branchOptions} value={branchId} onValueChange={(v) => setBranchId(v ?? "")}><SelectTrigger><SelectValue placeholder="Pilih cabang" /></SelectTrigger><SelectPopup>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectPopup></Select></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button><Button onClick={submit} disabled={saving}>{saving ? "Menyimpan…" : isEdit ? "Simpan" : "Buat"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

