import { getSavedPrinterType } from "./storage";
import type { PrinterTransport, TransportId } from "./types";
import { webBluetooth } from "./transports/webBluetooth";
import { webSerial } from "./transports/webSerial";
import { browserPrint } from "./transports/browserPrint";
import { rawbt } from "./transports/rawbt";

/**
 * Daftar transport. Menambah transport baru (mis. BLE native iOS) cukup satu
 * file di `transports/` + satu baris di sini; layout nota dan UI tidak berubah.
 *
 * Urutan = prioritas: printer langsung dulu, dialog cetak terakhir.
 */
const TRANSPORTS: PrinterTransport[] = [webSerial, webBluetooth, rawbt, browserPrint];

export function allTransports(): PrinterTransport[] {
  return TRANSPORTS;
}

export function transportById(id: TransportId | null | undefined): PrinterTransport | null {
  if (!id) return null;
  return TRANSPORTS.find((transport) => transport.id === id) ?? null;
}

export function supportedTransports(): PrinterTransport[] {
  return TRANSPORTS.filter((transport) => transport.isSupported());
}

/** Transport langsung pertama yang didukung browser ini, tanpa fallback. */
export function bestDirectTransport(): PrinterTransport | null {
  return supportedTransports().find((transport) => transport.id !== "browser") ?? null;
}

export { browserPrint };

export function getSavedTransportByType(): PrinterTransport | null {
  return transportById(getSavedPrinterType());
}
