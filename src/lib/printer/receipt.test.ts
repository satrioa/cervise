import { describe, expect, it } from "vitest";
import type { SalesReceiptInput } from "@/lib/sales/receipt";
import type { ServiceReceiptInput } from "./types";
import { buildSaleEscpos, buildSaleReceiptLines, buildServiceEscpos, buildServiceReceiptLines } from "./receipt";
import { PAPER_COLS } from "./escpos";

const sale: SalesReceiptInput = {
  context: {
    brandName: "Ekaservice",
    tagline: "Servis Gadget Semarang",
    branchName: "Cabang Jakarta",
    address: "Jakarta Pusat · Belvourd No.20",
    phone: "6289531467668",
  },
  sale: {
    sale_number: "SLV-2026-0001",
    created_at: "2026-10-26T07:32:00Z",
    payment_method: "Tunai",
    subtotal: 8200000,
    discount_total: 0,
    total: 8200000,
    returned_value: 0,
  },
  customer: { name: "Indah", phone: "628543325676" },
  cashier: "angle",
  items: [{ name: "iPhone 14 Pro", sku: "GD-B-128GB-WH", qty: 1, unit_price: 8200000, line_total: 8200000 }],
};

const service: ServiceReceiptInput = {
  branch: { name: "Ekaservice", address: "Jl. Pandanaran 20, Semarang", phone: "6289531467668" },
  invoiceNo: "SV-2026-0042",
  printTime: "26/10/2026, 14:32",
  customer: { name: "Indah", phone: "628543325676" },
  teknisi: "angle",
  service: {
    device: "Samsung Galaxy S23",
    merk: "Samsung",
    tipe: "SM-S911",
    complaint: "Layar retak dan sentuhan tidak merespons di bagian atas",
    sparepart: "LCD original",
    price: 1850000,
    status: "Selesai",
    garansiSampai: "26/11/2026",
    trackingCode: "ABC123",
    tenantSlug: "servisin",
  },
};

describe("nota penjualan 58mm", () => {
  it("tidak pernah melebihi 32 kolom", () => {
    for (const line of buildSaleReceiptLines(sale)) {
      expect(line.length).toBeLessThanOrEqual(PAPER_COLS);
    }
  });

  it("mencetak brand ganda selebar 16 kolom, alamat tanpa mengulang nama cabang", () => {
    const lines = buildSaleReceiptLines(sale);

    expect(lines[0]).toContain("EKASERVICE");
    expect(lines[0].length).toBeLessThanOrEqual(16);
    expect(lines.join("\n")).toContain("Jakarta Pusat - Belvourd No.20");
    expect(lines.join("\n")).not.toContain("Cabang Jakarta");
    expect(lines.join("\n")).not.toContain("?");
  });

  it("meratakan total ke kolom kanan", () => {
    const line = buildSaleReceiptLines(sale).find((row) => row.startsWith("GRAND TOTAL"));

    expect(line?.length).toBe(PAPER_COLS);
    expect(line?.endsWith("8.200.000")).toBe(true);
  });

  it("tidak mengirim QR maupun potong kertas", () => {
    const bytes = Array.from(buildSaleEscpos(sale));
    expect(bytes).not.toContain(0x28); // tidak ada GS ( k
    expect(bytes.slice(-3)).toEqual([0x1b, 0x64, 0x04]);
  });

  it("menyisipkan bitmap logo sebelum nama toko kalau logo ada", () => {
    const withoutLogo = buildSaleEscpos(sale);
    const withLogo = buildSaleEscpos(sale, { logo: { width: 8, height: 1, data: [0b10101010] } });

    expect(Array.from(withLogo.slice(0, 11))).toEqual([0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00, 1, 0, 1, 0, 0b10101010]);
    expect(withLogo.length).toBeGreaterThan(withoutLogo.length);
  });

  it("mencetak tunai diterima dan kembalian dari notes", () => {
    const lines = buildSaleReceiptLines({
      ...sale,
      sale: { ...sale.sale, notes: "[Tunai diterima 8.250.000 - kembali 50.000]" },
    });
    const text = lines.join("\n");

    expect(text).toContain("Tunai Diterima");
    expect(text).toContain("50.000");
    // Tetap di bawah Grand Total, sebelum baris terima kasih.
    expect(text.indexOf("GRAND TOTAL")).toBeLessThan(text.indexOf("Tunai Diterima"));
    expect(lines.every((row) => row.length <= PAPER_COLS)).toBe(true);
  });
});

describe("nota servis 58mm", () => {
  it("mencetak nomor, perangkat, keluhan, dan total", () => {
    const text = buildServiceReceiptLines(service).join("\n");

    expect(text).toContain("SV-2026-0042");
    expect(text).toContain("Samsung Galaxy S23");
    expect(text).toContain("Keluhan:");
    expect(text).toContain("Layar retak");
    expect(text).toContain("Garansi s/d");
    expect(text).toContain("1.850.000");
  });

  it("menyertakan QR tracking hanya kalau URL tersedia", () => {
    const withQr = Array.from(buildServiceEscpos(service, { trackingUrl: "https://app.cervise.id/servisin/lacak/ABC123" }));
    const withoutQr = Array.from(buildServiceEscpos(service));

    const hasQr = (bytes: number[]) =>
      bytes.some((value, index) => value === 0x1d && bytes[index + 1] === 0x28 && bytes[index + 2] === 0x6b);
    expect(hasQr(withQr)).toBe(true);
    expect(hasQr(withoutQr)).toBe(false);
  });
});
