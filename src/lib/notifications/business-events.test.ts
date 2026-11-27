import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("event notifikasi bisnis", () => {
  it("mencakup semua event katalog", () => {
    const files = [
      "src/app/app/servis/actions.ts",
      "src/app/app/penjualan/actions.ts",
      "src/app/app/sparepart/central-actions.ts",
      "src/app/app/actions/cash.ts",
    ]
      .map(read)
      .join("\n");
    const events = [
      "pembayaran_servis",
      "pembayaran_penjualan",
      "request_stok_sparepart",
      "buka_toko",
      "tutup_toko",
    ];
    for (const event of events) expect(files).toContain(`event: "${event}"`);
  });

  it("mencakup stok alert dan sparepart habis", () => {
    const files = [
      "src/app/app/sparepart/actions.ts",
      "src/app/app/inventori/actions.ts",
    ]
      .map(read)
      .join("\n");
    expect(files).toContain('event: "stok_alert"');
    expect(files).toContain('event: "sparepart_habis"');
  });
});
