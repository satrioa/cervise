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

  it("pill dock bisa digeser kiri untuk membuka tombol Hapus", () => {
    expect(expander).toMatch(/onPointerDown=\{onPointerDown\}/);
    expect(expander).toMatch(/onPointerUp=\{onPointerUp\}/);
    expect(expander).toMatch(/setRevealed\(dx < 0\)/);
    expect(expander).toMatch(/translateX\(-96px\)/);
    expect(expander).toMatch(/aria-label="Kosongkan keranjang"/);
  });

  it("tidak ada swipe pada baris item keranjang", () => {
    expect(source).not.toContain("SwipeActionsRow");
  });
});
