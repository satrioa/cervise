"use client";

import { useState } from "react";
import { UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerDialog } from "./customer-dialog";

export function CustomerCreateButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlusIcon />
        Tambah Customer
      </Button>
      <CustomerDialog open={open} onOpenChange={setOpen} mode="create" />
    </>
  );
}
