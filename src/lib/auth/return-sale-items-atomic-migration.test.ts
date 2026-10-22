import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  "supabase/migrations/20261018140000_sale_return_finance.sql",
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
 * setiap percobaan menambah stok nyata - itu bukan bug pembukuan, itu sumber
 * stok.
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

    expect(fn).toMatch(/supabase\.rpc\(\s*\n?\s*"return_sale_items_atomic"/);
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
});

/**
 * Retur yang hanya mengembalikan stok adalah retur yang tidak membayar apa pun.
 * Barang masuk lagi ke gudang, kas tidak bergerak, dan Laporan Penjualan tetap
 * menghitung omzet penuh.
 */
describe("retur mengembalikan uang, bukan hanya stok", () => {
  it("menghitung nilai barang kembali secara proporsional terhadap total", () => {
    const body = fnBody();
    // Harga sticker salah kalau ada diskon: 2 unit @150.000 dengan diskon
    // 100.000 berarti total 200.000, jadi 1 unit yang kembali bernilai
    // 100.000 - bukan 150.000.
    expect(body).toMatch(
      /v_value\s*:=\s*floor\(\(v_gross::numeric \* v_sale\.total\) \/ v_sale\.subtotal\)::integer/,
    );
    // Perkalian 600.000 x 600.000 melewati batas integer, jadi harus numeric.
    expect(body).toContain("v_gross::numeric");
  });

  it("tidak pernah mengembalikan uang lebih dari yang pernah diterima", () => {
    const body = fnBody();
    // Penjualan DP 300.000 dibayar 100.000, semua barang kembali: yang boleh
    // keluar hanya 100.000.
    expect(body).toContain(
      "v_refund := least(v_value, v_sale.paid) - least(v_sale.returned_value, v_sale.paid);",
    );
    expect(body).toContain("if v_refund < 0 then");
  });

  it("menyimpan nilai barang, bukan uang keluar, supaya utang bisa dihitung", () => {
    expect(SQL).toContain("returned_value integer not null default 0");
    expect(SQL).toContain("grant select (returned_value) on public.cervise_sales");
    // Hanya fungsi yang boleh menulisnya.
    expect(SQL).not.toContain("grant update (returned_value)");
    expect(fnBody()).toContain("set returned_value = v_value");
  });

  it("menyetel nilai barang tepat sama dengan total saat semua kembali", () => {
    const body = fnBody();
    // Menjumlahkan floor per permintaan bisa menyisakan 1 rupiah selamanya.
    expect(body).toMatch(
      /if v_all_returned then[\s\S]{0,200}v_value\s*:=\s*v_sale\.total/,
    );
  });

  it("mencatat kas keluar dengan sumber 'retur' dan tanggal dari pemanggil", () => {
    const body = fnBody();
    expect(body).toContain("insert into public.finance_tx");
    expect(body).toContain("'pengeluaran'");
    expect(body).toContain("'retur'");
    // current_date di server UTC akan mencatat retur pagi WIB ke hari
    // sebelumnya.
    expect(body).toContain("p_kas_date");
    expect(body).not.toContain("current_date");
    // Metode ikut penjualan asalnya, supaya rekap per metode di laporan shift
    // tidak kehilangan arah uangnya.
    expect(body).toContain("v_sale.payment_method");
  });

  it("tidak menulis kas keluar kalau tidak ada uang yang kembali", () => {
    expect(fnBody()).toMatch(/if v_refund > 0 then[\s\S]{0,200}insert into public\.finance_tx/);
  });

  it("mengizinkan 'retur' di constraint sumber kas", () => {
    expect(SQL).toMatch(/finance_tx_source_check[\s\S]{0,300}'retur'/);
  });

  it("membuang versi lama supaya signature-nya tidak tertinggal", () => {
    // create or replace tidak bisa mengubah daftar argumen; tanpa drop,
    // pemanggil lama tetap menemukan fungsi tanpa p_kas_date.
    expect(SQL).toContain(
      "drop function if exists public.return_sale_items_atomic(uuid, uuid, jsonb);",
    );
  });

  it("mengembalikan jumlah item dan nominal refund", () => {
    const body = fnBody();
    expect(body).toMatch(/return jsonb_build_object\(/);
    expect(body).toContain("'refund', v_refund");
  });
});
