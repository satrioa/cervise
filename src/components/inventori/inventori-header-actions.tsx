"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, PackageIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InventoryGroup } from "@/lib/operational/inventori";
import { ProductVariantDialog } from "./product-variant-dialog";
import { InventoriExportDialog } from "./inventori-export-dialog";
import { InventoriImportDialog } from "./inventori-import-dialog";

export function InventoriHeaderActions({ groups }: { groups: InventoryGroup[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setImportOpen(true)}>
        <UploadIcon className="size-4" /> Import
      </Button>
      <Button variant="outline" onClick={() => setExportOpen(true)}>
        <DownloadIcon className="size-4" /> Export
      </Button>
      <Button onClick={() => setOpen(true)}>
        <PackageIcon className="size-4" /> Tambah Produk / Varian
      </Button>
      <ProductVariantDialog open={open} onOpenChange={setOpen} onSuccess={() => router.refresh()} />
      <InventoriExportDialog open={exportOpen} onOpenChange={setExportOpen} groups={groups} />
      <InventoriImportDialog open={importOpen} onOpenChange={setImportOpen} groups={groups} />
    </>
  );
}
