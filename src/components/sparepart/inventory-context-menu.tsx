"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  PlusIcon,
  ArrowLeftRightIcon,
  PencilIcon,
  CopyIcon,
  ArchiveIcon,
  TrashIcon,
} from "lucide-react";
import type { SparepartRow } from "./stock-tone";
import { cerviseToast } from "@/lib/cervise-toast";

type Props = {
  item: SparepartRow;
  children: React.ReactNode;
  onAddStock?: (item: SparepartRow) => void;
  onTransfer?: (item: SparepartRow) => void;
  onEdit?: (item: SparepartRow) => void;
  onArchive?: (item: SparepartRow) => void;
  onDelete?: (item: SparepartRow) => void;
};

function comingSoon(feature: string) {
  toast.info(`${feature} segera hadir`, {
    description: "Butuh tabel & server action inventory — menu sudah siap dihubungkan.",
  });
}

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

export function InventoryContextMenu({
  item,
  children,
  onAddStock,
  onTransfer,
  onEdit,
  onArchive,
  onDelete,
}: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeAll = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeAll();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closeAll]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPos({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isMobile) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="checkbox"]')) return;
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 300);
    setPos({ x: x < 0 ? 10 : x, y: y < 0 ? 10 : y });
    setOpen(true);
  };

  const clampedPos = pos
    ? {
        x: Math.min(Math.max(8, pos.x), typeof window !== "undefined" ? window.innerWidth - 240 : pos.x),
        y: Math.min(Math.max(8, pos.y), typeof window !== "undefined" ? window.innerHeight - 320 : pos.y),
      }
    : null;

  const trigger = React.isValidElement<{
    onContextMenu?: React.MouseEventHandler;
    onClick?: React.MouseEventHandler;
  }>(children)
    ? React.cloneElement(children, {
        onContextMenu: (e: React.MouseEvent) => {
          children.props.onContextMenu?.(e);
          handleContextMenu(e);
        },
        onClick: (e: React.MouseEvent) => {
          children.props.onClick?.(e);
          handleClick(e);
        },
      })
    : (
        <div onContextMenu={handleContextMenu} onClick={handleClick} className="contents">
          {children}
        </div>
      );

  const copySku = async () => {
    try {
      await navigator.clipboard.writeText(item.sku);
      cerviseToast.success({ title: "SKU disalin", description: item.sku });
    } catch {
      toast.error("Gagal menyalin SKU");
    }
    closeAll();
  };

  const menuItemCls =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground text-left";

  const menu =
    open &&
    clampedPos &&
    createPortal(
      <div
        ref={menuRef}
        className="fixed z-50 min-w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        style={{ left: clampedPos.x, top: clampedPos.y }}
        role="menu"
      >
        <div className="px-2.5 py-1.5">
          <div className="truncate font-medium text-sm">{item.name}</div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {item.sku} · Stok {item.stock}
          </div>
        </div>
        <div className="my-1 h-px bg-border" />
        <button
          role="menuitem"
          onClick={() => {
            if (onAddStock) onAddStock(item);
            else comingSoon("Tambah stok");
            closeAll();
          }}
          className={menuItemCls}
        >
          <PlusIcon className="size-4 opacity-70" />
          Tambah Stok
        </button>
        <button
          role="menuitem"
          onClick={() => {
            if (onTransfer) onTransfer(item);
            else comingSoon("Transfer stok antar cabang");
            closeAll();
          }}
          className={menuItemCls}
        >
          <ArrowLeftRightIcon className="size-4 opacity-70" />
          Transfer Stok
        </button>
        <button
          role="menuitem"
          onClick={() => {
            if (onEdit) onEdit(item);
            else comingSoon("Edit sparepart");
            closeAll();
          }}
          className={menuItemCls}
        >
          <PencilIcon className="size-4 opacity-70" />
          Edit
        </button>
        <button role="menuitem" onClick={copySku} className={menuItemCls}>
          <CopyIcon className="size-4 opacity-70" />
          Salin SKU
        </button>
        <button
          role="menuitem"
          onClick={() => {
            if (onArchive) onArchive(item);
            else comingSoon(item.is_active === false ? "Aktifkan sparepart" : "Arsipkan sparepart");
            closeAll();
          }}
          className={menuItemCls}
        >
          <ArchiveIcon className="size-4 opacity-70" />
          {item.is_active === false ? "Aktifkan" : "Arsipkan"}
        </button>
        <div className="my-1 h-px bg-border" />
        <button
          role="menuitem"
          onClick={() => {
            if (onDelete) onDelete(item);
            else comingSoon("Hapus sparepart");
            closeAll();
          }}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-destructive hover:bg-destructive/10 text-left"
        >
          <TrashIcon className="size-4" />
          Hapus
        </button>
      </div>,
      document.body
    );

  return (
    <>
      {trigger}
      {menu}
    </>
  );
}
