import type { TransportId } from "./types";

/**
 * Preferensi printer di localStorage. Nilainya kecil dan tidak sensitif:
 * hanya id transport, id perangkat BLE, dan id port serial.
 */

const TRANSPORT_KEY = "cervise-printer-transport";
const BLUETOOTH_KEY = "cervise-bluetooth-printer";
const SERIAL_KEY = "cervise-printer-serial";
const BAUD_KEY = "cervise-printer-baud";
const PRINTER_TYPE_KEY = "cervise-printer-type";

export const BAUD_OPTIONS = [9600, 19200, 38400, 57600, 115200] as const;

function read(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Mode privat / kuota penuh: printer tetap bisa dipakai, hanya tidak diingat.
  }
}

export function getSavedTransport(): TransportId | null {
  const value = read(TRANSPORT_KEY);
  return value === "webBluetooth" || value === "webSerial" || value === "webUsb" || value === "browser"
    ? value
    : null;
}

export function saveTransport(id: TransportId | null): void {
  write(TRANSPORT_KEY, id);
}

export type SavedBluetoothPrinter = { id: string; name: string | null };

export function getSavedBluetoothPrinter(): SavedBluetoothPrinter | null {
  const raw = read(BLUETOOTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedBluetoothPrinter;
    return typeof parsed?.id === "string" ? { id: parsed.id, name: parsed.name ?? null } : null;
  } catch {
    // Nilai lama hanya berisi id mentah.
    return { id: raw, name: null };
  }
}

export function saveBluetoothPrinter(device: SavedBluetoothPrinter | null): void {
  write(BLUETOOTH_KEY, device ? JSON.stringify(device) : null);
}

export type SavedSerialPort = { usbVendorId: number | null; usbProductId: number | null };

export function getSavedSerialPort(): SavedSerialPort | null {
  const raw = read(SERIAL_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedSerialPort;
    return { usbVendorId: parsed.usbVendorId ?? null, usbProductId: parsed.usbProductId ?? null };
  } catch {
    return null;
  }
}

export function saveSerialPort(port: SavedSerialPort | null): void {
  write(SERIAL_KEY, port ? JSON.stringify(port) : null);
}

export function getPrinterBaud(): number {
  const raw = read(BAUD_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && (BAUD_OPTIONS as readonly number[]).includes(parsed) ? parsed : 9600;
}

export function savePrinterBaud(value: number | null): void {
  write(BAUD_KEY, value !== null ? String(value) : null);
}

export function getSavedPrinterType(): "webBluetooth" | "webSerial" | "rawbt" | null {
  const value = read(PRINTER_TYPE_KEY);
  return value === "webBluetooth" || value === "webSerial" || value === "rawbt" ? value : null;
}

export function savePrinterType(value: "webBluetooth" | "webSerial" | "rawbt" | null): void {
  write(PRINTER_TYPE_KEY, value);
}
