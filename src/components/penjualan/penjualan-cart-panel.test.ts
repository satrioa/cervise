import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/penjualan/penjualan-cart-panel.tsx"),
  "utf8",
);

const expander = source.slice(source.indexOf("export function PenjualanCartExpander"));

describe("dock keranjang penjualan", () => {
  it("menyembunyikan dock compact saat dock keranjang muncul", () => {
    expect(expander).toContain("data-hide-dock");
  });

  it("baris keranjang bisa swipe kiri untuk membuka tombol Hapus", () => {
    expect(source).toContain("<SwipeActionsRow");
    expect(source).toMatch(/label: "Hapus"/);
    expect(source).toMatch(/tone: "danger"/);
    expect(source).toMatch(/fullSwipe=\{false\}/);
  });
});
