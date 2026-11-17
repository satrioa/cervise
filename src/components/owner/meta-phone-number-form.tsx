"use client";

import { useState } from "react";
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { updateTenantMetaPhoneNumber } from "@/app/owner/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MetaPhoneNumberForm({
  organizationId,
  phoneNumberId,
}: {
  organizationId: string;
  phoneNumberId: string | null;
}) {
  const [value, setValue] = useState(phoneNumberId ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateTenantMetaPhoneNumber({ organizationId, phoneNumberId: value });
      toast.success("Nomor pengirim WhatsApp tenant diperbarui");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan nomor pengirim");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-2 border-t pt-4" onSubmit={submit}>
      <Label htmlFor="meta-phone-number">Nomor pengirim WhatsApp</Label>
      <Input
        id="meta-phone-number"
        inputMode="numeric"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Kosongkan untuk pakai nomor global"
      />
      <p className="text-xs text-muted-foreground">
        Phone number ID Meta milik tenant ini. Kosongkan untuk memakai nomor global.
      </p>
      <Button type="submit" size="sm" loading={saving}>
        <SaveIcon className="size-4" /> Simpan nomor
      </Button>
    </form>
  );
}
