"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, LogOut } from "lucide-react";
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
import { GROUP_LABEL_KEY, canAccess, navFor, type AppRole } from "@/lib/nav/manifest";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: string;
};

/**
 * Daftar item navigasi diambil dari manifest, bukan ditulis manual di sini.
 * Sebelumnya setiap role — termasuk FRONTLINER dan TEKNICIAN — melihat
 * Karyawan, Cabang, Audit Log, dan Laporan Keuangan; memilih salah satunya
 * berakhir dengan server action yang melempar error.
 */
export function CerviseCommandPalette({ open, onOpenChange, role }: Props) {
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

  const blocks = navFor(role, "legacy");

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandDialogPopup>
          <Command>
            <CommandInput placeholder="Cari menu, aksi servis..." />
            <CommandList>
              <CommandEmpty>Tidak ada hasil.</CommandEmpty>

              {blocks.map((block, index) => {
                const groupLabel = GROUP_LABEL_KEY[block.group] ?? "Menu";
                return (
                  <CommandGroup key={block.group}>
                    {index > 0 ? null : (
                      <CommandGroupLabel>{groupLabel}</CommandGroupLabel>
                    )}
                    {block.entries.map((entry) => {
                      const Icon = entry.icon;
                      return (
                        <CommandItem
                          key={entry.href}
                          value={`${entry.key} ${entry.href} ${entry.label}`}
                          onClick={() => navigate(entry.href)}
                        >
                          <Icon className="size-4" />
                          {entry.label}
                          {entry.href === "/app" ? <CommandShortcut>⌘D</CommandShortcut> : null}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}

              {canAccess(role as AppRole, "/app/servis") ? (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandGroupLabel>Aksi</CommandGroupLabel>
                    <CommandItem value="tambah servis baru" onClick={handleNewServis}>
                      <Plus className="size-4" /> Tambah Servis Baru
                      <CommandShortcut>⌘N</CommandShortcut>
                    </CommandItem>
                  </CommandGroup>
                </>
              ) : null}

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
