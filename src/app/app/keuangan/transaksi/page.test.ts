import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("guard halaman Transaksi", () => {
  it("memakai kunci rute yang sama dengan sidebar, bukan kapabilitas finance.write", () => {
    const source = read("src/app/app/keuangan/transaksi/page.tsx");
    expect(source).toContain('requireMenu("/app/keuangan/transaksi")');
    expect(source).not.toContain('requireMenu("keuangan_transaksi")');
  });
});
