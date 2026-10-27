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
  try {
    await target.open({ baudRate: getPrinterBaud() });
  } catch {
    throw new Error("Port serial sudah dipakai aplikasi lain — tutup aplikasi yang memakai port ini, lalu coba lagi (ID: webSerial-in-use)");
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
