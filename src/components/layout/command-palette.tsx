"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Wrench,
  Users,
  UserCog,
  Wallet,
  BarChart3,
  Plus,
  LogOut,
  Package,
  Building2,
  Receipt,
  ArrowLeftRight,
  UserCheck,
  ShieldIcon,
  ScrollTextIcon,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function CerviseCommandPalette({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [showNewServis, setShowNewServis] = useState(false);

  const navigate = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const handleNewServis = () => {
    onOpenChange(false);
    setTimeout(() => setShowNewServis(true), 150);
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandDialogPopup>
          <Command>
            <CommandInput placeholder="Cari menu, aksi servis..." />
            <CommandList>
              <CommandEmpty>Tidak ada hasil.</CommandEmpty>

              <CommandGroup>
                <CommandGroupLabel>Navigasi</CommandGroupLabel>
                <CommandItem value="dashboard" onClick={() => navigate("/app")}>
                  <LayoutDashboard className="size-4" /> Dashboard
                  <CommandShortcut>⌘D</CommandShortcut>
                </CommandItem>
              </CommandGroup>

              <CommandGroup>
                <CommandGroupLabel>Operasional</CommandGroupLabel>
                <CommandItem value="servis" onClick={() => navigate("/app/servis")}>
                  <Wrench className="size-4" /> Servis
                </CommandItem>
                <CommandItem value="sparepart inventory" onClick={() => navigate("/app/sparepart")}>
                  <Package className="size-4" /> Sparepart
                </CommandItem>
              </CommandGroup>

              <CommandGroup>
                <CommandGroupLabel>Manajemen</CommandGroupLabel>
                <CommandItem value="inventori" onClick={() => navigate("/app/inventori")}>
                  <Package className="size-4" /> Inventori
                </CommandItem>
                <CommandItem value="customer" onClick={() => navigate("/app/customer")}>
                  <Users className="size-4" /> Customer
                </CommandItem>
                <CommandItem value="karyawan" onClick={() => navigate("/app/karyawan")}>
                  <UserCog className="size-4" /> Karyawan
                </CommandItem>
                <CommandItem value="cabang" onClick={() => navigate("/app/cabang")}>
                  <Building2 className="size-4" /> Cabang
                </CommandItem>
              </CommandGroup>

              <CommandGroup>
                <CommandGroupLabel>Keuangan</CommandGroupLabel>
                <CommandItem value="transaksi" onClick={() => navigate("/app/keuangan/transaksi")}>
                  <Receipt className="size-4" /> Transaksi
                </CommandItem>
                <CommandItem value="arus-kas" onClick={() => navigate("/app/keuangan/arus-kas")}>
                  <ArrowLeftRight className="size-4" /> Arus Kas
                </CommandItem>
              </CommandGroup>

              <CommandGroup>
                <CommandGroupLabel>Laporan</CommandGroupLabel>
                <CommandItem value="laporan-servis" onClick={() => navigate("/app/laporan/servis")}>
                  <Wrench className="size-4" /> Laporan Servis
                </CommandItem>
                <CommandItem value="laporan-keuangan" onClick={() => navigate("/app/laporan/keuangan")}>
                  <Wallet className="size-4" /> Laporan Keuangan
                </CommandItem>
                <CommandItem value="performa" onClick={() => navigate("/app/laporan/performa")}>
                  <UserCheck className="size-4" /> Performa Teknisi
                </CommandItem>
              </CommandGroup>

              <CommandGroup>
                <CommandGroupLabel>Layanan</CommandGroupLabel>
                <CommandItem value="audit-log" onClick={() => navigate("/app/audit-log")}>
                  <ShieldIcon className="size-4" /> Audit Log
                </CommandItem>
                <CommandItem value="garansi" onClick={() => navigate("/app/garansi")}>
                  <ScrollTextIcon className="size-4" /> Garansi
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup>
                <CommandGroupLabel>Aksi</CommandGroupLabel>
                <CommandItem value="tambah-servis" onClick={handleNewServis}>
                  <Plus className="size-4" /> Tambah Servis Baru
                  <CommandShortcut>⌘N</CommandShortcut>
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup>
                <CommandGroupLabel>Sistem</CommandGroupLabel>
                <CommandItem value="keluar" onClick={() => navigate("/login")}>
                  <LogOut className="size-4" /> Keluar
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>

      <Dialog open={showNewServis} onOpenChange={setShowNewServis}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Servis Baru</DialogTitle>
            <DialogDescription>Catat servis gadget baru — ringan untuk Frontliner di HP.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="c-device">Device</Label>
              <Input id="c-device" placeholder="iPhone 11 - Mati total" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-customer">Customer / HP</Label>
              <Input id="c-customer" placeholder="Rina - 0812xxxx" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-complaint">Keluhan</Label>
              <Textarea id="c-complaint" placeholder="Tidak bisa nyala, sudah coba charge..." rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewServis(false)}>Batal</Button>
              <Button onClick={() => setShowNewServis(false)}>Simpan Servis</Button>
            </div>
            <p className="text-xs text-muted-foreground">Next: hubungkan ke `cervise_services` insert dengan `branch_id` + status awal `Masuk`.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
