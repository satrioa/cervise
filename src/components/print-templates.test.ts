import { describe, expect, it } from "vitest";
import { renderDotMatrixHtml, renderJetHtml, renderThermalHtml, toPrintData, type PrintData } from "./print-templates";

const base: PrintData = {
  branch: { name: "Servisin", address: "Jl. Merdeka", phone: "08123456789", website: "servisin.test" },
  invoiceNo: "SRV-2026-0001",
  service: {
    id: "svc-1",
    device: "iPhone 13 Pro",
    merk: "iPhone",
    tipe: "13 Pro",
    price: 350000,
    status: "Dikerjakan",
    teknisi: "Budi",
    date: "2026-09-18",
    garansiSampai: "2026-10-18",
    tanggalTerima: "2026-09-18",
    trackingCode: "A3BD9F2C4B",
    tenantSlug: "servisin",
  },
  customer: { name: "RINA", phone: "0812 3456 7890" },
  admin: "Sari",
  teknisi: "Budi",
  printTime: "22/09/2026, 17:46",
};

describe("struk memuat kode cek publik", () => {
  it("mencetak kode pada ketiga template", () => {
    expect(renderJetHtml(base)).toContain("A3BD9F2C4B");
    expect(renderDotMatrixHtml(base)).toContain("A3BD9F2C4B");
    expect(renderThermalHtml(base)).toContain("A3BD9F2C4B");
  });

  it("tidak mencetak baris kode kosong maupun label kosong", () => {
    // Fixture dibangun lewat toPrintData supaya semua field opsional terisi
    // em-dash, persis seperti data produksi.
    const withoutCode = toPrintData(
      {
        id: "svc-1",
        device: "iPhone 13 Pro",
        merk: "iPhone",
        tipe: "13 Pro",
        status: "Dikerjakan",
        price: 350000,
        garansi_value: 30,
        garansi_unit: "hari",
        customer: "Rina · 0812 3456 7890",
        date: "2026-09-18",
      },
      { brandName: "Servisin", tenantSlug: "servisin" },
      null,
    );

    for (const html of [renderJetHtml(withoutCode), renderDotMatrixHtml(withoutCode), renderThermalHtml(withoutCode)]) {
      expect(html).not.toContain("Kode cek");
      expect(html).not.toContain("KODE CEK");
      expect(html).not.toContain("undefined");
    }
  });

  it("meng-escape kode dari markup yang dicetak", () => {
    const hostile: PrintData = {
      ...base,
      service: { ...base.service, trackingCode: '<img src=x onerror="alert(1)">' },
    };

    expect(renderJetHtml(hostile)).not.toContain("<img src=x");
  });

  it("mencetak alamat halaman lacak dari website tenant", () => {
    // Kode tanpa URL tidak bisa dipakai pelanggan, jadi path ikut dicetak.
    for (const html of [renderJetHtml(base), renderDotMatrixHtml(base), renderThermalHtml(base)]) {
      expect(html).toContain("servisin.test/servisin/lacak");
    }
  });

  it("tetap punya kode saat print dari baris list tanpa detail", () => {
    // Bulk print: fetch detail per baris bisa gagal; mapper list sudah
    // menormalkan trackingCode ke huruf besar.
    const fromList = toPrintData({ id: "svc-1", trackingCode: "A3BD9F2C4B", device: "iPhone 13", status: "Masuk", customer: "Rina" }, { brandName: "Servisin", tenantSlug: "servisin", website: "servisin.test" }, null);

    expect(fromList.service.trackingCode).toBe("A3BD9F2C4B");
    expect(renderJetHtml(fromList)).toContain("A3BD9F2C4B");
  });

  it("tidak mengarang alamat halaman tanpa website tenant", () => {
    const noSite = toPrintData(
      { id: "svc-1", tracking_code: "a3bd9f2c4b", device: "iPhone 13", status: "Masuk", customer: "Rina", date: "2026-09-18" },
      { brandName: "Servisin", tenantSlug: "servisin", website: null },
      null,
    );

    for (const html of [renderJetHtml(noSite), renderDotMatrixHtml(noSite), renderThermalHtml(noSite)]) {
      expect(html).toContain("A3BD9F2C4B");
      expect(html).not.toContain("Cek status");
    }
  });

  it("mengambil kode dari data servis dan menormalkan huruf besar", () => {
    const data = toPrintData(
      { id: "svc-1", tracking_code: "a3bd9f2c4b", device: "iPhone 13", status: "Masuk", customer: "Rina", date: "2026-09-18" },
      { brandName: "Servisin", tenantSlug: "servisin" },
      null,
    );

    expect(data.service.trackingCode).toBe("A3BD9F2C4B");
    expect(data.service.tenantSlug).toBe("servisin");
  });

  it("tidak mengarang kode saat data servis tidak punya", () => {
    const data = toPrintData({ id: "svc-1", device: "iPhone 13", status: "Masuk", customer: "Rina" }, { brandName: "Servisin" }, null);

    expect(data.service.trackingCode).toBeUndefined();
  });
});

describe("nomor struk memakai nomor servis", () => {
  // Nomor struk dulu `s?.invoice_no || formatInvoiceNo(createdAt)`. Kolom
  // invoice_no tidak pernah ada di tabel servis, jadi formatInvoiceNo selalu
  // dipakai: mencetak struk dua kali menghasilkan nomor BERBEDA untuk servis
  // yang sama, padahal nomor itu yang dibawa pelanggan ke kasir.
  it("mengambil service_number sebagai nomor struk", () => {
    const data = toPrintData(
      { id: "s1", service_number: "SRV-2026-0001", created_at: "2026-09-26T03:30:00.000Z" },
      { brandName: "Servisin" },
    );
    expect(data.invoiceNo).toBe("SRV-2026-0001");
  });

  it("menerima juga bentuk camelCase dari baris daftar", () => {
    const data = toPrintData(
      { id: "s1", serviceNumber: "SRV-2026-0007", created_at: "2026-09-26T03:30:00.000Z" },
      { brandName: "Servisin" },
    );
    expect(data.invoiceNo).toBe("SRV-2026-0007");
  });

  it("stabil saat struk yang sama dicetak berulang", () => {
    const service = { id: "s1", service_number: "SRV-2026-0002", created_at: "2026-09-26T03:30:00.000Z" };
    const first = toPrintData(service, { brandName: "Servisin" });
    const second = toPrintData(service, { brandName: "Servisin" });
    expect(first.invoiceNo).toBe(second.invoiceNo);
  });

  it("tidak mengarang nomor INV- dari timestamp", () => {
    const data = toPrintData(
      { id: "s1", service_number: "SRV-2026-0003", created_at: "2026-09-26T03:30:00.000Z" },
      { brandName: "Servisin" },
    );
    expect(data.invoiceNo).not.toMatch(/^INV-/);
    for (const render of [renderJetHtml, renderDotMatrixHtml, renderThermalHtml]) {
      expect(render(data)).not.toMatch(/INV-\d{8}/);
    }
  });

  it("menampilkan placeholder, bukan nomor karangan, saat nomor servis tidak ada", () => {
    const data = toPrintData({ id: "s1", created_at: "2026-09-26T03:30:00.000Z" }, { brandName: "Servisin" });
    expect(data.invoiceNo).toBe("\u2014");
    for (const render of [renderJetHtml, renderDotMatrixHtml, renderThermalHtml]) {
      expect(render(data)).not.toMatch(/INV-\d{8}/);
    }
  });
});