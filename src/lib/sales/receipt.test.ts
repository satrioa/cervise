import { describe, expect, it } from "vitest";
import { buildSalesReceiptHtml, receiptStamp } from "./receipt";

const context = {
  brandName: "Calf",
  tagline: "SERVIS GADGET SEMARANG",
  branchName: "Cabang Semarang",
  address: "Jl. Pandanaran 1",
  phone: "081200000000",
};

const sale = {
  sale_number: "SLV-2026-0003",
  created_at: "2026-10-26T07:32:00Z",
  payment_method: "Tunai",
  subtotal: 1000000,
  discount_total: 0,
  total: 1000000,
  returned_value: 0,
};

const items = [
  { name: "Layar iPhone 12", sku: "GD-123", qty: 1, unit_price: 850000, line_total: 850000 },
  { name: "Softcase", sku: "AK-456", qty: 2, unit_price: 75000, line_total: 150000 },
];

describe("nota penjualan", () => {
  it("mencetak identitas toko, item, dan total tanpa PB1", () => {
    const html = buildSalesReceiptHtml({ context, sale, customer: { name: "Budi", phone: "6281200000000" }, cashier: "Adib", items });

    expect(html).toContain("Calf");
    expect(html).toContain("SERVIS GADGET SEMARANG");
    expect(html).toContain("SLV-2026-0003");
    expect(html).toContain("Layar iPhone 12");
    expect(html).toContain("Grand Total");
    expect(html).toContain("Adib");
    expect(html).not.toContain("PB1");
    // Bobot tipis tidak terbaca di printer thermal/dot matrix.
    expect(html).toContain("font-weight: 500");
    expect(html).not.toMatch(/font-weight:\s*[34]00/);
  });

  it("meloloskan teks pelanggan dan produk, bukan menulisnya mentah", () => {
    const html = buildSalesReceiptHtml({
      context,
      sale,
      customer: { name: `<img src=x onerror=alert(1)>`, phone: "6281200000000" },
      items: [{ name: `<script>alert(1)</script>`, sku: "X", qty: 1, unit_price: 100, line_total: 100 }],
    });

    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;img src=x");
  });

  it("menandai baris retur hanya kalau ada barang yang diretur", () => {
    const tanpa = buildSalesReceiptHtml({ context, sale, items });
    const dengan = buildSalesReceiptHtml({ context, sale: { ...sale, returned_value: 50000 }, items });

    expect(tanpa).not.toContain("Diretur");
    expect(dengan).toContain("Diretur");
  });

  it("memakai jam WIB, bukan zona waktu mesin", () => {
    expect(receiptStamp("2026-10-26T07:32:00Z")).toBe("26/10/2026, 14:32");
  });

  it("menaruh logo di atas nama brand, dan hanya alamat + nomor di bawahnya", () => {
    const html = buildSalesReceiptHtml({
      context: { ...context, logoUrl: "https://contoh.test/logo.png" },
      sale,
      items,
    });

    expect(html.indexOf("<img class=\"logo\"")).toBeLessThan(html.indexOf("<h1>"));
    // Nama cabang tidak diulang; alamat dan nomor dipisah baris.
    expect(html).not.toContain("Cabang Semarang");
    expect(html).toContain("Jl. Pandanaran 1<br>081200000000");
  });

  it("mencetak tunai diterima dan kembalian tepat di bawah Grand Total", () => {
    const html = buildSalesReceiptHtml({
      context,
      sale: { ...sale, notes: "[Promo RAMADAN] [Tunai diterima 1.050.000 - kembali 50.000]" },
      items,
    });

    expect(html).toContain("Tunai Diterima");
    expect(html).toContain("Kembali");
    expect(html.indexOf("Grand Total")).toBeLessThan(html.indexOf("Tunai Diterima"));
    expect(html.indexOf("Grand Total")).toBeLessThan(html.indexOf("Kembali"));
  });

  it("mencetak detail bank untuk pembayaran non-tunai", () => {
    const html = buildSalesReceiptHtml({
      context,
      sale: { ...sale, payment_method: "Debit", notes: "[Debit - BCA - Ref 123456]" },
      items,
    });

    expect(html).toContain("Detail");
    expect(html).toContain("BCA - Ref 123456");
    expect(html).not.toContain("Tunai Diterima");
  });
});
