import { describe, expect, it } from "vitest";
import { buildPerformaTeknisi, type BranchIntensif, type ServiceForTech, type TechnicianInput } from "./performa-teknisi";

function tech(overrides: Partial<TechnicianInput> = {}): TechnicianInput {
  return { profile_id: "t1", full_name: "Rudi", branch_id: "b1", branch_name: "Pusat", ...overrides };
}

function svc(overrides: Partial<ServiceForTech> = {}): ServiceForTech {
  return { teknisi_id: "t1", status: "Selesai", price: 200_000, ...overrides };
}

const ON: BranchIntensif = { is_intensif_enabled: true, intensif_mode: "percent", intensif_value: 5, intensif_target_count: 10 };
const OFF: BranchIntensif = { is_intensif_enabled: false, intensif_mode: "percent", intensif_value: 5, intensif_target_count: null };

describe("buildPerformaTeknisi", () => {
  it("returns an empty list when there are no technicians", () => {
    const result = buildPerformaTeknisi({ technicians: [], services: [], branchIntensif: {}, now: new Date(2026, 8, 23) });

    expect(result.rows).toEqual([]);
    expect(result.summary).toEqual({ technicians: 0, selesai: 0, revenue: 0, insentif: 0 });
  });

  it("counts Selesai and Sudah Diambil as selesai", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ status: "Selesai" }), svc({ status: "Sudah Diambil" }), svc({ status: "Masuk" }), svc({ status: "Batal" })],
      branchIntensif: { b1: OFF },
      now: new Date(2026, 8, 23),
    });

    expect(result.rows[0]).toMatchObject({ selesai: 2, pending: 1, batal: 1, total: 4 });
  });

  it("sums revenue from finished services only", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [
        svc({ status: "Selesai", price: 200_000 }),
        svc({ status: "Sudah Diambil", price: 300_000 }),
        svc({ status: "Masuk", price: 999_000 }),
        svc({ status: "Batal", price: 888_000 }),
      ],
      branchIntensif: { b1: OFF },
      now: new Date(2026, 8, 23),
    });

    expect(result.rows[0].revenue).toBe(500_000);
  });

  it("never reports a rating, because nothing in the database records one", () => {
    const result = buildPerformaTeknisi({ technicians: [tech()], services: [svc()], branchIntensif: { b1: OFF }, now: new Date(2026, 8, 23) });

    expect(result.rows[0].rating).toBeNull();
  });

  it("pays no insentif when the branch has it switched off", () => {
    const result = buildPerformaTeknisi({ technicians: [tech()], services: [svc()], branchIntensif: { b1: OFF }, now: new Date(2026, 8, 23) });

    expect(result.rows[0].insentif).toBe(0);
  });

  it("calculates fixed insentif as finished services times the flat amount", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc(), svc(), svc()],
      branchIntensif: { b1: { ...ON, intensif_mode: "fixed", intensif_value: 50_000 } },
      now: new Date(2026, 8, 23),
    });

    expect(result.rows[0].insentif).toBe(150_000);
  });

  it("calculates percent insentif from the real revenue, not an assumed average price", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ price: 200_000 }), svc({ price: 300_000 })],
      branchIntensif: { b1: { ...ON, intensif_mode: "percent", intensif_value: 10 } },
      now: new Date(2026, 8, 23),
    });

    // 10% of 500.000
    expect(result.rows[0].insentif).toBe(50_000);
  });

  it("pays nothing when there is no finished revenue in percent mode", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ status: "Masuk", price: 400_000 })],
      branchIntensif: { b1: { ...ON, intensif_mode: "percent", intensif_value: 10 } },
      now: new Date(2026, 8, 23),
    });

    expect(result.rows[0].insentif).toBe(0);
  });

  it("exposes the branch target for the progress bar", () => {
    const result = buildPerformaTeknisi({ technicians: [tech()], services: [svc()], branchIntensif: { b1: ON }, now: new Date(2026, 8, 23) });

    expect(result.rows[0].intensifTarget).toBe(10);
  });

  it("caps target progress at 100 percent", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: Array.from({ length: 25 }, () => svc()),
      branchIntensif: { b1: ON },
      now: new Date(2026, 8, 23),
    });

    expect(result.rows[0].targetPct).toBe(100);
  });

  it("gives zero target progress when no target is set", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc()],
      branchIntensif: { b1: { ...ON, intensif_target_count: null } },
      now: new Date(2026, 8, 23),
    });

    expect(result.rows[0].targetPct).toBe(0);
  });

  it("ignores services assigned to another technician", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ teknisi_id: "other", price: 999_000 })],
      branchIntensif: { b1: OFF },
      now: new Date(2026, 8, 23),
    });

    expect(result.rows[0].total).toBe(0);
  });

  it("treats a technician with no name as unassigned rather than dropping the row", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech({ full_name: null })],
      services: [],
      branchIntensif: { b1: OFF },
      now: new Date(2026, 8, 23),
    });

    expect(result.rows[0].name).toBe("Tanpa nama");
  });

  it("labels an unknown branch and pays no insentif", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech({ branch_id: "ghost", branch_name: null })],
      services: [svc()],
      branchIntensif: {},
      now: new Date(2026, 8, 23),
    });

    expect(result.rows[0].branchName).toBe("—");
    expect(result.rows[0].intensifEnabled).toBe(false);
    expect(result.rows[0].insentif).toBe(0);
  });

  it("sorts by finished services, then by revenue", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech({ profile_id: "t1", full_name: "A" }), tech({ profile_id: "t2", full_name: "B" })],
      services: [svc({ teknisi_id: "t1" }), svc({ teknisi_id: "t2" }), svc({ teknisi_id: "t2" })],
      branchIntensif: { b1: OFF },
      now: new Date(2026, 8, 23),
    });

    expect(result.rows.map((row) => row.name)).toEqual(["B", "A"]);
  });

  it("sums the overall totals", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech({ profile_id: "t1" }), tech({ profile_id: "t2" })],
      services: [svc({ teknisi_id: "t1", price: 100_000 }), svc({ teknisi_id: "t2", price: 200_000 })],
      branchIntensif: { b1: { ...ON, intensif_mode: "fixed", intensif_value: 1_000 } },
      now: new Date(2026, 8, 23),
    });

    expect(result.summary).toEqual({ technicians: 2, selesai: 2, revenue: 300_000, insentif: 2_000 });
  });
});
