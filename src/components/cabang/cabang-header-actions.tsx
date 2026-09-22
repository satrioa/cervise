"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateCabangDialog } from "./create-cabang-dialog";

export function CabangHeaderActions() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> Tambah cabang
      </Button>
      <CreateCabangDialog open={open} onOpenChange={setOpen} onCreated={() => router.refresh()} />
    </>
  );
}
