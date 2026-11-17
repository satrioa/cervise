"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { OpeningBalanceDialog } from "@/components/cash/opening-balance-dialog";

/**
 * Satu dialog saldo awal untuk seluruh shell. Auto-open saat tidak ada sesi
 * dipicu oleh shell, tombol "Buka Toko"/"Buka kembali" dipicu dashboard —
 * keduanya memakai instance yang sama supaya tidak ada dua dialog bertumpuk.
 */
type CashDialogContextValue = { openCashDialog: () => void };

const CashDialogContext = createContext<CashDialogContextValue | null>(null);

export function useCashDialog() {
  const value = useContext(CashDialogContext);
  if (!value) throw new Error("useCashDialog harus dipakai di dalam CashDialogProvider");
  return value;
}

export function CashDialogProvider({
  children,
  staffName,
}: {
  children: ReactNode;
  staffName?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const openCashDialog = useCallback(() => setOpen(true), []);

  return (
    <CashDialogContext.Provider value={{ openCashDialog }}>
      {children}
      {open ? (
        <OpeningBalanceDialog
          staffName={staffName}
          onClose={() => setOpen(false)}
          onOpened={() => {
            setOpen(false);
            // Server merender halaman sebelum sesi ada. Muat ulang payload
            // supaya dashboard langsung melihat toko terbuka.
            router.refresh();
          }}
        />
      ) : null}
    </CashDialogContext.Provider>
  );
}
