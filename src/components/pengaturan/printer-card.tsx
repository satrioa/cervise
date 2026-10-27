"use client";

import { useState, useSyncExternalStore } from "react";
import { BluetoothIcon, PrinterIcon, UsbIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  connectPrinter,
  disconnectPrinter,
  getPrinterStatus,
  printTest,
  getSavedBluetoothPrinter,
  getSavedSerialPort,
  getSavedPrinterType,
  savePrinterType,
} from "@/lib/printer";
import { supportedTransports, bestDirectTransport } from "@/lib/printer/detect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Pengaturan printer ini per perangkat, bukan per toko: pilihan disimpan di
 * localStorage browser yang dipakai. Karena itu isinya sama untuk semua role
 * dan tidak butuh izin server.
 *
 * Memilih perangkat tetap memakai chooser bawaan browser (izin keamanan),
 * jadi tombol di sini hanya memicu `connect()` dari klik pengguna.
 */

const TRANSPORT_LABEL: Record<string, string> = {
  webBluetooth: "Bluetooth (BLE)",
  webSerial: "Kabel USB / Port COM",
  webUsb: "USB",
  browser: "Dialog cetak browser",
};

/** Status printer hanya ada di browser; render kosong saat SSR/hidrasi. */
const subscribeNothing = () => () => {};

export function PrinterSettings({ compact = false }: { compact?: boolean }) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [, setVersion] = useState(0);
  const [busy, setBusy] = useState<"connect" | "test" | "disconnect" | null>(null);
  const status = mounted ? getPrinterStatus() : null;
  const refresh = () => setVersion((version) => version + 1);

  if (!status) return null;
  const direct = status.supported.filter((id) => id !== "browser");
  const savedBluetooth = getSavedBluetoothPrinter();
  const savedSerial = getSavedSerialPort();
  const savedName = savedBluetooth?.name ?? savedBluetooth?.id ?? (savedSerial ? "Port serial" : null);

  const run = async (kind: "connect" | "test") => {
    setBusy(kind);
    try {
      if (kind === "connect") {
        await connectPrinter();
        refresh();
        const s = getPrinterStatus();
        if (s.transport === "rawbt") {
          toast.info("Printer RawBT tersambung — pastikan printer menyala dan terdeteksi.");
        } else {
          toast.success("Printer tersambung");
        }
      } else {
        await printTest();
        refresh();
        toast.success("Nota tes dikirim ke printer");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Printer gagal dipakai");
    } finally {
      setBusy(null);
    }
  };

  const putuskan = async () => {
    setBusy("disconnect");
    try {
      await disconnectPrinter();
      refresh();
      toast.success("Printer diputuskan");
    } finally {
      setBusy(null);
    }
  };

  if (direct.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Browser ini belum mendukung cetak langsung. Tombol Cetak Nota tetap membuka dialog cetak biasa.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={status.connected ? "default" : "secondary"}>
          {status.connected ? "Tersambung" : "Belum tersambung"}
        </Badge>
        {status.transport && <span className="text-muted-foreground">{TRANSPORT_LABEL[status.transport]}</span>}
        {status.connected && status.deviceName && (
          <span className="text-muted-foreground">· {status.deviceName}</span>
        )}
        {!status.connected && savedName && (
          <span className="text-muted-foreground">· tersimpan: {savedName}</span>
        )}
      </div>

      {status.supported.includes("webBluetooth") && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <BluetoothIcon className="size-3" /> Bluetooth: Chrome/Edge di Windows atau Chrome di Android.
        </p>
      )}
      {status.supported.includes("webSerial") && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <UsbIcon className="size-3" /> Kabel USB: pilih port COM printer 58mm.
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor="printer-type" className="text-sm font-medium">Jenis printer</label>
        <Select
          value={getSavedPrinterType() ?? bestDirectTransport()?.id ?? ""}
          onValueChange={(val) => {
            savePrinterType((val as "webBluetooth" | "webSerial" | "rawbt" | null) || null);
            refresh();
          }}
        >
          <SelectTrigger id="printer-type" className="w-full">
            <SelectValue placeholder="Pilih jenis printer" />
          </SelectTrigger>
          <SelectContent>
            {supportedTransports().map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {TRANSPORT_LABEL[t.id] || t.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {supportedTransports().some((t) => t.id === "rawbt") && getSavedPrinterType() !== "rawbt" && (
        <p className="text-xs text-muted-foreground">RawBT tersedia — hubungkan printer melalui RawBT untuk cetak langsung.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => run("connect")} loading={busy === "connect"}>
          {status.connected ? "Ganti Printer" : "Hubungkan Printer"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => run("test")}
          loading={busy === "test"}
          disabled={busy !== null}
        >
          Cetak Tes
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={putuskan}
          loading={busy === "disconnect"}
          disabled={busy !== null}
        >
          Putuskan
        </Button>
      </div>

      <p className={compact ? "text-[11px] text-muted-foreground" : "text-xs text-muted-foreground"}>
        {compact
          ? "Cetak pertama memunculkan pilihan perangkat dari browser; berikutnya tersambung otomatis."
          : "Cetak pertama selalu memunculkan pilihan perangkat dari browser (wajib, tidak bisa dilewati). Setelah dipilih, cetak berikutnya tersambung otomatis. Printernya harus sudah di-pair di pengaturan Bluetooth Windows/Android."}
      </p>
    </div>
  );
}

export function PrinterCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PrinterIcon className="size-4" /> Printer Nota
        </CardTitle>
        <CardDescription>Cetak nota 58mm langsung tanpa dialog print browser</CardDescription>
      </CardHeader>
      <CardContent>
        <PrinterSettings />
      </CardContent>
    </Card>
  );
}
