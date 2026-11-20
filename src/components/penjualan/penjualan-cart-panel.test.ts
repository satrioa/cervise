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

  it("pill dock tanpa gesture hapus", () => {
    expect(expander).not.toMatch(/onPointerDown|onPointerUp/);
    expect(expander).not.toMatch(/translateX\(-96px\)/);
    expect(expander).not.toContain("aria-label=\"Kosongkan keranjang\"");
    expect(source).not.toContain("SwipeActionsRow");
  });
});
