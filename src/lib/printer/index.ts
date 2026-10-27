import type { PrinterStatus, PrinterTransport, PrintResult, ReceiptData, TransportId } from "./types";
import { bestDirectTransport, supportedTransports, transportById } from "./detect";
import { saveTransport, getSavedPrinterType } from "./storage";
import { buildSaleEscpos, buildServiceEscpos } from "./receipt";
import { loadLogoRaster } from "./logo";
import { centerLine, line, renderLines } from "./escpos";
import { browserPrint, printHtml } from "./transports/browserPrint";

/**
 * API publik cetak nota.
 *
 * Alur `printReceipt`: pilih transport → sambung ulang tanpa prompt → minta
 * izin kalau perlu → kirim byte ESC/POS. Gagal atau tidak didukung = buka
 * dialog cetak biasa, jadi nota tidak pernah hilang.
 */

export type { PrinterStatus, PrintResult, ReceiptData, PrinterTransport, TransportId } from "./types";
export { getSavedBluetoothPrinter, getSavedSerialPort, getSavedPrinterType, savePrinterType } from "./storage";

const NO_TRANSPORT = "Browser ini belum mendukung cetak langsung ke printer";

function activeDirect(): PrinterTransport | null {
  const saved = transportById(getSavedPrinterType());
  if (saved && saved.id !== "browser" && saved.isSupported()) return saved;
  return bestDirectTransport();
}

async function ensureConnected(transport: PrinterTransport): Promise<void> {
  if (transport.isConnected()) return;
  // `reconnect()` memakai izin yang sudah ada; kalau gagal, `connect()` akan
  // menampilkan chooser perangkat (masih dalam gesture klik yang sama).
  if (await transport.reconnect()) return;
  await transport.connect();
}

export async function connectPrinter(id?: TransportId): Promise<PrinterStatus> {
  const transport = id ? transportById(id) : activeDirect();
  if (!transport || transport.id === "browser") throw new Error(NO_TRANSPORT);
  if (!transport.isSupported()) throw new Error("Transport printer itu tidak tersedia di browser ini");
  await transport.connect();
  saveTransport(transport.id);
  return getPrinterStatus();
}

export function getPrinterStatus(): PrinterStatus {
  const supported = supportedTransports().map((transport) => transport.id);
  const transport = activeDirect();
  return {
    transport: transport?.id ?? (supported.includes("browser") ? "browser" : null),
    connected: transport?.isConnected() ?? false,
    deviceName: transport?.deviceName() ?? null,
    supported,
  };
}

export async function disconnectPrinter(): Promise<void> {
  const transport = activeDirect();
  if (transport) await transport.disconnect();
}

export async function printReceipt(data: ReceiptData): Promise<PrintResult> {
  const transport = activeDirect();
  let error: string | undefined;

  if (transport) {
    try {
      await ensureConnected(transport);
      const bytes =
        data.kind === "sale"
          ? buildSaleEscpos(data, {
              logo: data.context.logoUrl ? await loadLogoRaster(data.context.logoUrl) : null,
            })
          : buildServiceEscpos(data.service, { trackingUrl: data.trackingUrl });
      await transport.write(bytes);
      saveTransport(transport.id);
      return { transport: transport.id, fallback: false };
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Printer gagal dipakai";
      // Koneksi setengah jadi jangan ditinggal: cetak berikutnya harus bersih.
      await transport.disconnect().catch(() => {});
    }
  } else {
    error = NO_TRANSPORT;
  }

  if (printHtml(data.html)) {
    return { transport: browserPrint.id, fallback: true, error };
  }
  throw new Error("Pop-up diblokir — izinkan pop-up untuk mencetak nota");
}

/** Nota contoh untuk tombol "Cetak Tes" di pengaturan. */
export async function printTest(): Promise<PrintResult> {
  const transport = activeDirect();
  if (!transport) throw new Error(NO_TRANSPORT);
  if (transport.id === "rawbt") throw new Error("RawBT tidak mendukung cetak tes langsung; pilih transport lain atau hubungkan perangkat");
  await ensureConnected(transport);
  const bytes = renderLines(
    [
      centerLine("CERVISE", 16),
      line(),
      centerLine("Printer siap dipakai"),
      centerLine(new Date().toLocaleString("id-ID")),
    ],
  );
  await transport.write(bytes);
  saveTransport(transport.id);
  return { transport: transport.id, fallback: false };
}
