"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Plus } from "lucide-react";
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
} from "@/components/ui/command";
import { GROUP_LABEL_KEY, canAccess, navFor, type AppRole } from "@/lib/nav/manifest";
import { NewServisDialog } from "@/components/servis/new-servis-dialog";
import { getServisList } from "@/app/app/servis/actions";
import type { ServisListRow } from "@/lib/operational/servis-list";
import { servisLabel } from "@/lib/operational/servis-list";
import { createClient } from "@/lib/supabase/client";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: string;
};

/** Berapa servis yang ditampilkan di palet; ini pencarian cepat, bukan daftar. */
const SERVICE_RESULT_LIMIT = 6;

/**
 * Daftar item navigasi diambil dari manifest, bukan ditulis manual di sini.
 * Sebelumnya setiap role — termasuk FRONTLINER dan TEKNICIAN — melihat
 * Karyawan, Cabang, Audit Log, dan Laporan Keuangan; memilih salah satunya
 * berakhir dengan server action yang melempar error.
 *
 * Daftar servis dimuat sekali saat palet pertama dibuka, lalu disaring di
 * klien. Satu round-trip untuk seluruh sesi lebih murah daripada satu query
 * per ketikan, dan isinya maksimal 500 baris (`getServisList`).
 */
export function CerviseCommandPalette({ open, onOpenChange, role }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [newServisOpen, setNewServisOpen] = useState(false);
  const [services, setServices] = useState<ServisListRow[] | null>(null);
  const canReadServis = canAccess(role as AppRole, "/app/servis");

  // Palet ditutup = query dibuang, supaya dibuka lagi dari keadaan bersih.
  if (!open && query !== "") setQuery("");

  useEffect(() => {
    if (!open || !canReadServis || services !== null) return;
    let cancelled = false;
    getServisList()
      .then((rows) => {
        if (!cancelled) setServices(rows);
      })
      .catch(() => {
        if (!cancelled) setServices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, canReadServis, services]);

  const serviceMatches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2 || !services) return [];
    return services
      .filter((row) =>
        `${row.serviceNumber ?? ""} ${row.device} ${row.customer}`.toLowerCase().includes(term),
      )
      .slice(0, SERVICE_RESULT_LIMIT);
  }, [query, services]);

  const navigate = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const handleNewServis = () => {
    onOpenChange(false);
    // Beri waktu dialog palet menutup dulu; dua dialog bertumpuk membuat
    // fokus keyboard berakhir di dialog yang salah.
    setTimeout(() => setNewServisOpen(true), 150);
  };

  const handleLogout = async () => {
    onOpenChange(false);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  // Sidebar menyembunyikan group akun/pengaturan karena sudah punya tempat
  // sendiri, tapi palette harus tetap bisa melompat ke sana. Jika pencarian di
  // sini lebih sempit dari navigasi, "pengaturan" jadi tidak bisa dicari.
  const blocks = navFor(role, "legacy", { includeHidden: true });

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandDialogPopup>
          <Command value={query} onValueChange={setQuery}>
            <CommandInput placeholder="Cari menu, servis, aksi..." />
            <CommandList>
              <CommandEmpty>Tidak ada hasil.</CommandEmpty>

              {serviceMatches.length > 0 ? (
                <CommandGroup>
                  <CommandGroupLabel>Servis</CommandGroupLabel>
                  {serviceMatches.map((row) => (
                    <CommandItem
                      key={row.id}
                      value={`servis ${servisLabel(row)} ${row.device} ${row.customer}`}
                      onClick={() =>
                        navigate(`/app/servis?q=${encodeURIComponent(servisLabel(row))}`)
                      }
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {servisLabel(row)} · {row.device}
                        <span className="ml-1 opacity-60">{row.customer}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {blocks.map((block) => (
                <CommandGroup key={block.group}>
                  <CommandGroupLabel>{GROUP_LABEL_KEY[block.group] ?? "Menu"}</CommandGroupLabel>
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
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}

              {canReadServis ? (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandGroupLabel>Aksi</CommandGroupLabel>
                    <CommandItem value="tambah servis baru" onClick={handleNewServis}>
                      <Plus className="size-4" /> Tambah Servis Baru
                    </CommandItem>
                  </CommandGroup>
                </>
              ) : null}

              <CommandSeparator />

              <CommandGroup>
                <CommandGroupLabel>Sistem</CommandGroupLabel>
                <CommandItem value="keluar logout" onClick={handleLogout}>
                  <LogOut className="size-4" /> Keluar
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>

      <NewServisDialog
        open={newServisOpen}
        onOpenChange={setNewServisOpen}
        onCreated={() => router.refresh()}
      />
    </>
  );
}
