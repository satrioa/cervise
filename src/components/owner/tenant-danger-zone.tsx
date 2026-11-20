"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { archiveTenant } from "@/app/owner/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TenantDangerZone({
  organizationId,
  organizationName,
  status,
}: {
  organizationId: string;
  organizationName: string;
  status: string;
}) {
  const router = useRouter();
  const [confirmName, setConfirmName] = useState("");
  const [saving, setSaving] = useState(false);
  const archived = status === "cancelled";
  const matches = confirmName.trim() === organizationName.trim();

  const handleArchive = async () => {
    if (!matches) return;
    setSaving(true);
    try {
      await archiveTenant({ organizationId, confirmName });
      playPageTransition();
      toast.success(`Tenant "${organizationName}" diarsipkan. Akses ditutup, data tetap tersimpan.`);
      setConfirmName("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengarsipkan tenant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <TriangleAlertIcon className="size-4" /> Danger Zone
        </CardTitle>
        <CardDescription>
          Arsipkan tenant untuk menutup akses login. Data tenant, transaksi, dan riwayat tidak dihapus
          dan masih bisa dipulihkan manual.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {archived ? (
          <p className="text-sm text-muted-foreground">Tenant ini sudah diarsipkan.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="confirm-tenant-name">
                Ketik <span className="font-mono text-foreground">{organizationName}</span> untuk konfirmasi
              </Label>
              <Input
                id="confirm-tenant-name"
                value={confirmName}
                onChange={(event) => setConfirmName(event.target.value)}
                placeholder={organizationName}
                autoComplete="off"
                disabled={saving}
              />
            </div>
            <Button
              variant="destructive"
              onClick={() => void handleArchive()}
              disabled={!matches || saving}
              loading={saving}
            >
              <Trash2Icon className="size-4" /> Arsipkan Tenant
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
