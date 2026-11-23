import { describe, expect, it } from "vitest";
import { incidentServices, parseIncidentUpdates, revenueSeries, waSeries, waTotals } from "./dashboard-widgets";

const now = new Date("2026-11-20T12:00:00.000Z");

describe("revenueSeries", () => {
  it("menjumlahkan invoice approved per tanggal dan tipe", () => {
    const series = revenueSeries(
      [
        { status: "approved", amount: 100, period_start: "2026-11-20", invoice_type: "renewal" },
        { status: "approved", amount: 50, period_start: "2026-11-20", invoice_type: "upgrade" },
        { status: "pending", amount: 999, period_start: "2026-11-20", invoice_type: "initial" },
      ],
      3,
      now,
    );
    expect(series.at(-1)?.parts).toEqual([100, 0, 50]);
  });
});

describe("waSeries & waTotals", () => {
  const rows = [
    { created_at: "2026-11-20T01:00:00Z", to_kind: "customer", state: "sent" },
    { created_at: "2026-11-20T02:00:00Z", to_kind: "technician", state: "sent" },
    { created_at: "2026-11-20T03:00:00Z", to_kind: "customer", state: "failed" },
  ];

  it("menghitung pesan terkirim per peran", () => {
    expect(waSeries(rows, 3, now).at(-1)?.parts).toEqual([1, 1]);
  });

  it("menghitung total status", () => {
    expect(waTotals(rows)).toEqual({ sent: 2, failed: 1, skipped: 0 });
  });
});

describe("parseIncidentUpdates", () => {
  it("memecah baris HH:MM|Label|Catatan", () => {
    expect(parseIncidentUpdates("10:00|Investigating|Sinkron\n10:10|Resolved")).toEqual([
      { time: "10:00", label: "Investigating", note: "Sinkron" },
      { time: "10:10", label: "Resolved" },
    ]);
  });

  it("menolak format jam salah", () => {
    expect(parseIncidentUpdates("1000|Investigating")).toBeNull();
  });
});

describe("incidentServices", () => {
  it("memetakan insiden ke hari dan layanan", () => {
    const services = incidentServices(
      [
        {
          occurred_on: "2026-11-20",
          service: "WhatsApp",
          status: "degraded",
          minutes: 12,
          title: "WABA lambat",
          updates: [{ time: "10:00", label: "Investigating" }],
        },
      ],
      3,
      now,
    );
    expect(services.find((s) => s.name === "WhatsApp")?.incidents?.[2]?.title).toBe("WABA lambat");
    expect(Object.keys(services.find((s) => s.name === "API")?.incidents ?? {})).toHaveLength(0);
  });
});
