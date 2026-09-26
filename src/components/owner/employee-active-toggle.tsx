"use client";

import { useState } from "react";
import { UserCheckIcon, UserXIcon } from "lucide-react";
import { toast } from "sonner";
import { setEmployeeActive } from "@/app/owner/actions";
import { Button } from "@/components/ui/button";

export function EmployeeActiveToggle({ employeeId, active }: { employeeId: string; active: boolean }) {
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      await setEmployeeActive({ employeeId, active: !active });
      toast.success(active ? "Akun dinonaktifkan" : "Akun diaktifkan");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengubah status akun");
    } finally {
      setLoading(false);
    }
  };

  return <Button type="button" size="sm" variant={active ? "outline" : "secondary"} loading={loading} onClick={toggle}>{active ? <UserXIcon className="size-3.5" /> : <UserCheckIcon className="size-3.5" />}{active ? "Nonaktifkan" : "Aktifkan"}</Button>;
}
