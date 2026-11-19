import { describe, expect, it } from "vitest";
import { toRekapRow } from "./rekap";
import { ATTENDANCE_STATUS_LABEL } from "@/lib/attendance/status";

describe("toRekapRow", () => {
  const base = {
    id: "r1", attendance_date: "2026-11-19", employee_id: "emp-1",
    branch_id: "b1", check_in_at: "2026-11-19T01:01:00.000Z",
    check_out_at: "2026-11-19T10:00:00.000Z",
    check_in_selfie_path: "attendance/org/emp/2026-11-19-in-abc.jpg",
    check_in_lat: -6.1, check_in_lng: 106.7,
    check_out_lat: -6.2, check_out_lng: 106.8, note: "macet",
    full_name: "Budi", branch_name: "Cabang A",
    check_in_time: "08:00", check_out_time: "17:00",
  };

  it("menghitung status dan menyiapkan label tampilan", () => {
    const row = toRekapRow(base);
    expect(row.status).toBe("TERLAMBAT");
    expect(row.statusLabel).toBe(ATTENDANCE_STATUS_LABEL.TERLAMBAT);
    expect(row.nama).toBe("Budi");
    expect(row.tanggal).toBe("2026-11-19");
  });

  it("memakai koordinat check-in saat belum ada check-out", () => {
    const row = toRekapRow({
      ...base,
      check_out_at: null,
      check_in_lat: -7.0048325,
      check_in_lng: 110.42973325,
      check_out_lat: null,
      check_out_lng: null,
    });
    expect(row.lokasi).toBe("-7.0048325, 110.42973325");
  });
});
