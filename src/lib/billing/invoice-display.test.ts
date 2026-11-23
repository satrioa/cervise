import { describe, expect, it } from "vitest";
import { displayInvoiceStatus, licenseType } from "./invoice-display";

const now = new Date("2026-11-20T00:00:00.000Z");

describe("displayInvoiceStatus", () => {
  it("approved tetap lunas", () => {
    expect(displayInvoiceStatus({ status: "approved" }, now).label).toBe("Lunas");
  });

  it("pending lewat jatuh tempo jadi Terlewat", () => {
    expect(displayInvoiceStatus({ status: "pending", due_date: "2026-11-01" }, now).label).toBe("Terlewat");
  });

  it("pending belum jatuh tempo tetap Menunggu", () => {
    expect(displayInvoiceStatus({ status: "pending", due_date: "2026-11-30" }, now).label).toBe("Menunggu");
  });

  it("voided dan rejected dibedakan", () => {
    expect(displayInvoiceStatus({ status: "voided" }, now).label).toBe("Dibatalkan");
    expect(displayInvoiceStatus({ status: "rejected" }, now).label).toBe("Ditolak");
  });
});

describe("licenseType", () => {
  it("trial bukan lisensi permanen", () => {
    expect(licenseType("trial")).toBe("Lisensi trial");
    expect(licenseType("pro")).toBe("Lisensi permanen · hosting tahunan");
  });
});
