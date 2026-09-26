import { Settings2Icon } from "lucide-react";
import { getPlatformSettings } from "../actions";
import { SettingsForm } from "@/components/owner/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OwnerSettingsPage() {
  const settings = await getPlatformSettings();
  return <div className="mx-auto max-w-4xl space-y-6"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"><Settings2Icon className="size-3.5" /> Platform settings</div><h1 className="mt-1 font-heading text-3xl">Settings</h1><p className="mt-1 text-sm text-muted-foreground">Atur reminder renewal, grace period, dan kontak WhatsApp platform owner.</p></div><Card><CardHeader><CardTitle className="text-base">Renewal defaults</CardTitle><CardDescription>Perubahan berlaku untuk subscription lifecycle berikutnya.</CardDescription></CardHeader><CardContent><SettingsForm settings={settings} /></CardContent></Card></div>;
}
