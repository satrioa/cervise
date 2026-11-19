"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ClipboardListIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Button as CossButton } from "@/components/ui/coss-button";
import {
  Card,
  CardFrame,
  CardFrameAction,
  CardFrameDescription,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { submitKioskAttendance } from "./actions";
import { jam, logStatus, logStatusLabel, type LogRow } from "./kiosk-data";

export function KioskClient({ name, today, rows }: { name: string; today: string; rows: LogRow[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lokasi, setLokasi] = useState<{ lat: number; lng: number } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setCameraError("Kamera tidak tersedia. Izinkan akses kamera di browser."));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function capture(): Promise<File | null> {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      640,
      640,
    );
    return new Promise<File | null>((resolve) =>
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], "selfie.jpg", { type: "image/jpeg" }) : null),
        "image/jpeg",
        0.85,
      ),
    );
  }

  function mintaLokasi(cb: (koordinat: { lat: number; lng: number } | null) => void) {
    if (!navigator.geolocation) {
      cb(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const koordinat = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLokasi(koordinat);
        cb(koordinat);
      },
      () => {
        toast.info("Lokasi tidak tersedia. Absen tetap disimpan.");
        cb(lokasi);
      },
      { timeout: 8000 },
    );
  }

  function absen(kind: "check_in" | "check_out") {
    void capture().then((file) => {
      if (!file) {
        toast.error("Selfie belum siap. Coba lagi.");
        return;
      }
      mintaLokasi((koordinat) =>
        startTransition(async () => {
          const form = new FormData();
          form.append("kind", kind);
          form.append("selfie", file);
          if (koordinat) {
            form.append("lat", String(koordinat.lat));
            form.append("lng", String(koordinat.lng));
          }
          try {
            await submitKioskAttendance(form);
            toast.success(kind === "check_in" ? "Absen masuk tercatat" : "Absen pulang tercatat");
            window.location.reload();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Gagal menyimpan absen");
          }
        }),
      );
    });
  }

  const todayRow = rows.find((r) => r.tanggal === today);
  const sudahMasuk = !!todayRow?.jamMasuk;
  const sudahPulang = !!todayRow?.jamPulang;

  return (
    <main className="mx-auto max-w-md space-y-6 px-5 py-8">
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Kaggo · Absensi</p>
        <h1 className="font-heading text-xl font-semibold">Halo, {name}</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </header>

      <div className="mx-auto aspect-square w-64 overflow-hidden rounded-full border-4 border-background bg-muted shadow-lg">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Preview kamera selfie"
          className="h-full w-full object-cover"
        />
      </div>
      {cameraError ? <p className="text-center text-sm text-destructive">{cameraError}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <Button disabled={pending || sudahMasuk} onClick={() => absen("check_in")}>
          Absen Masuk
        </Button>
        <Button disabled={pending || !sudahMasuk || sudahPulang} onClick={() => absen("check_out")}>
          Absen Pulang
        </Button>
      </div>
      {sudahPulang ? <p className="text-center text-sm text-muted-foreground">Absen hari ini selesai.</p> : null}

      <CardFrame className="w-full">
        <CardFrameHeader className="grid-rows-1 gap-2 px-4 py-3">
          <CardFrameTitle>Log harian</CardFrameTitle>
          <CardFrameDescription>Riwayat absensi Anda</CardFrameDescription>
          <CardFrameAction>
            <CossButton
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => window.location.reload()}
            >
              <RefreshCwIcon />
              Segarkan
            </CossButton>
          </CardFrameAction>
        </CardFrameHeader>
        <Card>
          <CardPanel className="p-0">
            {rows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ClipboardListIcon />
                  </EmptyMedia>
                  <EmptyTitle>Belum ada log</EmptyTitle>
                  <EmptyDescription>Absen pertama Anda akan muncul di sini.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      {["Tanggal", "Masuk", "Pulang", "Status"].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const status = logStatus(row);
                      return (
                        <tr key={row.tanggal} className="border-t">
                          <td className="px-3 py-2">{row.tanggal}</td>
                          <td className="px-3 py-2">{jam(row.jamMasuk)}</td>
                          <td className="px-3 py-2">{jam(row.jamPulang)}</td>
                          <td className="px-3 py-2">{logStatusLabel(status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardPanel>
        </Card>
      </CardFrame>
    </main>
  );
}
