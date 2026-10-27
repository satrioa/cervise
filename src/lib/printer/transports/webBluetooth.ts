import type { PrinterTransport } from "../types";
import { getSavedBluetoothPrinter, saveBluetoothPrinter } from "../storage";

/**
 * Web Bluetooth (BLE/GATT) — Chrome/Edge di Windows, Chrome di Android.
 *
 * Web Bluetooth tidak bisa bicara Bluetooth Classic (SPP). Printer 58mm murah
 * kadang SPP-only; kalau perangkat tidak muncul di chooser, pemanggil jatuh
 * kembali ke dialog cetak.
 *
 * Perintah dikirim per potongan kecil: banyak printer menolak paket besar
 * tanpa respons.
 */

const CHUNK_BYTES = 100;
const CHUNK_DELAY_MS = 20;

/** Pasangan service/characteristic yang umum dipakai printer ESC/POS BLE. */
const CANDIDATES = [
  { service: "0000ff00-0000-1000-8000-00805f9b34fb", characteristic: "0000ff02-0000-1000-8000-00805f9b34fb" },
  { service: "000018f0-0000-1000-8000-00805f9b34fb", characteristic: "00002af1-0000-1000-8000-00805f9b34fb" },
  { service: "0000ffe0-0000-1000-8000-00805f9b34fb", characteristic: "0000ffe1-0000-1000-8000-00805f9b34fb" },
  { service: "49535343-fe7d-4ae5-8fa9-9fafd205e455", characteristic: "49535343-8841-43f4-a8d4-ecbe34729bb3" },
  { service: "e7810a71-73ae-499d-8c15-faa9aef0c3f2", characteristic: "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f" },
];

// Tipe minimal Web Bluetooth: TypeScript belum membawanya di lib.dom, dan
// menambah @types hanya untuk ini tidak sepadan.
type BtCharacteristic = {
  properties?: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue?: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
};
type BtService = { getCharacteristic: (id: string) => Promise<BtCharacteristic> };
type BtServer = {
  connected: boolean;
  connect: () => Promise<BtServer>;
  disconnect: () => void;
  getPrimaryService: (id: string) => Promise<BtService>;
};
type BtDevice = { id: string; name?: string | null; gatt?: BtServer | null };
type BtAdapter = {
  requestDevice: (options: { acceptAllDevices: boolean; optionalServices: string[] }) => Promise<BtDevice>;
  getDevices?: () => Promise<BtDevice[]>;
};

function adapter(): BtAdapter | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { bluetooth?: BtAdapter }).bluetooth ?? null;
}

let device: BtDevice | null = null;
let server: BtServer | null = null;
let characteristic: BtCharacteristic | null = null;

async function findCharacteristic(target: BtServer): Promise<BtCharacteristic> {
  for (const candidate of CANDIDATES) {
    try {
      const service = await target.getPrimaryService(candidate.service);
      return await service.getCharacteristic(candidate.characteristic);
    } catch {
      // Coba pasangan berikutnya.
    }
  }
  throw new Error("Printer tidak dikenal — bukan printer ESC/POS BLE");
}

async function open(target: BtDevice): Promise<void> {
  if (!target.gatt) throw new Error("Printer tidak menyediakan koneksi GATT");
  // `gatt.connect()` melempar kalau sudah tersambung; pakai server lama.
  server = target.gatt.connected ? target.gatt : await target.gatt.connect();
  characteristic = await findCharacteristic(server);
  device = target;
  saveBluetoothPrinter({
    id: target.id,
    name: target.name ?? getSavedBluetoothPrinter()?.name ?? null,
  });
}

export const webBluetooth: PrinterTransport = {
  id: "webBluetooth",

  isSupported() {
    return adapter() !== null;
  },

  /**
   * Harus dipanggil dari klik pengguna: `requestDevice` membuka chooser
   * perangkat dan browser menolak kalau tidak ada gesture.
   */
  async connect() {
    const bt = adapter();
    if (!bt) throw new Error("Browser ini tidak mendukung Web Bluetooth");
    const requested = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: CANDIDATES.map((candidate) => candidate.service),
    });
    await open(requested);
  },

  async reconnect() {
    const bt = adapter();
    const saved = getSavedBluetoothPrinter();
    if (!bt || !saved || !bt.getDevices) return false;
    try {
      const target = (await bt.getDevices()).find((candidate) => candidate.id === saved.id);
      if (!target) return false;
      await open(target);
      return true;
    } catch {
      return false;
    }
  },

  async write(data) {
    if (!characteristic) throw new Error("Printer Bluetooth belum tersambung");
    for (let offset = 0; offset < data.length; offset += CHUNK_BYTES) {
      const chunk = data.slice(offset, offset + CHUNK_BYTES);
      // `properties` menentukan metode yang benar-benar didukung karakteristik;
      // memanggil writeWithoutResponse tanpa dukungan akan melempar.
      if (characteristic.properties?.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else if (characteristic.writeValue) {
        await characteristic.writeValue(chunk);
      } else {
        throw new Error("Printer tidak menerima data");
      }
      await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
    }
  },

  async disconnect() {
    try {
      server?.disconnect();
    } catch {
      // Sudah terputus.
    }
    server = null;
    characteristic = null;
    device = null;
  },

  isConnected() {
    return server?.connected === true && characteristic !== null;
  },

  deviceName() {
    return device?.name ?? getSavedBluetoothPrinter()?.name ?? null;
  },
};
