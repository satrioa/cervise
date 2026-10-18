import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  "supabase/migrations/20261018120000_create_sale_atomic.sql",
  "utf8",
);

function fnBody(): string {
  const start = SQL.indexOf("as $$");
  const end = SQL.indexOf("$$;", start);
  expect(start, "badan fungsi harus ada").toBeGreaterThan(0);
  return SQL.slice(start, end);
}

/**
 * Test end-to-end menemukan `createSale` menulis ke lima tabel lewat lima
 * panggilan terpisah. Kalau satu gagal, penjualan tertinggal setengah jadi -
 * kasus terburuk: barang keluar dan invoice terbit tapi uang masuk tidak pernah
 * tercatat di kas, jadi laporan penjualan dan laporan kas tidak pernah
 * balance.
 *
 * Fungsi plpgsql menutup ini: satu fungsi = satu transaksi, jadi satu kegagalan
 * membatalkan semuanya. Test di bawah mengunci hal-hal yang membuat transaksi
 * itu benar, supaya refactor berikutnya tidak melonggarkannya tanpa terlihat.
 */
describe("create_sale_atomic menulis semua penjualan dalam satu transaksi", () => {
  it("hanya menulis lewat fungsi - server action tidak boleh insert langsung", () => {
    // Ini yang membuat fungsi ini berarti. Kalau `createSale` masih memanggil
    // insert sendiri, fungsinya jadi hiasan saja.
    const action = readFileSync("src/app/app/penjualan/actions.ts", "utf8");
    const checkout = action.slice(
      action.indexOf("export async function createSale"),
      action.indexOf("export async function returnSaleItems"),
    );

    expect(checkout).toContain('supabase.rpc("create_sale_atomic"');
    // Read tetap boleh - cek IMEI ganda dan validasi keranjang memang
    //.READ-nya masih di sini. Yang dilarang adalah MENULIS di luar fungsi.
    for (const table of [
      '"cervise_sales"',
      '"cervise_sales_items"',
      '"finance_tx"',
      '"cervise_products"',
      '"cervise_customers"',
    ]) {
      expect(checkout).not.toMatch(
        new RegExp(`from\\(${table}\\)\\s*\\n?\\s*\\.(insert|update|upsert|delete)`),
      );
    }
  });

  it("menulis keempatnya di dalam satu badan fungsi", () => {
    const body = fnBody();
    expect(body).toContain("insert into public.cervise_sales");
    expect(body).toContain("insert into public.cervise_sales_items");
    expect(body).toContain("public.adjust_product_stock");
    expect(body).toContain("insert into public.finance_tx");
    expect(body).toContain("update public.cervise_customers");
  });

  it("tidak memakai exception handler yang bisa menelan rollback", () => {
    // BEGIN ... EXCEPTION di plpgsql membuat subtransaksi: error yang ditangkap
    // TIDAK membatalkan tulisan yang sudah terjadi. Itu justru membatalkan
    // sifat yang paling dibutuhkan di sini.
    // `EXCEPTION WHEN` di plpgsql membuat subtransaksi: error yang ditangkap
    // TIDAK membatalkan tulisan yang sudah terjadi. Itu justru membatalkan
    // sifat yang paling dibutuhkan di sini.
    //
    // `raise exception` TIDAK ikut pola ini - itu klausa Raise yang biasa,
    // justru alat untuk membatalkan transaksi.
    expect(fnBody()).not.toMatch(/\bexception\s+when\b/i);
  });

  it("tidak menulis lewat jalur stok selain adjust_product_stock", () => {
    const body = fnBody();
    expect(body).not.toMatch(/update\s+public\.cervise_products/);
    expect(body).not.toMatch(/insert into public\.cervise_stock_movements/);
  });

  it("menghitung ulang uang dari item, bukan mempercayai angka pemanggil", () => {
    const body = fnBody();
    // Subtotal, diskon, total, paid, dan status dihitung di dalam SQL.
    expect(body).toContain("v_subtotal := v_subtotal + (v_qty * v_unit_price)");
    expect(body).toContain("v_total := greatest(0, v_subtotal - v_discount)");
    expect(body).toContain("v_paid := least(greatest(coalesce(p_paid, 0), 0), v_total)");
    // Dan angkanya tidak pernah diambil dari parameter secara langsung saat
    // menulis ke sales.
    expect(body).toMatch(
      /\)\s*values\s*\(\s*p_branch_id, p_customer_id, p_sale_number, v_subtotal/,
    );
  });

  it("hanya mengizinkan role kasir, teknisi tidak bisa menyelusuk", () => {
    const body = fnBody();
    expect(body).toContain("public.has_tenant_branch_role(");
    const roles = body.match(/array\[([^\]]*)\]/)?.[1] ?? "";
    expect(roles).toContain("MASTER_ADMIN");
    expect(roles).toContain("ADMIN");
    expect(roles).toContain("FRONTLINER");
    expect(roles).not.toContain("TECHNICIAN");
  });

  it("memastikan customer dan produk milik cabang yang sama", () => {
    const body = fnBody();
    expect(body).toContain("where id = p_customer_id and branch_id = p_branch_id");
    expect(body).toContain("where id = v_product_id and branch_id = p_branch_id");
  });

  it("menolak qty dan harga tidak masuk akal sebelum menulis apa pun", () => {
    const body = fnBody();
    expect(body).toContain("if v_qty is null or v_qty <= 0 then");
    expect(body).toContain("if v_unit_price is null or v_unit_price < 0 then");
    // Pengecekan harus mendahului insert sales, bukan sesudahnya.
    expect(body.indexOf("if v_qty is null")).toBeLessThan(
      body.indexOf("insert into public.cervise_sales ("),
    );
  });

  it("tidak menulis ke finance_tx saat belum ada uang masuk", () => {
    expect(fnBody()).toMatch(
      /if v_paid > 0 then[\s\S]{0,200}insert into public\.finance_tx/,
    );
  });

  it("hanya boleh dipanggil authenticated, bukan anon", () => {
    expect(SQL).toContain("revoke all on function public.create_sale_atomic(");
    expect(SQL).toContain("to authenticated");
    expect(SQL).toContain("from anon");
    // security definer wajib, karena RPC lain menulis lewat RLS yang ketat.
    expect(SQL).toContain("security definer");
    expect(SQL).toContain("set search_path = public");
  });

  it("tidak pernah mengembalikan sale_id parsial ke pemanggil", () => {
    // Kalau badannya melempar, PostgREST mengembalikan error dan transaksi
    // rollback. Tidak ada jalur yang mengembalikan sale_id setengah jadi.
    expect(fnBody()).toMatch(/return v_sale_id;\s*end;\s*$/);
  });
});