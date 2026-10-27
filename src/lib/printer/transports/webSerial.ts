import type { PrinterTransport } from "../types";
import { getSavedSerialPort, saveSerialPort, getPrinterBaud } from "../storage";

/**
 * Web Serial — Chrome/Edge desktop. Tidak ada di Chrome Android.
 *
 * Printer USB 58mm umumnya tampil sebagai port COM (chip CH340/CP210x), dan
 * printer Bluetooth Classic yang sudah di-pair Windows juga membuat COM port
 * (Settings → Bluetooth → More Bluetooth options → COM Ports). Keduanya
 * dikirim byte ESC/POS yang sama, jadi hasil cetaknya identik dengan BLE.
 *
 * Kalau Windows sudah memasang driver printer untuk port itu, `open()` gagal;
 * yang dibutuhkan driver serial, bukan driver printer.
 */

const CHUNK_BYTES = 256;

type SerialPortInfo = { usbVendorId?: number; usbProductId?: number };
type SerialPort = {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  getInfo: () => SerialPortInfo;
};
type SerialAdapter = {
  requestPort: () => Promise<SerialPort>;
  getPorts: () => Promise<SerialPort[]>;
};

function adapter(): SerialAdapter | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { serial?: SerialAdapter }).serial ?? null;
}

let port: SerialPort | null = null;
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

export const SERIAL_HINT = 'Jika menggunakan printer Bluetooth Classic yang sudah di-pair, pilih "Standard Serial over Bluetooth link" di pemilih port.';

async function open(target: SerialPort): Promise<void> {
  // Port yang sama dan sudah kita buka: membuka dua kali ditolak browser
  // dengan InvalidStateError, yang dulu dilaporkan sebagai "dipakai aplikasi
  // lain".
  if (port === target && writer) return;
  // Ganti port: tutup yang lama dulu supaya tidak ada dua handle terbuka.
  if (port && port !== target) await webSerial.disconnect();

  try {
    await target.open({ baudRate: getPrinterBaud() });
  } catch (cause) {
    // Port yang masih tertinggal terbuka dari koneksi sebelumnya di tab ini
    // (mis. `disconnect` gagal di tengah jalan) bisa ditutup lalu dibuka lagi.
    try {
      await target.close();
      await target.open({ baudRate: getPrinterBaud() });
    } catch {
      throw new Error(serialOpenError(cause));
    }
  }
  if (!target.writable) {
    await target.close();
    throw new Error("Port serial tidak bisa ditulis");
  }
  port = target;
  writer = target.writable.getWriter();
  const info = target.getInfo();
  saveSerialPort({ usbVendorId: info.usbVendorId ?? null, usbProductId: info.usbProductId ?? null });
}

/**
 * `SerialPort.open()` menolak dengan alasan yang berbeda-beda, tapi semuanya
 * dulu ditampilkan sebagai "dipakai aplikasi lain". Kasir jadi menutup aplikasi
 * yang salah. Di sini alasan aslinya ikut ditampilkan.
 */
export function serialOpenError(cause: unknown): string {
  const error = cause as { name?: string; message?: string } | null;
  const detail = [error?.name, error?.message].filter(Boolean).join(": ");
  switch (error?.name) {
    case "InvalidStateError":
      return "Port serial masih terbuka di tab/jendela lain. Tutup tab CERVISE yang lain, lalu klik Hubungkan Printer lagi.";
    case "NotFoundError":
      return "Port serial tidak ditemukan — kabel/printer terputus. Sambungkan ulang lalu coba lagi.";
    case "SecurityError":
      return "Izin akses port serial ditolak. Pilih ulang port dan klik Izinkan.";
    default:
      return `Port serial gagal dibuka. Periksa: printer menyala, kabel tersambung, port COM benar, dan tidak dipakai aplikasi lain (RawBT/driver printer).${detail ? ` (${detail})` : ""}`;
  }
}

function label(): string {
  const saved = getSavedSerialPort();
  if (!saved?.usbVendorId) return "Port serial";
  const vendor = saved.usbVendorId.toString(16).padStart(4, "0").toUpperCase();
  return `Port serial ${vendor}`;
}

export const webSerial: PrinterTransport = {
  id: "webSerial",

  isSupported() {
    return adapter() !== null;
  },

  /** Harus dari klik pengguna: `requestPort` membuka pemilih port. */
  async connect() {
    const serial = adapter();
    if (!serial) throw new Error("Browser ini tidak mendukung Web Serial");
    await open(await serial.requestPort());
  },

  async reconnect() {
    const serial = adapter();
    const saved = getSavedSerialPort();
    if (!serial || !saved) return false;
    try {
      const target = (await serial.getPorts()).find((candidate) => {
        const info = candidate.getInfo();
        return (
          (info.usbVendorId ?? null) === saved.usbVendorId &&
          (info.usbProductId ?? null) === saved.usbProductId
        );
      });
      if (!target) return false;
      await open(target);
      return true;
    } catch {
      return false;
    }
  },

  async write(data) {
    if (!writer) throw new Error("Port serial belum dibuka");
    for (let offset = 0; offset < data.length; offset += CHUNK_BYTES) {
      await writer.write(data.slice(offset, offset + CHUNK_BYTES));
    }
  },

  async disconnect() {
    try {
      await writer?.releaseLock();
    } catch {
      // Lock sudah lepas / writer rusak; port tetap harus ditutup.
    }
    try {
      await port?.close();
    } catch {
      // Port sudah tertutup.
    }
    writer = null;
    port = null;
  },

  isConnected() {
    return port !== null && writer !== null;
  },

  deviceName() {
    return port ? label() : null;
  },
};
