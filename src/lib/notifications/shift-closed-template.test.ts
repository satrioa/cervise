import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildShiftClosedParameters } from "./service-message";
import { getWaTemplate } from "./wa-templates";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const EXPECTED = [
  "tenant", "cabang", "tanggal", "user_buka", "jam_buka", "user_tutup", "jam_tutup",
  "saldo_awal", "servis", "penjualan", "kas_manual", "kas_diharapkan", "saldo_akhir", "selisih",
];

describe("template WA tutup shift", () => {
  it("mengirim 14 parameter bernama sesuai template shift_tutup_detail_v1", () => {
    const params = buildShiftClosedParameters({
      tenant: "Ekaservice", cabang: "Pusat", userOpen: "Dewi", userClose: "Linda",
      dateOpen: "21 Nov 2026 08:00", shiftOpenTime: "08:12", shiftCloseTime: "17:50",
      date: "21-11-2026", saldoAwal: 25000, saldoAkhir: 50000,
      servis: 500000, penjualan: 375000, kasManual: 25000, kasDiharapkan: 50000, selisih: 0,
    } as never);
    expect(params.map((p) => (p as { parameter_name: string }).parameter_name).sort()).toEqual([...EXPECTED].sort());
  });

  it("registry memakai bahasa Indonesia", () => {
    expect(getWaTemplate("shift_closed").language).toBe("id");
  });

  it("env contoh menunjuk template detail yang approved", () => {
    expect(read(".env.example")).toContain("META_WA_TEMPLATE_SHIFT_CLOSE=shift_tutup_detail_v1");
    expect(read(".env.example")).not.toContain("META_WA_TEMPLATE_SHIFT_CLOSE=shift_close_v1");
  });

  it("tanggal WA dikirim DD-MM-YYYY", () => {
    const source = read("src/app/app/actions/cash.ts");
    expect(source).toContain("date: toWaCalendarDate(");
    expect(source).toContain("return `${day}-${month}-${year}`");
  });
});
