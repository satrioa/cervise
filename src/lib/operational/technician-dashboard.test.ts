import { describe, expect, it } from "vitest";
import {
  DEFAULT_ATTENTION_THRESHOLDS,
  attentionReasonLabel,
  buildAttentionQueue,
  buildTechnicianKpi,
  bucketDueLabel,
  type BranchIntensif,
  type TechnicianServiceInput,
} from "./technician-dashboard";

const NOW = new Date("2026-09-28T12:00:00Z");
const TEKNISI = "tech-1";
const LAIN = "tech-2";

function service(overrides: Partial<TechnicianServiceInput> = {}): TechnicianServiceInput {
  return {
    id: "s1",
    service_number: "SRV-001",
    created_at: "2026-09-28T08:00:00Z",
    updated_at: "2026-09-28T08:00:00Z",
    branch_id: "b1",
    teknisi_id: TEKNISI,
    status: "Masuk",
    price: 100_000,
    device: "iPhone 11",
    ...overrides,
  };
}

/** `hours` jam sebelum NOW. */
function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

describe("buildAttentionQueue", () => {
  it("Masuk 23h59m belum masuk antrean", () => {
    const queue = buildAttentionQueue(
      [service({ status: "Masuk", updated_at: hoursAgo(23.98) })],
      TEKNISI,
      NOW,
    );
    expect(queue).toEqual([]);
  });

  it("Masuk 24h01m masuk dengan prioritas tinggi", () => {
    const queue = buildAttentionQueue(
      [service({ status: "Masuk", updated_at: hoursAgo(24.02) })],
      TEKNISI,
      NOW,
    );
    expect(queue).toHaveLength(1);
    expect(queue[0].priority).toBe("tinggi");
    expect(queue[0].reason).toBe("belum-ditangani");
    expect(queue[0].hoursWaiting).toBe(24);
  });

  it("Dikerjakan 47h belum masuk, 48h01m masuk", () => {
    expect(
      buildAttentionQueue(
        [service({ status: "Dikerjakan", updated_at: hoursAgo(47.9) })],
        TEKNISI,
        NOW,
      ),
    ).toEqual([]);

    const queue = buildAttentionQueue(
      [service({ status: "Dikerjakan", updated_at: hoursAgo(48.1) })],
      TEKNISI,
      NOW,
    );
    expect(queue).toHaveLength(1);
    expect(queue[0].reason).toBe("menggantung-di-pengerjaan");
  });

  it("Selesai 24h01m masuk dengan prioritas sedang", () => {
    const queue = buildAttentionQueue(
      [service({ status: "Selesai", updated_at: hoursAgo(24.5) })],
      TEKNISI,
      NOW,
    );
    expect(queue[0].priority).toBe("sedang");
    expect(queue[0].reason).toBe("sudah-selesai-belum-diambil");
  });

  it("status yang menunggu keputusan manusia tidak masuk antrean", () => {
    for (const status of ["Diagnosa", "Menunggu Konfirmasi", "Menunggu Sparepart"]) {
      const queue = buildAttentionQueue(
        [service({ status, updated_at: hoursAgo(200) })],
        TEKNISI,
        NOW,
      );
      expect(queue, status).toEqual([]);
    }
  });

  it("Sudah Diambil dan Batal tidak masuk antrean meski sangat lama", () => {
    for (const status of ["Sudah Diambil", "Batal"]) {
      const queue = buildAttentionQueue(
        [service({ status, updated_at: hoursAgo(999) })],
        TEKNISI,
        NOW,
      );
      expect(queue, status).toEqual([]);
    }
  });

  it("servis teknisi lain tidak masuk", () => {
    const queue = buildAttentionQueue(
      [service({ teknisi_id: LAIN, updated_at: hoursAgo(100) })],
      TEKNISI,
      NOW,
    );
    expect(queue).toEqual([]);
  });

  it("mengurutkan prioritas dulu, lalu yang paling lama menunggu", () => {
    const queue = buildAttentionQueue(
      [
        service({ id: "a", status: "Selesai", updated_at: hoursAgo(30) }),
        service({ id: "b", status: "Masuk", updated_at: hoursAgo(25) }),
        service({ id: "c", status: "Masuk", updated_at: hoursAgo(90) }),
        service({ id: "d", status: "Selesai", updated_at: hoursAgo(50) }),
      ],
      TEKNISI,
      NOW,
    );
    expect(queue.map((item) => item.id)).toEqual(["c", "b", "d", "a"]);
  });

  it("menghormati ambang khusus", () => {
    const custom = { untouchedHours: 2, inProgressHours: 4, readyHours: 6 };
    const queue = buildAttentionQueue(
      [service({ status: "Masuk", updated_at: hoursAgo(3) })],
      TEKNISI,
      NOW,
      custom,
    );
    expect(queue).toHaveLength(1);
  });

  it("technisi tanpa assignment menghasilkan antrean kosong", () => {
    expect(buildAttentionQueue([service()], null, NOW)).toEqual([]);
  });

  it("format label menunggu dalam jam dan hari", () => {
    const make = (hours: number) =>
      buildAttentionQueue(
        [service({ status: "Masuk", updated_at: hoursAgo(hours) })],
        TEKNISI,
        NOW,
      )[0]?.waitingLabel;
    expect(make(24)).toBe("1h");
    expect(make(27)).toBe("1h 3j");
    expect(make(48)).toBe("2h");
  });

  it("setiap reason punya label Bahasa Indonesia", () => {
    expect(attentionReasonLabel("belum-ditangani")).toBe("Belum ditangani");
    expect(attentionReasonLabel("menggantung-di-pengerjaan")).toBe("Menggantung di pengerjaan");
    expect(attentionReasonLabel("sudah-selesai-belum-diambil")).toBe("Selesai, belum diambil");
  });

  it("ambang default sesuai spesifikasi", () => {
    expect(DEFAULT_ATTENTION_THRESHOLDS).toEqual({
      untouchedHours: 24,
      inProgressHours: 48,
      readyHours: 24,
    });
  });
});

describe("buildTechnicianKpi", () => {
  const aktif: BranchIntensif = {
    is_intensif_enabled: true,
    intensif_mode: "percent",
    intensif_value: 5,
    intensify_target_count: 10,
  };

  it("menghitung persentase terhadap target", () => {
    const services = Array.from({ length: 3 }, (_, i) =>
      service({ id: `d${i}`, status: "Selesai" }),
    );
    const kpi = buildTechnicianKpi(services, TEKNISI, aktif, NOW);
    expect(kpi).toEqual({ target: 10, selesai: 3, targetPct: 30, unset: false });
  });

  it("membatasi persentase maksimal 100", () => {
    const services = Array.from({ length: 25 }, (_, i) =>
      service({ id: `d${i}`, status: "Selesai" }),
    );
    expect(buildTechnicianKpi(services, TEKNISI, aktif, NOW).targetPct).toBe(100);
  });

  it("insentif nonaktif berarti target belum diatur", () => {
    const kpi = buildTechnicianKpi([], TEKNISI, { ...aktif, is_intensif_enabled: false }, NOW);
    expect(kpi.unset).toBe(true);
    expect(kpi.targetPct).toBeNull();
  });

  it("target null, nol, atau negatif berarti belum diatur", () => {
    for (const target of [null, 0, -5]) {
      const kpi = buildTechnicianKpi([], TEKNISI, { ...aktif, intensify_target_count: target }, NOW);
      expect(kpi.unset, String(target)).toBe(true);
      expect(kpi.targetPct, String(target)).toBeNull();
    }
  });

  it("tanpa baris setting cabang, kartu menampilkan empty state", () => {
    expect(buildTechnicianKpi([], TEKNISI, null, NOW)).toEqual({
      target: null,
      selesai: 0,
      targetPct: null,
      unset: true,
    });
  });

  it("hanya menghitung Selesai dan Sudah Diambil", () => {
    const services = [
      service({ id: "a", status: "Selesai" }),
      service({ id: "b", status: "Sudah Diambil" }),
      service({ id: "c", status: "Batal" }),
      service({ id: "d", status: "Dikerjakan" }),
    ];
    expect(buildTechnicianKpi(services, TEKNISI, aktif, NOW).selesai).toBe(2);
  });

  it("hanya menghitung servis bulan berjalan", () => {
    const services = [
      service({ id: "a", status: "Selesai", created_at: "2026-09-10T08:00:00Z" }),
      service({ id: "b", status: "Selesai", created_at: "2026-08-10T08:00:00Z" }),
      service({ id: "c", status: "Selesai", created_at: "2025-09-10T08:00:00Z" }),
    ];
    expect(buildTechnicianKpi(services, TEKNISI, aktif, NOW).selesai).toBe(1);
  });

  it("mengabaikan servis teknisi lain", () => {
    const services = [service({ teknisi_id: LAIN, status: "Selesai" })];
    expect(buildTechnicianKpi(services, TEKNISI, aktif, NOW).selesai).toBe(0);
  });
});

describe("bucketDueLabel", () => {
  it("tidak ada tenggat berarti null", () => {
    expect(bucketDueLabel(null, NOW)).toBeNull();
  });

  it("hari ini, besok, dan lewat", () => {
    expect(bucketDueLabel("2026-09-28T18:00:00Z", NOW)).toBe("Hari ini");
    expect(bucketDueLabel("2026-09-29T08:00:00Z", NOW)).toBe("Besok");
    expect(bucketDueLabel("2026-09-27T08:00:00Z", NOW)).toBe("Lewat");
  });

  it("tenggat masa depan jauh menjadi tanggal kalender", () => {
    expect(bucketDueLabel("2026-10-15T08:00:00Z", NOW)).toBe("2026-10-15");
  });

  it("tenggat yang sudah lewat berapa pun tetap 'Lewat', bukan tanggal", () => {
    // Tidak ada gunanya menampilkan "2026-01-01" untuk tugas yang sudah lewat
    // berbulan-bulan; "Lewat" lebih bisa ditindaklanjuti.
    expect(bucketDueLabel("2026-01-01T08:00:00Z", NOW)).toBe("Lewat");
    expect(bucketDueLabel("2025-09-28T08:00:00Z", NOW)).toBe("Lewat");
  });

  it("tanggal rusak tidak membuat crash", () => {
    expect(bucketDueLabel("bukan-tanggal", NOW)).toBeNull();
  });
});
