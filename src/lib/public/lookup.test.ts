import { describe, expect, it } from "vitest";
import {
  coerceStage,
  FORBIDDEN_PUBLIC_COLUMNS,
  formatTrackingCode,
  normalizeTrackingCode,
  PUBLIC_SERVICE_SELECT,
} from "./lookup";

describe("public tracking code", () => {
  it("accepts the printed form and tolerates how customers type it", () => {
    expect(normalizeTrackingCode("A3BD9F2C4B")).toBe("A3BD9F2C4B");
    expect(normalizeTrackingCode("a3bd9-f2c4b")).toBe("A3BD9F2C4B");
    expect(normalizeTrackingCode("A3BD 9F2C 4B")).toBe("A3BD9F2C4B");
    expect(normalizeTrackingCode("  A3BD9F2C4B  ")).toBe("A3BD9F2C4B");
  });

  it("rejects anything that is not a ten character hex code", () => {
    expect(normalizeTrackingCode("")).toBeNull();
    expect(normalizeTrackingCode("A3BD9F2C4")).toBeNull();
    expect(normalizeTrackingCode("A3BD9F2C4BB")).toBeNull();
    expect(normalizeTrackingCode("G3BD9F2C4B")).toBeNull();
    expect(normalizeTrackingCode("SRV-2026-0001")).toBeNull();
    expect(normalizeTrackingCode("'; drop table cervise_services; --")).toBeNull();
    expect(normalizeTrackingCode(42)).toBeNull();
    expect(normalizeTrackingCode(null)).toBeNull();
  });

  it("formats the code for humans without losing the raw value", () => {
    expect(formatTrackingCode("A3BD9F2C4B")).toBe("A3BD9-F2C4B");
    expect(formatTrackingCode("a3bd9-f2c4b")).toBe("A3BD9-F2C4B");
    expect(formatTrackingCode(null)).toBe("—");
    expect(formatTrackingCode("bogus")).toBe("—");
  });
});

describe("public lookup allowlist", () => {
  // Kolom yang benar-benar dibaca, setelah embed PostgREST (mis. "profiles!fk(full_name)")
  // dibuang. Ini yang diuji, bukan string mentahnya.
  function selectedColumns(select: string) {
    return select
      .replace(/\([^)]*\)/g, "")
      .split(",")
      .map((part) => part.trim().replace(/!.*$/, ""))
      .filter(Boolean);
  }

  it("selects only the columns the customer is allowed to see", () => {
    expect(PUBLIC_SERVICE_SELECT).toContain("device");
    expect(PUBLIC_SERVICE_SELECT).toContain("status");
    expect(PUBLIC_SERVICE_SELECT).toContain("garansi_until");
    expect(PUBLIC_SERVICE_SELECT).toContain("branches!inner(id, name)");
    expect(PUBLIC_SERVICE_SELECT).toContain("profiles!teknisi_id(full_name)");
  });

  it("never selects a sensitive column", () => {
    const columns = selectedColumns(PUBLIC_SERVICE_SELECT);
    for (const column of FORBIDDEN_PUBLIC_COLUMNS) {
      expect(columns).not.toContain(column);
    }
    // Kolom yang boleh: hanya field tampilan + kunci lookup server-side.
    expect(columns.sort()).toEqual(
      ["branches", "created_at", "device", "garansi_unit", "garansi_until", "garansi_value", "id", "profiles", "service_number", "status", "tracking_code"].sort(),
    );
  });
});

describe("stage coercion", () => {
  it("keeps the eight database labels and falls back safely", () => {
    expect(coerceStage("Dikerjakan")).toBe("Dikerjakan");
    expect(coerceStage("Menunggu Sparepart")).toBe("Menunggu Sparepart");
    expect(coerceStage("Batal")).toBe("Batal");
    expect(coerceStage("in_repair")).toBe("Masuk");
    expect(coerceStage(null)).toBe("Masuk");
    expect(coerceStage(undefined)).toBe("Masuk");
  });
});
