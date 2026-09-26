import { describe, expect, it } from "vitest";
import { toPrintData, renderJetHtml, renderDotMatrixHtml, renderThermalHtml } from "./print-templates";

/**
 * Nilai yang pernah dipalsukan oleh toPrintData. Receipt adalah dokumen
 * formal: data fiktif di sini menghasilkan struk palsu yang dicetak untuk
 * pelanggan nyata, jadi setiap placeholder harus hilang permanen.
 */
const FABRICATIONS = [
  "FARHAN",
  "0896****2404",
  "IPHONE",
  "SIMTRAY",
  "REPAIR KAMERA BELAKANG",
  "Teknisitasik1",
  "Kasservice",
  "KasserviceKlaten",
  "Mayor Kusmanto",
  "rbm-borneo",
  "Payment Cash",
  "SV-1001",
  "200000",
  "2026-09-30",
];

const RENDERERS = [renderJetHtml, renderDotMatrixHtml, renderThermalHtml];

describe("toPrintData", () => {
  it("never invents data for a service record with no fields", () => {
    const data = toPrintData({}, { brandName: "Servisin" });

    expect(data.customer.name).toBe("\u2014");
    expect(data.customer.phone).toBe("\u2014");
    expect(data.service.price).toBeNull();
    expect(data.service.status).toBe("\u2014");
    expect(data.teknisi).toBe("\u2014");
    expect(data.admin).toBe("\u2014");
    expect(data.service.kelengkapan).toEqual([]);
    expect(data.service.kerusakan).toEqual([]);
    expect(data.service.garansiSampai).toBe("\u2014");
    expect(data.branch.address).toBeNull();
    expect(data.branch.phone).toBeNull();
    expect(data.branch.website).toBeNull();

    for (const render of RENDERERS) {
      const html = render(data);
      for (const fabrication of FABRICATIONS) {
        expect(html).not.toContain(fabrication);
      }
      // An empty record must never render "undefined".
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("NaN");
    }
  });

  it("uses the organization brand as the store name, not the branch name", () => {
    const data = toPrintData({}, { brandName: "Servisin", branchName: "Cabang Pusat" });

    expect(data.branch.name).toBe("Servisin");
    for (const render of RENDERERS) {
      expect(render(data)).toContain("Servisin");
    }
  });

  it("keeps a placeholder store name when the brand and branch are both missing", () => {
    const data = toPrintData({}, { brandName: null, branchName: null });

    expect(data.branch.name).toBe("\u2014");
    expect(data.branch.name).not.toBe("");
  });

  it("omits the 'Semua cabang' sentinel as a store name", () => {
    const data = toPrintData({}, { brandName: "Servisin", branchName: null });

    expect(data.branch.name).not.toContain("Semua");
  });

  it("carries real customer, device, and price data through unchanged", () => {
    const data = toPrintData(
      {
        id: "service-1",
        invoice_no: "INV-20260926-0001",
        created_at: "2026-09-26T03:30:00.000Z",
        merk: "Samsung",
        tipe: "Galaxy S23",
        price: 450000,
        status: "Selesai",
        customer: "Budi \u00b7 08123456789",
        teknisi: { full_name: "Andi" },
        creator: { full_name: "Sari" },
        kerusakan: ["Layar pecah"],
        kelengkapan: ["Charger"],
        garansi_until: "2026-12-26T00:00:00.000Z",
      },
      { brandName: "Servisin" },
    );

    expect(data.service.id).toBe("service-1");
    expect(data.invoiceNo).toBe("INV-20260926-0001");
    expect(data.service.device).toBe("Samsung Galaxy S23");
    expect(data.service.price).toBe(450000);
    expect(data.customer.name).toBe("BUDI");
    expect(data.teknisi).toBe("Andi");
    expect(data.admin).toBe("Sari");
    expect(data.service.kerusakan).toEqual(["Layar pecah"]);
  });

  it("does not invent a warranty date when the record has none", () => {
    const data = toPrintData({ id: "x", created_at: "2026-09-26T00:00:00.000Z" }, { brandName: "Servisin" });

    expect(data.service.garansiSampai).toBe("\u2014");
    for (const render of RENDERERS) {
      expect(render(data)).not.toContain("2026-09-30");
    }
  });

  it("keeps the branch phone but omits address and website that do not exist", () => {
    const data = toPrintData({}, { brandName: "Servisin", phone: "0812998877" });

    expect(data.branch.phone).toBe("0812998877");
    for (const render of RENDERERS) {
      const html = render(data);
      if (html.includes("0812998877")) {
        expect(html).toContain("Servisin");
      }
      // "·" only appears when joining two present contact values.
      expect(html.includes("\u00b7\n")).toBe(false);
    }
  });
});
