import type { PrinterTransport } from "../types";

/**
 * Fallback dialog cetak browser. Tidak mengirim byte ke printer: HTML nota
 * dibuka di jendela baru dan pengguna memilih printer di dialog sistem.
 *
 * Dipakai untuk Safari/Firefox/iOS, atau saat transport langsung gagal —
 * nota tetap bisa dicetak lewat printer AirPrint/driver biasa.
 */

export function printHtml(html: string): boolean {
  if (typeof window === "undefined") return false;
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  // Logo diambil dari URL; cetak setelah gambar selesai (maks 1,5 detik)
  // supaya nota tidak tercetak tanpa logo pada koneksi lambat.
  const images = Array.from(win.document.images).map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          window.setTimeout(done, 1500);
        }),
  );
  void Promise.all(images).then(() => window.setTimeout(() => win.print(), 150));
  return true;
}

export const browserPrint: PrinterTransport = {
  id: "browser",
  isSupported() {
    return typeof window !== "undefined";
  },
  async connect() {
    // Tidak ada perangkat yang perlu diizinkan.
  },
  async reconnect() {
    return true;
  },
  async write() {
    // Byte ESC/POS tidak berarti bagi dialog cetak; `printHtml` yang dipakai.
  },
  async disconnect() {},
  isConnected() {
    return true;
  },
  deviceName() {
    return "Dialog cetak browser";
  },
};
