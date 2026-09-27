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
  is_intensif_enabled?: boolean;
  intensif_mode?: string;
  intensif_value?: number;
  intensif_target_count?: number;
};

export function CabangClient({ branches }: { branches: any[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();

  // Wire up: sync create/edit/toggle via router.refresh(); toast handled in children
  const handleCreated = () => {
    router.refresh();
  };

  return (
    <>
      <BranchCards branches={branches} onKelola={(b) => { setSelected(b); setDrawerOpen(true); }} />
      <div className="mt-3">
        <CreateCabangCardButton onClick={() => setOpen(true)} />
      </div>
      <CreateCabangDialog open={open} onOpenChange={setOpen} onCreated={handleCreated} />
      <CabangDrawer branch={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
