"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductVariantDialog } from "./product-variant-dialog";

export function InventoriHeaderActions() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PackageIcon className="size-4" /> Tambah Produk / Varian
      </Button>
      <ProductVariantDialog open={open} onOpenChange={setOpen} onSuccess={() => router.refresh()} />
    </>
  );
}
