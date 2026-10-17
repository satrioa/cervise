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
  const dibuat = overrides.created_at ?? "2026-09-28T08:00:00Z";
  return {
    id: "s1",
    service_number: "SRV-001",
    created_at: dibuat,
    updated_at: dibuat,
    // Default-nya waktu selesai ikut waktu dibuat, supaya test yang hanya
    // bermaksud "servis selesai bulan ini" tidak perlu menyebutkannya.
    completed_at: "completed_at" in overrides ? (overrides.completed_at ?? null) : dibuat,
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

describe("KPI harian di kartu bento", () => {
  const aktif: BranchIntensif = {
    is_intensif_enabled: true,
    // `flat`, bukan `percent`: target adalah syarat pembayaran mode flat, jadi
    // kombinasi percent+target tidak akan pernah tersimpan lagi.
    intensif_mode: "flat",
    intensif_value: 300_000,
    intensif_target_count: 10,
  };

  it("masuk hari ini = status Masuk yang dibuat hari ini", () => {
    const services = [
      service({ id: "a", status: "Masuk", created_at: hoursAgo(2) }),
      service({ id: "b", status: "Masuk", created_at: hoursAgo(1) }),
      // Dibuat kemarin: bukan hari ini meski masih berstatus Masuk.
      service({ id: "c", status: "Masuk", created_at: hoursAgo(30) }),
      service({ id: "d", status: "Dikerjakan", created_at: hoursAgo(1) }),
    ];
    expect(buildTechnicianKpi(services, TEKNISI, aktif, NOW).masukHariIni).toBe(2);
  });

  it("selesai hari ini memakai completed_at, bukan updated_at", () => {
    // `set_service_status` tidak menyentuh `updated_at`, jadi updated_at tidak
    // pernah menandai waktu selesai. completed_at satu-satunya sumber yang benar.
    const services = [
      service({ id: "a", status: "Selesai", created_at: hoursAgo(200), updated_at: hoursAgo(200), completed_at: hoursAgo(3) }),
      service({ id: "b", status: "Sudah Diambil", created_at: hoursAgo(200), updated_at: hoursAgo(200), completed_at: hoursAgo(1) }),
      // updated_at hari ini tapi selesai minggu lalu: bukan hari ini.
      service({ id: "d", status: "Selesai", created_at: hoursAgo(400), updated_at: hoursAgo(1), completed_at: hoursAgo(20) }),
    ];
    expect(buildTechnicianKpi(services, TEKNISI, aktif, NOW).selesaiHariIni).toBe(2);
  });

  it("servis selesai tanpa completed_at tidak dihitung sebagai selesai hari ini", () => {
    const services = [
      service({ id: "a", status: "Selesai", updated_at: hoursAgo(1), completed_at: null }),
    ];
    expect(buildTechnicianKpi(services, TEKNISI, aktif, NOW).selesaiHariIni).toBe(0);
  });

  it("masuk hari ini tetap memakai created_at, bukan completed_at", () => {
    const services = [
      service({ id: "a", status: "Masuk", created_at: hoursAgo(2), completed_at: null }),
      service({ id: "b", status: "Masuk", created_at: hoursAgo(1), completed_at: null }),
      service({ id: "c", status: "Masuk", created_at: hoursAgo(30), completed_at: null }),
    ];
    expect(buildTechnicianKpi(services, TEKNISI, aktif, NOW).masukHariIni).toBe(2);
  });

  it("mengabaikan servis teknisi lain", () => {
    const services = [
      service({ id: "a", status: "Masuk", teknisi_id: LAIN, created_at: hoursAgo(1) }),
      service({ id: "b", status: "Selesai", teknisi_id: LAIN, updated_at: hoursAgo(1) }),
    ];
    const kpi = buildTechnicianKpi(services, TEKNISI, aktif, NOW);
    expect(kpi.masukHariIni).toBe(0);
    expect(kpi.selesaiHariIni).toBe(0);
  });

  it("harian tetap nol saat teknisi tidak punya assignment", () => {
    const kpi = buildTechnicianKpi(
      [service({ id: "a", status: "Masuk", created_at: hoursAgo(1) })],
      null,
      aktif,
      NOW,
    );
    expect(kpi.masukHariIni).toBe(0);
    expect(kpi.selesaiHariIni).toBe(0);
  });

  it("tidak terpengaruh tanggal rusak", () => {
    const services = [
      service({ id: "a", status: "Masuk", created_at: "bukan-tanggal" }),
      service({ id: "b", status: "Selesai", completed_at: "" }),
    ];
    const kpi = buildTechnicianKpi(services, TEKNISI, aktif, NOW);
    expect(kpi.masukHariIni).toBe(0);
    expect(kpi.selesaiHariIni).toBe(0);
  });
});

describe("buildTechnicianKpi", () => {
  const aktif: BranchIntensif = {
    is_intensif_enabled: true,
    // `flat`, bukan `percent`: target adalah syarat pembayaran mode flat, jadi
    // kombinasi percent+target tidak akan pernah tersimpan lagi.
    intensif_mode: "flat",
    intensif_value: 300_000,
    intensif_target_count: 10,
  };

  it("menghitung persentase terhadap target", () => {
    const services = Array.from({ length: 3 }, (_, i) =>
      service({ id: `d${i}`, status: "Selesai" }),
    );
    const kpi = buildTechnicianKpi(services, TEKNISI, aktif, NOW);
    // `toMatchObject`, bukan `toEqual`: kartu harian ditambahkan terpisah dan
    // test ini hanya soal target bulanan.
    expect(kpi).toMatchObject({ target: 10, selesai: 3, targetPct: 30, unset: false });
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
      const kpi = buildTechnicianKpi([], TEKNISI, { ...aktif, intensif_target_count: target }, NOW);
      expect(kpi.unset, String(target)).toBe(true);
      expect(kpi.targetPct, String(target)).toBeNull();
    }
  });

  it("target hanya berlaku di mode flat", () => {
    // Sisa target di mode percent/fixed harus diabaikan, bukan dipakai sebagai
    // KPI. Kalau tidak, progres bar akan berjalan untuk cabang yang sistemnya
    // memang tidak memakai gate target sama sekali.
    for (const mode of ["percent", "fixed"] as const) {
      const kpi = buildTechnicianKpi([], TEKNISI, { ...aktif, intensif_mode: mode }, NOW);
      expect(kpi.applicable, mode).toBe(false);
      expect(kpi.target, mode).toBeNull();
      expect(kpi.targetPct, mode).toBeNull();
    }
  });

  it("mode flat menandai target sebagai applicable", () => {
    expect(buildTechnicianKpi([], TEKNISI, aktif, NOW).applicable).toBe(true);
  });

  it("tanpa baris setting cabang, kartu menampilkan empty state", () => {
    expect(buildTechnicianKpi([], TEKNISI, null, NOW)).toMatchObject({
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

  it("hanya menghitung servis bulan berjalan menurut waktu selesai", () => {
    const services = [
      service({ id: "a", status: "Selesai", created_at: "2026-09-10T08:00:00Z", completed_at: "2026-09-10T08:00:00Z" }),
      service({ id: "b", status: "Selesai", created_at: "2026-09-09T08:00:00Z", completed_at: "2026-08-10T08:00:00Z" }),
      service({ id: "c", status: "Selesai", created_at: "2026-09-11T08:00:00Z", completed_at: "2025-09-10T08:00:00Z" }),
      // Dibuat bulan ini tapi selesai bulan depan: belum masuk hitungan.
      service({ id: "d", status: "Selesai", created_at: "2026-09-12T08:00:00Z", completed_at: "2026-10-01T08:00:00Z" }),
    ];
    expect(buildTechnicianKpi(services, TEKNISI, aktif, NOW).selesai).toBe(1);
  });

  it("menghitung batas bulan menurut waktu Indonesia, bukan UTC", () => {
    // 2026-09-30T19:00Z = 1 Oktober 02:00 WIB. Kalau dihitung pakai UTC,
    // servis ini masuk September dan teknisi dapat target lebih awal.
    const services = [
      service({ id: "a", status: "Selesai", completed_at: "2026-09-30T19:00:00Z" }),
      // 2026-09-30T15:00Z = 30 September 22:00 WIB: masih September.
      service({ id: "b", status: "Selesai", completed_at: "2026-09-30T15:00:00Z" }),
    ];
    expect(buildTechnicianKpi(services, TEKNISI, aktif, NOW).selesai).toBe(1);
  });

  it("servis selesai tanpa completed_at tidak masuk hitungan bulanan", () => {
    const services = [
      service({ id: "a", status: "Selesai", completed_at: null }),
      service({ id: "b", status: "Selesai", completed_at: "2026-09-10T08:00:00Z" }),
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
