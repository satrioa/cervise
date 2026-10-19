import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  "supabase/migrations/20261018130000_return_sale_items_atomic.sql",
  "utf8",
);

function fnBody(): string {
  const start = SQL.indexOf("as $$");
  const end = SQL.indexOf("$$;", start);
  expect(start, "badan fungsi harus ada").toBeGreaterThan(0);
  return SQL.slice(start, end);
}

/**
 * `returnSaleItems` punya pola yang sama dengan `createSale` sebelum
 * create_sale_atomic, tapi lebih berbahaya. Urutannya per item:
 *
 *   1. rpc adjust_product_stock(+qty)   <- stok sudah balik
 *   2. update cervise_sales_items       <- baru dicatat
 *
 * Kalau langkah 2 gagal, stok sudah kembali ke gudang tanpa tercatat sebagai
 * retur. Kasir bisa mengulang retur item yang sama sebanyak yang mau dan
 * setiap percobaan menambah stok nyata - itu bukan bug pembukuan, itu
 *-Learning sumber stok.
 *
 * Ditambah `qty_returned` dibaca lalu ditulis tanpa lock, jadi dua permintaan
 * retur yang berjalan bersamaan bisa dua-duanya membaca 0, dua-duanya
 * mengembalikan stok, dan dua-duanya menulis 1.
 */
describe("return_sale_items_atomic mengunci retur dalam satu transaksi", () => {
  it("hanya menulis lewat fungsi - server action tidak boleh update sendiri", () => {
    const action = readFileSync("src/app/app/penjualan/actions.ts", "utf8");
    const fn = action.slice(
      action.indexOf("export async function returnSaleItems"),
    );

    expect(fn).toMatch(
      /supabase\.rpc\(\s*\n?\s*"return_sale_items_atomic"/,
    );
    expect(fn).not.toMatch(
      /from\("cervise_sales_items"\)\s*\n?\s*\.update\(/,
    );
    expect(fn).not.toMatch(/from\("cervise_sales"\)\s*\n?\s*\.update\(/);
    // Dan tidak lagi memanggil adjust_product_stock langsung dari sini.
    expect(fn).not.toContain('rpc("adjust_product_stock"');
  });

  it("mengunci baris penjualan dan item dengan for update", () => {
    const body = fnBody();
    // Tanpa lock, dua retur bersamaan bisa membaca qty_returned yang sama.
    expect(body).toContain("for update");
    // Penjualannya dikunci dulu, lalu tiap item.
    expect(body.match(/for update/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("memeriksa sisa retur dari baris yang sudah terkunci, bukan dari pemanggil", () => {
    const body = fnBody();
    // Hitungan harus diambil di dalam transaksi, setelah lock.
    expect(body).toMatch(/available\s*:=\s*v_item\.qty\s*-\s*v_item\.qty_returned/);
    expect(body).toContain(
      "if v_qty is null or v_qty <= 0 or v_qty > v_available then",
    );
  });

  it("menandai penjualan retur hanya dalam transaksi yang sama", () => {
    const body = fnBody();
    expect(body).toContain("update public.cervise_sales");
    expect(body).toContain("status = 'retur'");
    // Penentuan "sudah retur" ikut di dalam fungsi, bukan hanya dibaca di JS.
    expect(body).toMatch(/status\s*=\s*'retur'[\s\S]{0,200}raise exception/);
  });

  it("tidak memakai exception handler yang bisa menelan rollback", () => {
    expect(fnBody()).not.toMatch(/\bexception\s+when\b/i);
  });

  it("hanya mengizinkan role kasir", () => {
    const body = fnBody();
    expect(body).toContain("public.has_tenant_branch_role(");
    const roles = body.match(/array\[([^\]]*)\]/)?.[1] ?? "";
    expect(roles).toContain("FRONTLINER");
    expect(roles).not.toContain("TECHNICIAN");
  });

  it("hanya boleh dipanggil authenticated, bukan anon", () => {
    expect(SQL).toContain("revoke all on function public.return_sale_items_atomic(");
    expect(SQL).toContain("to authenticated");
    expect(SQL).toContain("from anon");
    expect(SQL).toContain("security definer");
    expect(SQL).toContain("set search_path = public");
  });

  it("mengembalikan jumlah item, bukan penanda parsial", () => {
    // Fungsi tidak pernah mengembalikan penanda sukses parsial. Kalau salah satu
    // item tidak valid, ia melempar dan seluruh transaksi batal.
    expect(fnBody()).toMatch(/return v_count;\s*end;\s*$/);
  });
});