import { describe, expect, it } from "vitest";
import { buildLaporanServis, type ServisReportInput } from "./laporan-servis";

const NOW = new Date(2026, 8, 23, 15, 30, 0);

// Fixtures use local calendar parts so the assertions hold in any timezone.
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).toISOString();

function svc(overrides: Partial<ServisReportInput> = {}): ServisReportInput {
  return {
    id: "svc-1",
    service_number: "SRV-2026-0001",
    created_at: at(23, 9),
    branch_id: "b1",
    teknisi_id: "t1",
    status: "Selesai",
    price: 100_000,
    device: "iPhone 13",
    ...overrides,
  };
}

const branches = [{ id: "b1", name: "Pusat" }];
const technicians = [{ id: "t1", full_name: "Rudi" }];

describe("buildLaporanServis", () => {
  it("returns honest zeroes when nothing was serviced", () => {
    const result = buildLaporanServis({ services: [], branches, technicians, now: NOW });

    expect(result.harian).toEqual([]);
    expect(result.bulanan).toEqual([]);
    expect(result.services).toEqual([]);
    expect(result.summary).toEqual({ total: 0, selesai: 0, batal: 0, pending: 0, net: 0 });
  });

  it("groups by local calendar day", () => {
    const result = buildLaporanServis({
      services: [
        svc({ id: "a", created_at: at(23, 9) }),
        svc({ id: "b", created_at: at(22, 14) }),
        svc({ id: "c", created_at: at(23, 16) }),
      ],
      branches,
      technicians,
      now: NOW,
    });

    expect(result.harian.map((row) => row.key)).toEqual(["2026-09-23", "2026-09-22"]);
    expect(result.harian[0].total).toBe(2);
  });

  it("does not shift a late-evening service into the next day", () => {
    const result = buildLaporanServis({
      services: [svc({ id: "late", created_at: at(23, 23, 30) })],
      branches,
      technicians,
      now: NOW,
    });

    expect(result.harian[0].key).toBe("2026-09-23");
  });

  it("groups by month", () => {
    const result = buildLaporanServis({
      services: [
        svc({ id: "a", created_at: at(23, 9) }),
        svc({ id: "b", created_at: new Date(2026, 7, 4, 9).toISOString() }),
      ],
      branches,
      technicians,
      now: NOW,
    });

    expect(result.bulanan.map((row) => row.key)).toEqual(["2026-09", "2026-08"]);
  });

  it("counts Selesai and Sudah Diambil as selesai", () => {
    const result = buildLaporanServis({
      services: [
        svc({ id: "a", status: "Selesai" }),
        svc({ id: "b", status: "Sudah Diambil" }),
      ],
      branches,
      technicians,
      now: NOW,
    });

    expect(result.harian[0].selesai).toBe(2);
    expect(result.harian[0].pending).toBe(0);
  });

  it("counts Batal separately from pending", () => {
    const result = buildLaporanServis({
      services: [
        svc({ id: "a", status: "Batal" }),
        svc({ id: "b", status: "Masuk" }),
        svc({ id: "c", status: "Dikerjakan" }),
      ],
      branches,
      technicians,
      now: NOW,
    });

    expect(result.harian[0].batal).toBe(1);
    expect(result.harian[0].pending).toBe(2);
    expect(result.harian[0].selesai).toBe(0);
  });

  it("sums price into net, treating a missing price as zero", () => {
    const result = buildLaporanServis({
      services: [
        svc({ id: "a", price: 250_000 }),
        svc({ id: "b", price: 0 }),
      ],
      branches,
      technicians,
      now: NOW,
    });

    expect(result.harian[0].net).toBe(250_000);
    expect(result.summary.net).toBe(250_000);
  });

  it("sorts periods newest first", () => {
    const result = buildLaporanServis({
      services: [
        svc({ id: "old", created_at: new Date(2026, 0, 5, 9).toISOString() }),
        svc({ id: "new", created_at: at(23, 9) }),
      ],
      branches,
      technicians,
      now: NOW,
    });

    expect(result.harian[0].key).toBe("2026-09-23");
    expect(result.harian[1].key).toBe("2026-01-05");
  });

  it("labels the technician and branch on each detail row", () => {
    const result = buildLaporanServis({ services: [svc()], branches, technicians, now: NOW });

    expect(result.services[0]).toMatchObject({
      teknisi: "Rudi",
      branchName: "Pusat",
      serviceLabel: "SRV-2026-0001",
    });
  });

  it("labels an unknown technician or branch instead of dropping the service", () => {
    const result = buildLaporanServis({
      services: [svc({ teknisi_id: "ghost", branch_id: "ghost-branch" })],
      branches,
      technicians,
      now: NOW,
    });

    expect(result.services[0]).toMatchObject({ teknisi: "Tanpa teknisi", branchName: "—" });
  });

  it("falls back to a short id when a service has no number yet", () => {
    const result = buildLaporanServis({
      services: [svc({ service_number: null, id: "abcdef12-3456" })],
      branches,
      technicians,
      now: NOW,
    });

    expect(result.services[0].serviceLabel).toBe("ABCDEF12");
  });

  it("keeps the detail rows attached to their day for the print view", () => {
    const result = buildLaporanServis({
      services: [svc({ id: "a", created_at: at(23, 9) }), svc({ id: "b", created_at: at(22, 9) })],
      branches,
      technicians,
      now: NOW,
    });

    expect(result.harian[0].services.map((s) => s.id)).toEqual(["a"]);
    expect(result.harian[1].services.map((s) => s.id)).toEqual(["b"]);
  });
});
