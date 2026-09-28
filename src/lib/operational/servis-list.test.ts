import { describe, expect, it } from "vitest";
import { mapServisListRows, servisLabel } from "./servis-list";

describe("servisLabel", () => {
  // Bug yang dilaporkan: kolom "Servis" di tabel menampilkan UUID mentah
  // ("211bd56f-0845-48f5-...") padahal kolom service_number sudah terisi.
  it("shows the service number, never the raw uuid", () => {
    const label = servisLabel({
      id: "211bd56f-0845-48f5-a4f4-51a5247a6402",
      serviceNumber: "SRV-2026-0001",
    });
    expect(label).toBe("SRV-2026-0001");
    expect(label).not.toContain("211bd56f");
    // UUID punya 4 blok dipisah tanda hubung; nomor servis punya format
    // sendiri, jadi yang dicek adalah tidak adanya sisa UUID.
    expect(label).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  it("falls back to a short id for rows without a service number", () => {
    const label = servisLabel({ id: "211bd56f-0845-48f5-a4f4-51a5247a6402" });
    expect(label).toBe("211BD56F");
    // Tetap pendek supaya kolom tidak melebar, tapi tidak menampilkan UUID
    // penuh yang tidak berguna.
    expect(label.length).toBe(8);
  });

  it("treats an empty or null service number as absent", () => {
    for (const serviceNumber of [null, undefined, ""]) {
      expect(servisLabel({ id: "abcdef12-3456-7890-abcd-ef1234567890", serviceNumber })).toBe("ABCDEF12");
    }
  });

  it("prefers a real service number over the id even when both exist", () => {
    expect(
      servisLabel({ id: "211bd56f-0845-48f5-a4f4-51a5247a6402", serviceNumber: "SRV-2026-0042" }),
    ).toBe("SRV-2026-0042");
  });
});

describe("mapServisListRows", () => {
  it("maps real service, customer, technician, and payment data", () => {
    const [row] = mapServisListRows({
      services: [{
        id: "service-1",
        service_number: "SRV-2026-0001",
        tracking_code: "a3bd9f2c4b",
        device: "iPhone 14 Pro",
        complaint: "Mati total",
        status: "Dikerjakan",
        price: 350000,
        customer_id: "customer-1",
        teknisi_id: "profile-1",
        created_at: "2026-09-25T08:00:00.000Z",
      }],
      customers: [{ id: "customer-1", name: "Rina", phone: "0812" }],
      profiles: [{ id: "profile-1", full_name: "Rudi" }],
      finance: [{ servis_id: "service-1", amount: 100000 }],
    });

    expect(row).toMatchObject({
      id: "service-1",
      serviceNumber: "SRV-2026-0001",
      trackingCode: "A3BD9F2C4B",
      customer: "Rina · 0812",
      teknisi: "Rudi",
      status: "Dikerjakan",
      price: 350000,
      paidAmount: 100000,
      payment: "DP",
    });
  });

  it("does not invent a paid amount when finance data is absent", () => {
    const [row] = mapServisListRows({
      services: [{
        id: "service-2",
        service_number: null,
        tracking_code: null,
        device: "Samsung A54",
        complaint: null,
        status: "Masuk",
        price: 0,
        customer_id: null,
        teknisi_id: null,
        created_at: "2026-09-25T08:00:00.000Z",
      }],
      customers: [],
      profiles: [],
      finance: [],
    });

    expect(row).toMatchObject({
      customer: "Tanpa nama · —",
      teknisi: "—",
      price: 0,
      paidAmount: 0,
      payment: "Belum dibayar",
    });
  });
});
