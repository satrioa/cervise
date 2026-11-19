"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitAttendance } from "./actions";

type Props = {
  name: string;
  branchName: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string | null;
};

export function AbsensiClient({ name, branchName, date, checkInAt, checkOutAt, note }: Props) {
  const [selfie, setSelfie] = useState<File | null>(null);
  const [catatan, setCatatan] = useState(note ?? "");
  const [lokasi, setLokasi] = useState<{ lat: number; lng: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const kind = !checkInAt ? "check_in" : !checkOutAt ? "check_out" : null;

  function absen() {
    if (!kind || !selfie) return;
    startTransition(async () => {
      const form = new FormData();
      form.append("kind", kind);
      form.append("selfie", selfie);
      form.append("note", catatan);
      if (lokasi) {
        form.append("lat", String(lokasi.lat));
        form.append("lng", String(lokasi.lng));
      }
      try {
        await submitAttendance(form);
        toast.success(kind === "check_in" ? "Absen masuk tercatat" : "Absen pulang tercatat");
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan absen");
      }
    });
  }

  function mintaLokasi() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLokasi({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.info("Lokasi tidak tersedia. Absen tetap bisa disimpan."),
      { timeout: 8000 },
    );
  }

  const jam = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit",
        }).format(new Date(value))
      : "-";

  return (
    <main className="mx-auto max-w-md px-4 py-8 space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">{date} · {branchName}</p>
        <h1 className="font-heading text-2xl font-semibold">{name}</h1>
      </div>
      <div className="rounded-xl border p-4 space-y-2 text-sm">
        <p>Masuk: <strong>{jam(checkInAt)}</strong></p>
        <p>Pulang: <strong>{jam(checkOutAt)}</strong></p>
      </div>
      {kind ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="selfie">Foto selfie</Label>
            <Input
              id="selfie"
              type="file"
              accept="image/*"
              capture="user"
              onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Catatan (opsional)</Label>
            <Input
              id="note"
              value={catatan}
              maxLength={500}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Misal: terlambat karena hujan"
            />
          </div>
          <Button variant="outline" className="w-full" onClick={mintaLokasi} type="button">
            {lokasi ? "Lokasi tercatat" : "Ambil lokasi (opsional)"}
          </Button>
          <Button className="w-full" disabled={pending || !selfie} onClick={absen}>
            {pending ? "Menyimpan..." : kind === "check_in" ? "Absen Masuk" : "Absen Pulang"}
          </Button>
          {!selfie ? <p className="text-xs text-muted-foreground">Foto selfie wajib diisi.</p> : null}
        </>
      ) : (
        <p className="rounded-xl border p-4 text-sm">Absen hari ini sudah lengkap.</p>
      )}
    </main>
  );
}
