import { describe, expect, it } from "vitest";
import { serialOpenError } from "./webSerial";

/**
 * Dulu semua kegagalan `SerialPort.open()` dilaporkan sebagai "port dipakai
 * aplikasi lain", jadi kasir menutup aplikasi yang salah. Pesan sekarang harus
 * membawa alasan asli dari browser.
 */
describe("serialOpenError", () => {
  it("menyebut tab lain untuk port yang masih terbuka", () => {
    const message = serialOpenError(new DOMException("The port is already open.", "InvalidStateError"));
    expect(message).toContain("tab");
    expect(message).not.toContain("dipakai aplikasi lain");
  });

  it("menyebut kabel/printer terputus untuk port yang hilang", () => {
    expect(serialOpenError(new DOMException("No port selected.", "NotFoundError"))).toContain("terputus");
  });

  it("menampilkan alasan asli untuk kegagalan lain", () => {
    const message = serialOpenError(new DOMException("Failed to open serial port.", "NetworkError"));
    expect(message).toContain("gagal dibuka");
    expect(message).toContain("Failed to open serial port.");
  });

  it("tetap memberi pesan saat error bukan DOMException", () => {
    expect(serialOpenError(undefined)).toContain("gagal dibuka");
  });
});
