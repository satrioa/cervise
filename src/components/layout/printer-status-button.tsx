"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { PrinterIcon } from "lucide-react";
import { Button as CossButton } from "@/components/ui/coss-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PrinterSettings } from "@/components/pengaturan/printer-card";
import {
  getPrinterStatus,
  getSavedBluetoothPrinter,
  getSavedPrinterType,
  getSavedSerialPort,
  reconnectSavedPrinter,
} from "@/lib/printer";
import { cn } from "@/lib/utils";

/** Status printer hanya ada di browser; render placeholder saat SSR/hidrasi. */
const subscribeNothing = () => () => {};

/**
 * Tombol status printer untuk header admin.
 *
 * Statusnya diturunkan dari localStorage (`getSaved*`) plus koneksi aktif:
 * tersambung, tersimpan tapi sedang putus, atau belum pernah diatur. Isi
 * popover-nya `PrinterSettings` yang sama dengan drawer frontliner.
 */
export function PrinterStatusButton({ className }: { className?: string }) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [open, setOpen] = useState(false);
  const [, setVersion] = useState(0);

  // Refresh mengosongkan state koneksi in-memory; coba pulihkan izin tersimpan.
  useEffect(() => {
    if (!mounted) return;
    void reconnectSavedPrinter().then(() => setVersion((version) => version + 1));
  }, [mounted]);

  if (!mounted) {
    return (
      <CossButton variant="outline" size="sm" disabled className={cn("h-8 gap-1.5 px-2.5 text-xs", className)}>
        <PrinterIcon className="size-3.5" />
        Printer
      </CossButton>
    );
  }

  const status = getPrinterStatus();
  const hasSaved = Boolean(
    getSavedPrinterType() || getSavedBluetoothPrinter() || getSavedSerialPort(),
  );
  const label = status.connected ? "Terhubung" : hasSaved ? "Printer Offline" : "Tidak Terhubung";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setVersion((version) => version + 1);
      }}
    >
      <PopoverTrigger
        render={
          <CossButton
            variant="outline"
            size="sm"
            className={cn("h-8 gap-1.5 px-2.5 text-xs", className)}
            aria-label={`Status printer: ${label}`}
            title={`Status printer: ${label}`}
          />
        }
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            status.connected ? "bg-emerald-500" : hasSaved ? "bg-amber-500" : "bg-muted-foreground/40",
          )}
        />
        <PrinterIcon className="size-3.5" />
        <span>{label}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <PrinterIcon className="size-4" />
          Printer Nota
        </div>
        <PrinterSettings compact />
      </PopoverContent>
    </Popover>
  );
}
