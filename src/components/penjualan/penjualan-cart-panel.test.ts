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

describe("pencarian customer POS", () => {
  it("teks kosong hanya muncul saat hasil benar-benar kosong", () => {
    expect(source).toContain('results.length === 0');
    expect(source).toContain('Tidak ada yang cocok dengan "${query.trim()}" — isi nama dan nomor HP');
    expect(source).toContain('Daftarkan sebagai customer baru');
  });

  it("hasil lama tidak menimpa hasil pencarian terbaru", () => {
    expect(source).toContain("const seq = ++seqRef.current;");
    expect(source).toContain("if (seq === seqRef.current) setResults(found);");
  });
});
