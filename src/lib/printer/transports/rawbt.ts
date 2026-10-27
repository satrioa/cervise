"use client";
import type { PrinterTransport } from "../types";
import { saveTransport } from "../storage";

let configured = false;
const RAWBT_PACKAGE = "ru.a420d.rawbtprinter";
const MAX_URL = 1800; // conservative URL-safe length

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function isRawbtInstalledHint(): string {
  return "Pasang app RawBT (ru.a402d.rawbtprinter) di Android, lalu pairing printer di Settings → Bluetooth.";
}

export const rawbt: PrinterTransport = {
  id: "rawbt",
  isSupported() { return isAndroid(); },
  async connect() {
    if (!isAndroid()) throw new Error("RawBT hanya tersedia di Android");
    configured = true;
    saveTransport("rawbt");
  },
  async reconnect() { return configured; },
  async write(data) {
    if (!configured) throw new Error("Buka app RawBT terlebih dahulu (Hubungkan Printer)");
    const b64 = Array.from(data, (b) => String.fromCharCode(b % 256)).join("");
    const url = intentUrl(btoa(b64));
    if (url.length > MAX_URL) throw new Error("Nota terlalu panjang untuk RawBT. Pakai USB/COM atau turunkan jumlah item.");
    window.location.href = url;  // within user gesture from printReceipt()
  },
  async disconnect() { configured = false; },
  isConnected() { return configured; },
  deviceName() { return configured ? "RawBT (terkonfigurasi)" : null; },
};

export function intentUrl(b64: string): string {
  return `intent:${b64}#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};end;`;
}