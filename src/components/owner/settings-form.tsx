"use client";

import { useState } from "react";
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { updatePlatformSettings } from "@/app/owner/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Settings = {
  renewal_lead_days: number;
  default_grace_days: number;
  owner_whatsapp: string | null;
  owner_email: string | null;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const [renewalLeadDays, setRenewalLeadDays] = useState(String(settings.renewal_lead_days));
  const [defaultGraceDays, setDefaultGraceDays] = useState(String(settings.default_grace_days));
  const [ownerWhatsapp, setOwnerWhatsapp] = useState(settings.owner_whatsapp ?? "");
  const [ownerEmail, setOwnerEmail] = useState(settings.owner_email ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updatePlatformSettings({ renewalLeadDays, defaultGraceDays, ownerWhatsapp, ownerEmail });
      toast.success("Settings platform disimpan");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan settings");
    } finally {
      setSaving(false);
    }
  };

  return <form className="max-w-xl space-y-4" onSubmit={submit}><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="renewal-lead">Renewal H-</Label><Input id="renewal-lead" type="number" min="1" max="30" value={renewalLeadDays} onChange={(event) => setRenewalLeadDays(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="default-grace">Default grace days</Label><Input id="default-grace" type="number" min="0" max="30" value={defaultGraceDays} onChange={(event) => setDefaultGraceDays(event.target.value)} /></div></div><div className="space-y-1.5"><Label htmlFor="owner-whatsapp">WhatsApp owner</Label><Input id="owner-whatsapp" value={ownerWhatsapp} onChange={(event) => setOwnerWhatsapp(event.target.value)} placeholder="628xxxxxxxxxx" /></div><div className="space-y-1.5"><Label htmlFor="owner-setting-email">Email platform owner</Label><Input id="owner-setting-email" type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="owner@example.com" /></div><Button type="submit" loading={saving}><SaveIcon className="size-4" /> Simpan settings</Button></form>;
}
