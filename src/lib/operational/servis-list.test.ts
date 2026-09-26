import { describe, expect, it } from "vitest";
import { mapServisListRows } from "./servis-list";

describe("mapServisListRows", () => {
  it("maps real service, customer, technician, and payment data", () => {
    const [row] = mapServisListRows({
      services: [{
        id: "service-1",
        service_number: "SRV-2026-0001",
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
