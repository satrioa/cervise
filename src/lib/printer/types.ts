import type { SalesReceiptInput } from "@/lib/sales/receipt";

/**
 * Kontrak transport printer. Transport baru (mis. BLE native iOS) cukup
 * mengimplementasikan interface ini lalu didaftarkan di `detect.ts`; layout
 * nota dan UI tidak perlu diubah.
 */

export type TransportId = "webBluetooth" | "webSerial" | "webUsb" | "browser" | "rawbt";

export interface PrinterTransport {
  readonly id: TransportId;
  isSupported(): boolean;
  /** Minta izin perangkat. Harus dipanggil dari gesture pengguna (klik). */
  connect(): Promise<void>;
  /** Sambung ulang ke perangkat yang sudah diizinkan, tanpa prompt bila bisa. */
  reconnect(): Promise<boolean>;
  /** Kirim byte ESC/POS per potongan kecil. */
  write(data: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  deviceName(): string | null;
}

export type PrinterStatus = {
  transport: TransportId | null;
  connected: boolean;
  deviceName: string | null;
  /** Transport yang didukung browser ini, untuk ditampilkan di pengaturan. */
  supported: TransportId[];
};

export type PrintResult = {
  transport: TransportId;
  /** `true` = dipakai dialog cetak browser, bukan printer langsung. */
  fallback: boolean;
  error?: string;
};

/**
 * Nota servis. Bentuknya sengaja struktural agar `PrintData` di
 * `components/print-templates.tsx` bisa dipakai langsung tanpa konversi.
 */
export type ServiceReceiptInput = {
  branch: { name: string; address: string | null; phone: string | null; website?: string | null };
  invoiceNo: string;
  printTime: string;
  customer: { name: string; phone: string; address?: string | null };
  teknisi: string;
  service: {
    device: string;
    merk?: string;
    tipe?: string;
    complaint?: string;
    sparepart?: string;
    price: number | null;
    status: string;
    /** Belum Selesai/Sudah Diambil: nominal masih estimasi. */
    isEstimate?: boolean;
    date?: string;
    garansiSampai?: string;
    trackingCode?: string;
    tenantSlug?: string | null;
  };
};

export type ReceiptData =
  | {
      kind: "sale";
      /** HTML nota yang dipakai fallback `window.print()`. */
      html: string;
      context: SalesReceiptInput["context"];
      sale: SalesReceiptInput["sale"];
      customer?: SalesReceiptInput["customer"];
      cashier?: string | null;
      items: SalesReceiptInput["items"];
    }
  | {
      kind: "service";
      html: string;
      /** URL halaman lacak untuk QR; kosong = QR dilewati. */
      trackingUrl?: string | null;
      service: ServiceReceiptInput;
    };
