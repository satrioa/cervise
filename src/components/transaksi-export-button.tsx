"use client";

import { useState } from "react";
import { ArrowDownToLineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransaksiExportDialog } from "@/components/transaksi-export-dialog";

type Tx = {
  id: string;
  rawId: string;
  date: string;
  description: string;
  counterparty: string;
  amount: number;
  direction: "in" | "out";
  method: string;
  status: string;
};

export function TransaksiExportButton({ rows }: { rows: Tx[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ArrowDownToLineIcon className="size-4" />
        Export
      </Button>
      <TransaksiExportDialog open={open} onOpenChange={setOpen} rows={rows} />
    </>
  );
}
