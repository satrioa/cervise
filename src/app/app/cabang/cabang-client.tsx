"use client";

import { useState } from "react";
import { BranchCards, CreateCabangCardButton } from "@/components/cabang/branch-cards";
import { CreateCabangDialog } from "@/components/cabang/create-cabang-dialog";
import { CabangDrawer } from "@/components/cabang/cabang-drawer";
import { useRouter } from "next/navigation";

type BranchItem = {
  id: string;
  name: string;
  city: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  teknisiCount: number;
};

export function CabangClient({ branches, isDemo }: { branches: BranchItem[]; isDemo?: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BranchItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();

  // Wire up: sync create/edit/toggle via router.refresh(); toast handled in children
  const handleCreated = () => {
    router.refresh();
  };

  return (
    <>
      {isDemo && (
        <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Mode demo — data cabang belum terhubung ke database (belum login / RLS). Buat cabang akan gagal sampai login. Kelola menampilkan data mock.
        </div>
      )}
      <BranchCards branches={branches} onKelola={(b) => { setSelected(b); setDrawerOpen(true); }} />
      <div className="mt-3">
        <CreateCabangCardButton onClick={() => setOpen(true)} />
      </div>
      <CreateCabangDialog open={open} onOpenChange={setOpen} onCreated={handleCreated} />
      <CabangDrawer branch={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
