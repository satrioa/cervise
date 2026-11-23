"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { createPlatformIncident } from "@/app/owner/actions";
import { UPTIME_SERVICES } from "@/lib/owner/dashboard-widgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function IncidentForm() {
  const [occurredOn, setOccurredOn] = useState("");
  const [service, setService] = useState<string>(UPTIME_SERVICES[0]);
  const [status, setStatus] = useState("degraded");
  const [minutes, setMinutes] = useState("15");
  const [title, setTitle] = useState("");
  const [updates, setUpdates] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createPlatformIncident({ occurredOn, service, status, minutes, title, updates });
      router.refresh();
      toast.success("Insiden dicatat");
      setTitle("");
      setUpdates("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mencatat insiden");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="max-w-2xl space-y-4" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="incident-date">Tanggal</Label>
          <Input id="incident-date" type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="incident-service">Layanan</Label>
          <select id="incident-service" value={service} onChange={(event) => setService(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
            {UPTIME_SERVICES.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="incident-status">Status</Label>
          <select id="incident-status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
            <option value="degraded">Degraded</option>
            <option value="down">Down</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="incident-minutes">Durasi (menit)</Label>
          <Input id="incident-minutes" type="number" min={1} max={1440} value={minutes} onChange={(event) => setMinutes(event.target.value)} required />
        </div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="incident-title">Judul insiden</Label><Input id="incident-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: WABA lambat merespons" /></div>
      <div className="space-y-1.5">
        <Label htmlFor="incident-updates">Update (HH:MM|Label|Catatan, 1 per baris)</Label>
        <Textarea id="incident-updates" value={updates} onChange={(event) => setUpdates(event.target.value)} rows={3} placeholder="10:00|Investigating|Sinkron&#10;10:15|Resolved" />
      </div>
      <Button type="submit" loading={saving}><PlusIcon className="size-4" /> Catat insiden</Button>
    </form>
  );
}
