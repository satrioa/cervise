"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PrinterIcon,
  WalletIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { STAGES, type Stage } from "@/lib/operational/stage-track";
import { cn } from "@/lib/utils";

const PRINT_OPTIONS = ["Dot Matrix", "Jet", "Thermal"] as const;

type PrintType = typeof PRINT_OPTIONS[number];

type Props = {
  servis: any;
  children: React.ReactNode;
  onViewDetails?: (s: any) => void;
  onStatusChange?: (s: any, next: Stage) => void;
  onEdit?: (s: any) => void;
  onPrint?: (s: any, type: PrintType) => void;
  onInvoice?: (s: any) => void;
  onBayar?: (s: any) => void;
  onDelete?: (s: any) => void;
};

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0 text-[#25D366]" aria-hidden="true"><path d="M19.05 4.94A9.91 9.91 0 0 0 12 2C6.48 2 2 6.48 2 12a9.91 9.91 0 0 0 1.32 4.98L2 22l5.15-1.32A9.91 9.91 0 0 0 12 22c5.52 0 10-4.48 10-10a9.91 9.91 0 0 0-2.95-7.06ZM12 20a8 8 0 0 1-4.08-1.11l-.29-.17-3.06.79.79-3.06-.17-.29A8 8 0 0 1 12 4a8 8 0 0 1 8 8 8 8 0 0 1-8 8Zm4.37-5.92c-.23-.11-1.35-.67-1.56-.74-.21-.08-.36-.11-.51.11-.15.23-.59.74-.72.89-.13.15-.26.17-.48.06-.23-.11-.97-.36-1.85-1.14-.68-.61-1.14-1.36-1.27-1.59-.13-.23-.01-.35.1-.46.1-.1.23-.26.34-.39.11-.13.15-.23.23-.38.08-.15.04-.28-.02-.39-.06-.11-.51-1.23-.7-1.68-.18-.44-.37-.38-.51-.39l-.43-.01c-.15 0-.39.06-.59.28-.2.23-.77.75-.77 1.83s.79 2.12.9 2.27c.11.15 1.55 2.37 3.76 3.32.53.23.94.36 1.26.47.53.17 1.01.14 1.39.09.42-.06 1.35-.55 1.54-1.09.19-.53.19-.99.13-1.09-.06-.1-.21-.15-.44-.26Z" /></svg>
  );
}

/** Baris aksi bottom sheet. `min-h-11` agar nyaman disentuh. */
function SheetAction({
  icon,
  label,
  onClick,
  disabled,
  hint,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        destructive && "text-destructive hover:bg-destructive/10",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function ServisContextMenu({
  servis,
  children,
  onViewDetails,
  onStatusChange,
  onEdit,
  onPrint,
  onInvoice,
  onBayar,
  onDelete,
}: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const closeAll = useCallback(() => setOpen(false), []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
  };

  // Desktop: klik kanan membuka sheet, klik kiri dibiarkan untuk double-click
  // detail. Mobile: tap kartu membuka sheet yang sama.
  const handleClick = (e: React.MouseEvent) => {
    if (!isMobile) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="checkbox"]')) return;
    e.preventDefault();
    setOpen(true);
  };

  const trigger = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<any>, {
        onContextMenu: (e: React.MouseEvent) => {
          (children as any).props?.onContextMenu?.(e);
          handleContextMenu(e);
        },
        onClick: (e: React.MouseEvent) => {
          (children as any).props?.onClick?.(e);
          handleClick(e);
        },
      })
    : (
        <div onContextMenu={handleContextMenu} onClick={handleClick} className="contents">
          {children}
        </div>
      );

  const isPaidStage = servis.status === "Selesai" || servis.status === "Sudah Diambil";

  return (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={(next) => { if (!next) closeAll(); }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-2xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg"
        >
          {/* Header lengket: tombol tutup tetap terjangkau walau daftar aksi
              di bawahnya harus di-scroll. Sebelumnya tombol X ikut tergulir
              keluar layar di ponsel pendek. */}
          <div className="sticky top-0 z-10 -mx-3 flex items-start gap-2 border-b bg-popover px-3 py-2.5">
            <SheetHeader className="min-w-0 flex-1 gap-0.5 p-0">
              <SheetTitle className="truncate font-mono text-sm">
                {servis.serviceNumber ?? servis.id}
              </SheetTitle>
              <SheetDescription className="truncate">
                {servis.device} · {servis.customer}
              </SheetDescription>
            </SheetHeader>
            <SheetClose
              aria-label="Tutup menu"
              className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs hover:bg-accent"
            >
              <XIcon className="size-3.5" />
              Tutup
            </SheetClose>
          </div>

          <div className="flex flex-col">
            <SheetAction
              icon={<EyeIcon className="size-4 opacity-70" />}
              label="Lihat detail"
              onClick={() => {
                onViewDetails?.(servis);
                closeAll();
              }}
            />
            <SheetAction
              icon={<PencilIcon className="size-4 opacity-70" />}
              label="Edit"
              onClick={() => {
                onEdit?.(servis);
                closeAll();
              }}
            />
            {isPaidStage && (
              <SheetAction
                icon={<WalletIcon className="size-4 opacity-70" />}
                label="Bayar sekarang"
                onClick={() => {
                  onBayar?.(servis);
                  closeAll();
                }}
              />
            )}
            <SheetAction
              icon={<WaIcon />}
              label="Kirim Invoice WA"
              disabled={servis.price === 0}
              hint={servis.price === 0 ? "Harga belum diisi" : "Kirim invoice via WhatsApp"}
              onClick={() => {
                onInvoice?.(servis);
                closeAll();
              }}
            />
          </div>

          <div>
            <p className="pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Ubah status
            </p>
            <div className="grid grid-cols-2 gap-1">
              {STAGES.map((stage) => {
                const current = stage.key === servis.status;
                const Icon = stage.icon;
                return (
                  <button
                    key={stage.key}
                    type="button"
                    disabled={current}
                    onClick={() => {
                      onStatusChange?.(servis, stage.key);
                      closeAll();
                    }}
                    className={cn(
                      "flex min-h-10 items-center gap-2 rounded-lg border px-2.5 text-left text-xs",
                      current ? "border-primary/40 bg-primary/5 font-medium" : "hover:bg-accent",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{stage.label}</span>
                    {current && <CheckIcon className="ml-auto size-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Cetak
            </p>
            <div className="grid grid-cols-3 gap-1">
              {PRINT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onPrint?.(servis, opt);
                    closeAll();
                  }}
                  className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs hover:bg-accent"
                >
                  <PrinterIcon className="size-3.5 shrink-0 opacity-70" />
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 border-t pt-2">
            <SheetAction
              icon={<TrashIcon className="size-4" />}
              label="Hapus"
              destructive
              onClick={() => {
                onDelete?.(servis);
                closeAll();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
