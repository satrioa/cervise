import { describe, expect, it } from "vitest";
import {
  buildCustomerCreatedMessage,
  buildCustomerStatusMessage,
  buildTechnicianCreatedMessage,
  publicLacakUrl,
  type ServiceMessageInput,
} from "./service-message";

const base: ServiceMessageInput = {
  storeName: "Servisin",
  tenantSlug: "servisin",
  serviceId: "3f1c2b44-0000-4000-8000-000000000001",
  serviceNumber: "SRV-2026-0012",
  device: "Xiaomi Redmi 13C",
  complaint: "Layar pecah, Baterai drop",
  trackingCode: "F5FB0DFCB6",
  status: "Masuk",
  siteOrigin: "https://app.cervise.id",
};

describe("publicLacakUrl", () => {
  it("menyusun tautan halaman lacak tanpa garis miring ganda", () => {
    expect(publicLacakUrl("https://app.cervise.id", "servisin", "F5FB0DFCB6")).toBe(
      "https://app.cervise.id/servisin/lacak/F5FB0DFCB6",
    );
  });

  it("mengembalikan string kosong kalau ada bagian yang tidak ada", () => {
    expect(publicLacakUrl("https://app.cervise.id", "servisin", null)).toBe("");
    expect(publicLacakUrl("https://app.cervise.id", null, "F5FB0DFCB6")).toBe("");
  });
});

describe("pesan ke customer", () => {
  it("menyebutkan nama toko, nomor servis, dan kode cek", () => {
    const message = buildCustomerCreatedMessage(base);
    expect(message).toContain("Servisin");
    expect(message).toContain("SRV-2026-0012");
    expect(message).toContain("Xiaomi Redmi 13C");
    expect(message).toContain("F5FB0DFCB6");
    expect(message).toContain("https://app.cervise.id/servisin/lacak/F5FB0DFCB6");
  });

  it("menyebutkan status baru saat status berubah", () => {
    const message = buildCustomerStatusMessage({ ...base, status: "Selesai" });
    expect(message).toContain("Selesai");
    expect(message).toContain("F5FB0DFCB6");
  });

  it("tidak pernah merender undefined atau kosong", () => {
    const sparse: ServiceMessageInput = {
      ...base,
      serviceNumber: null,
      complaint: null,
      trackingCode: null,
    };
    for (const message of [
      buildCustomerCreatedMessage(sparse),
      buildCustomerStatusMessage(sparse),
      buildTechnicianCreatedMessage(sparse),
    ]) {
      expect(message).not.toContain("undefined");
      expect(message).not.toContain("null");
      expect(message).not.toContain("NaN");
    }
  });
});

describe("pesan ke teknisi", () => {
  it("menyebutkan nomor servis dan tautan internal", () => {
    const message = buildTechnicianCreatedMessage(base);
    expect(message).toContain("Servisin");
    expect(message).toContain("SRV-2026-0012");
    expect(message).toContain("Layar pecah, Baterai drop");
    expect(message).toContain("https://app.cervise.id/app/servis/3f1c2b44-0000-4000-8000-000000000001");
  });
});
