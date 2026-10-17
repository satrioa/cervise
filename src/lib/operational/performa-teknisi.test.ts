import { describe, expect, it } from "vitest";
import { buildPerformaTeknisi, type BranchIntensif, type ServiceForTech, type TechnicianInput } from "./performa-teknisi";

const SEPT_2026 = new Date("2026-09-23T03:00:00Z");
const DALAM_BULAN = "2026-09-15T04:00:00Z";
const BULAN_LALU = "2026-08-15T04:00:00Z";
const BULAN_DEPAN = "2026-10-01T01:00:00Z";

function tech(overrides: Partial<TechnicianInput> = {}): TechnicianInput {
  return { profile_id: "t1", full_name: "Rudi", branch_id: "b1", branch_name: "Pusat", ...overrides };
}

function svc(overrides: Partial<ServiceForTech> = {}): ServiceForTech {
  return { teknisi_id: "t1", status: "Selesai", price: 200_000, completed_at: DALAM_BULAN, ...overrides };
}

// Cabang percent tidak punya target: field itu khusus mode flat.
const ON: BranchIntensif = { is_intensif_enabled: true, intensif_mode: "percent", intensif_value: 5, intensif_target_count: null };
const OFF: BranchIntensif = { is_intensif_enabled: false, intensif_mode: "percent", intensif_value: 5, intensif_target_count: null };
const FLAT: BranchIntensif = { is_intensif_enabled: true, intensif_mode: "flat", intensif_value: 300_000, intensif_target_count: 3 };

describe("buildPerformaTeknisi", () => {
  it("returns an empty list when there are no technicians", () => {
    const result = buildPerformaTeknisi({ technicians: [], services: [], branchIntensif: {}, now: SEPT_2026 });

    expect(result.rows).toEqual([]);
    expect(result.summary).toEqual({ technicians: 0, selesai: 0, revenue: 0, insentif: 0, selesaiTanpaTanggal: 0 });
  });

  it("counts Selesai and Sudah Diambil as selesai", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ status: "Selesai" }), svc({ status: "Sudah Diambil" }), svc({ status: "Masuk" }), svc({ status: "Batal" })],
      branchIntensif: { b1: OFF },
      now: SEPT_2026,
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
      now: SEPT_2026,
    });

    expect(result.rows[0].revenue).toBe(500_000);
  });

  it("never reports a rating, because nothing in the database records one", () => {
    const result = buildPerformaTeknisi({ technicians: [tech()], services: [svc()], branchIntensif: { b1: OFF }, now: SEPT_2026 });

    expect(result.rows[0].rating).toBeNull();
  });

  it("pays no insentif when the branch has it switched off", () => {
    const result = buildPerformaTeknisi({ technicians: [tech()], services: [svc()], branchIntensif: { b1: OFF }, now: SEPT_2026 });

    expect(result.rows[0].insentif).toBe(0);
  });

  it("calculates fixed insentif as finished services times the flat amount", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc(), svc(), svc()],
      branchIntensif: { b1: { ...ON, intensif_mode: "fixed", intensif_value: 50_000 } },
      now: SEPT_2026,
    });

    expect(result.rows[0].insentif).toBe(150_000);
  });

  it("calculates percent insentif from the real revenue, not an assumed average price", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ price: 200_000 }), svc({ price: 300_000 })],
      branchIntensif: { b1: { ...ON, intensif_mode: "percent", intensif_value: 10 } },
      now: SEPT_2026,
    });

    // 10% of 500.000
    expect(result.rows[0].insentif).toBe(50_000);
  });

  it("pays nothing when there is no finished revenue in percent mode", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ status: "Masuk", price: 400_000 })],
      branchIntensif: { b1: { ...ON, intensif_mode: "percent", intensif_value: 10 } },
      now: SEPT_2026,
    });

    expect(result.rows[0].insentif).toBe(0);
  });

  it("exposes the branch target for the progress bar", () => {
    const result = buildPerformaTeknisi({ technicians: [tech()], services: [svc()], branchIntensif: { b1: FLAT }, now: SEPT_2026 });

    expect(result.rows[0].intensifTarget).toBe(3);
  });

  it("ignores a leftover target on a non-flat branch", () => {
    // Data lama bisa masih punya target di mode percent. Memakainya akan
    // menampilkan progress bar untuk cabang yang tidak punya gate target.
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc()],
      branchIntensif: { b1: { ...ON, intensif_target_count: 10 } },
      now: SEPT_2026,
    });

    expect(result.rows[0].intensifTarget).toBeNull();
    expect(result.rows[0].targetPct).toBe(0);
  });

  it("caps target progress at 100 percent", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: Array.from({ length: 25 }, () => svc()),
      branchIntensif: { b1: FLAT },
      now: SEPT_2026,
    });

    expect(result.rows[0].targetPct).toBe(100);
  });

  it("gives zero target progress when no target is set", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc()],
      branchIntensif: { b1: { ...FLAT, intensif_target_count: null } },
      now: SEPT_2026,
    });

    expect(result.rows[0].targetPct).toBe(0);
  });

  it("ignores services assigned to another technician", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ teknisi_id: "other", price: 999_000 })],
      branchIntensif: { b1: OFF },
      now: SEPT_2026,
    });

    expect(result.rows[0].total).toBe(0);
  });

  it("treats a technician with no name as unassigned rather than dropping the row", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech({ full_name: null })],
      services: [],
      branchIntensif: { b1: OFF },
      now: SEPT_2026,
    });

    expect(result.rows[0].name).toBe("Tanpa nama");
  });

  it("labels an unknown branch and pays no insentif", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech({ branch_id: "ghost", branch_name: null })],
      services: [svc()],
      branchIntensif: {},
      now: SEPT_2026,
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
      now: SEPT_2026,
    });

    expect(result.rows.map((row) => row.name)).toEqual(["B", "A"]);
  });

  it("sums the overall totals", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech({ profile_id: "t1" }), tech({ profile_id: "t2" })],
      services: [svc({ teknisi_id: "t1", price: 100_000 }), svc({ teknisi_id: "t2", price: 200_000 })],
      branchIntensif: { b1: { ...ON, intensif_mode: "fixed", intensif_value: 1_000 } },
      now: SEPT_2026,
    });

    expect(result.summary).toEqual({ technicians: 2, selesai: 2, revenue: 300_000, insentif: 2_000, selesaiTanpaTanggal: 0 });
  });
});

describe("buildPerformaTeknisi mode flat", () => {
  it("membayar nilai penuh saat jumlah selesai menyentuh target", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc(), svc(), svc()],
      branchIntensif: { b1: FLAT },
      now: SEPT_2026,
    });

    expect(result.rows[0].insentif).toBe(300_000);
  });

  it("tidak membayar apa pun saat jumlah selesai di bawah target", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc(), svc()],
      branchIntensif: { b1: FLAT },
      now: SEPT_2026,
    });

    expect(result.rows[0].insentif).toBe(0);
  });

  it("tidak membayar apa pun saat target belum diisi", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc(), svc(), svc(), svc()],
      branchIntensif: { b1: { ...FLAT, intensif_target_count: null } },
      now: SEPT_2026,
    });

    expect(result.rows[0].insentif).toBe(0);
  });

  it("tidak membayar lebih dari nilai flat meski selesai jauh melampaui target", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: Array.from({ length: 9 }, () => svc()),
      branchIntensif: { b1: FLAT },
      now: SEPT_2026,
    });

    expect(result.rows[0].insentif).toBe(300_000);
  });

  it("menampilkan mode flat apa adanya pada baris laporan", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc(), svc(), svc()],
      branchIntensif: { b1: FLAT },
      now: SEPT_2026,
    });

    expect(result.rows[0]).toMatchObject({ intensifMode: "flat", intensifValue: 300_000, intensifTarget: 3, targetPct: 100 });
  });

  it("menolak mode yang tidak dikenal dan kembali ke persentase", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ price: 200_000 })],
      branchIntensif: { b1: { ...FLAT, intensif_mode: "ngawur", intensif_value: 10 } },
      now: SEPT_2026,
    });

    expect(result.rows[0]).toMatchObject({ intensifMode: "percent", insentif: 20_000 });
  });
});

describe("buildPerformaTeknisi periode", () => {
  it("mengabaikan servis selesai sebelum bulan berjalan", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ completed_at: BULAN_LALU })],
      branchIntensif: { b1: ON },
      now: SEPT_2026,
    });

    expect(result.rows[0]).toMatchObject({ selesai: 0, revenue: 0, total: 0 });
  });

  it("mengabaikan servis selesai di awal bulan depan", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ completed_at: BULAN_DEPAN })],
      branchIntensif: { b1: ON },
      now: SEPT_2026,
    });

    expect(result.rows[0].selesai).toBe(0);
  });

  it("menjumlahkan pendapatan hanya dari servis dalam periode", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ price: 100_000, completed_at: DALAM_BULAN }), svc({ price: 900_000, completed_at: BULAN_LALU })],
      branchIntensif: { b1: ON },
      now: SEPT_2026,
    });

    expect(result.rows[0].revenue).toBe(100_000);
  });

  it("menghitung target hanya dari servis bulan berjalan", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc(), svc(), svc(), svc({ completed_at: BULAN_LALU })],
      branchIntensif: { b1: FLAT },
      now: SEPT_2026,
    });

    expect(result.rows[0]).toMatchObject({ selesai: 3, insentif: 300_000 });
  });
});

describe("buildPerformaTeknisi servis tanpa tanggal selesai", () => {
  it("tidak menghitungnya sebagai selesai maupun pendapatan", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ completed_at: null, price: 500_000 })],
      branchIntensif: { b1: ON },
      now: SEPT_2026,
    });

    expect(result.rows[0]).toMatchObject({ selesai: 0, revenue: 0, selesaiTanpaTanggal: 1 });
  });

  it("tidak membayarkan mode flat dari servis yang tidak punya tanggal", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ completed_at: null }), svc({ completed_at: null }), svc({ completed_at: null })],
      branchIntensif: { b1: FLAT },
      now: SEPT_2026,
    });

    expect(result.rows[0]).toMatchObject({ selesai: 0, selesaiTanpaTanggal: 3, insentif: 0 });
  });

  it("merangkum jumlah servis tanpa tanggal pada ringkasan", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ completed_at: null }), svc()],
      branchIntensif: { b1: OFF },
      now: SEPT_2026,
    });

    expect(result.summary.selesaiTanpaTanggal).toBe(1);
  });

  it("tidak menghitung servis tanpa teknisi ke penanda mana pun", () => {
    const result = buildPerformaTeknisi({
      technicians: [tech()],
      services: [svc({ teknisi_id: null, completed_at: null })],
      branchIntensif: { b1: OFF },
      now: SEPT_2026,
    });

    expect(result.rows[0].selesaiTanpaTanggal).toBe(0);
  });

  it("menjumlahkan nol bila tidak ada servis yang bermasalah", () => {
    const result = buildPerformaTeknisi({ technicians: [], services: [], branchIntensif: {}, now: SEPT_2026 });

    expect(result.summary.selesaiTanpaTanggal).toBe(0);
  });
});
