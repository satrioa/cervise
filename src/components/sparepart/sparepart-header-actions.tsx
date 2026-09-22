"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SparepartFormDialog } from "./sparepart-form-dialog";

export function SparepartHeaderActions({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> Tambah Sparepart
      </Button>
      <SparepartFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={null}
        existingCategories={categories}
        onDone={() => router.refresh()}
      />
    </>
  );
}
