import { describe, expect, it } from "vitest";
import { garansiMeta } from "./garansi-meta";

const DAY = 86400000;
const inDays = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

describe("garansiMeta", () => {
  it("reports belum_aktif when there is no expiry date", () => {
    const meta = garansiMeta({ garansiUntil: null, garansiValue: 30, garansiUnit: "hari" });

    expect(meta.state).toBe("belum_aktif");
    expect(meta.pct).toBe(0);
    expect(meta.daysLeft).toBeNull();
    expect(meta.total).toBe(30);
  });

  it("counts down while the warranty is healthy", () => {
    const meta = garansiMeta({ garansiUntil: inDays(20), garansiValue: 30, garansiUnit: "hari" });

    expect(meta.state).toBe("aktif");
    expect(meta.daysLeft).toBeGreaterThan(0);
    expect(meta.pct).toBeGreaterThan(0);
  });

  it("escalates to warning then segera_habis as the deadline approaches", () => {
    expect(garansiMeta({ garansiUntil: inDays(10), garansiValue: 30, garansiUnit: "hari" }).state).toBe("warning");
    expect(garansiMeta({ garansiUntil: inDays(3), garansiValue: 30, garansiUnit: "hari" }).state).toBe("segera_habis");
  });

  it("treats a past date as expired with zero progress", () => {
    // Batasnya akhir hari (23:59:59.999), jadi kemaren masih "segera habis";
    // baru dua hari lalu yang dianggap kedaluwarsa.
    expect(garansiMeta({ garansiUntil: inDays(-1), garansiValue: 30, garansiUnit: "hari" }).state).toBe("segera_habis");

    const meta = garansiMeta({ garansiUntil: inDays(-2), garansiValue: 30, garansiUnit: "hari" });
    expect(meta.state).toBe("expired");
    expect(meta.pct).toBe(0);
    expect(meta.daysLeft).toBeLessThan(0);
  });

  it("converts months and years using the shared day table", () => {
    expect(garansiMeta({ garansiUntil: null, garansiValue: 3, garansiUnit: "bulan" }).total).toBe(90);
    expect(garansiMeta({ garansiUntil: null, garansiValue: 1, garansiUnit: "tahun" }).total).toBe(365);
  });

  it("falls back to a ninety day window when the stored term is unusable", () => {
    expect(garansiMeta({ garansiUntil: inDays(5), garansiValue: 0, garansiUnit: "hari" }).total).toBe(90);
  });
});
