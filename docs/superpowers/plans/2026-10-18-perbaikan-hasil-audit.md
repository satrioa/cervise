# Perbaikan Hasil Audit 2026-10-18 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup 19 temuan audit (6 must-fix, 10 should-fix, 3 nice-to-have) tanpa mengubah fitur yang sudah benar, memakai empat track paralel yang tidak saling menyentuh file.

**Architecture:** Empat track = empat worktree anak, masing-masing memiliki sekumpulan file yang tidak beririsan. Track tidak boleh mengedit file milik track lain; kalau sebuah fileappears needing dua track, itu bug di plan ini, bukan alasan untuk pindah file. Tiga helper bersama (tanggal bisnis, pencarian PostgREST, pencarian user auth) dibuat lebih dulu di Task 0 supaya track tidak saling mengimpor.

**Tech Stack:** Next.js 16 App Router, server actions, Supabase (Postgres + RLS + RPC), vitest 3, TypeScript.

**Spec:** `docs/superpowers/plans/2026-10-18-perbaikan-hasil-audit.md` (dokumen ini) — argumen dan temuan asalnya ada di `docs/HANDOVER.md` dan hasil audit 2026-10-17.

## Global Constraints

- Copy user-facing dalam Bahasa Indonesia. Tidak ada copy bahasa Inggris baru di UI.
- Tidak menambah dependency. `package.json` tidak boleh berubah.
- Money values integer rupiah. Tidak ada pecahan, tidak ada float untuk nominal.
- Semua tulis stok tetap lewat RPC `apply_stock_delta` / `adjust_product_stock`. Tidak boleh `update cervise_products set stock_qty` langsung.
- Semua pemeriksaan role tetap ganda: di server action (gate) **dan** di RLS/RPC. Kalau sebuah pemeriksaan dihapus dari satu sisi, sisi lain tidak boleh ikut hilang.
- Migration baru: nama `supabase/migrations/20261018<hhmm00>_<slug>.sql`, satu topik per file, dan setiap migration punya test YAML/string assertion di `src/lib/auth/*-migration.test.ts` (pola: `service-spareparts-migration.test.ts`, `cash-sessions-migration.test.ts`).
- Test: `npx vitest run <path>` untuk satu file, `npm run test` untuk semua. Typecheck: `npm run typecheck`. Lint: `npm run lint`. Ketiganya harus hijau sebelum commit.
- `node_modules` belum terpasang di worktree ini. Jalankan `npm install` sekali per worktree sebelum test pertama; tanpa itu tidak ada yang bisa diverifikasi.
- Tidak menyentuh `src/components/{reui,originkit,smoothui,uitripled}/` (component library).

## Review Focus

Lima kondisi yang paling mungkin menggigit orang yang memakai software ini, dan test yang mengunci masing-masing):

1. **Kasir menekan "Bayar" dua kali pada servis yang sama** → hanya boleh tercatat satu pembayaran penuh;_test: B1_
2. **Kasir mencatat transaksi jam 01:00 WIB** → harus masuk laporan tanggal 18, bukan 17. _test: T0_
3. **Dua kasir menjual produk terakhir yang sama** → satu penjualan jadi gagal total, tidak boleh ada sale yatim tanpa stok dan tanpa finance_tx. _test: A1_
4. **Manajer mengetik `a,b` di kotak pencarian sparepart** → tidak boleh error, tidak boleh mengubah filter. _test: A3, B3_
5. **Pemilik toko mengetik karakter aneh/,) di lacak publik** → harus dapat "kode tidak ditemukan", tidak boleh error 500. _test: D1_

---

## Ownership File (WAJIB — ini yang membuat paralel aman)

| Track | Milik (boleh diedit) | Dilarang menyentuh |
|---|---|---|
| **A — POS & Penjualan** | `src/app/app/penjualan/**`, `src/components/penjualan/**`, `supabase/migrations/*create_sale_atomic*`, `supabase/migrations/*sale_return*` | semua file lain |
| **B — Servis & Kas** | `src/app/app/actions/cash.ts`, `src/app/app/servis/**`, `src/components/cash/**`, `src/components/servis/**`, `src/lib/operational/garansi-list.ts`, `supabase/migrations/*garansi*`, `supabase/migrations/*tag_counter*` | semua file lain |
| **C — Laporan & Platform** | `src/app/app/keuangan/**`, `src/app/app/laporan/**`, `src/app/owner/**`, `src/components/owner/**`, `src/components/transaksi-export-dialog.tsx`, `src/components/generic-export-dialog.tsx`, `src/app/app/cabang/**`, `src/components/cabang/**`, `src/lib/supabase/actor.ts`, `src/lib/billing/renewal.ts`, `src/app/dashboard/tenant/actions.ts`, `middleware.ts` | semua file lain |
| **D — Publik & Karyawan** | `src/app/lacak/**`, `src/app/app/karyawan/**`, `src/components/karyawan/**` | semua file lain |

Pelanggaran tabel ini = worktree dibuang, bukan di-merge.

---

## Task 0: Helper Bersama (coordinator, sebelum agent mana pun jalan)

**Files:**
- Create: `src/lib/business-date.ts`, `src/lib/business-date.test.ts`
- Create: `src/lib/supabase/admin-users.ts`, `src/lib/supabase/admin-users.test.ts`

**Interfaces:**
- Produces: `businessDate(date?: Date): string` — `YYYY-MM-DD` di zona `Asia/Jakarta`.
- Produces: `findAuthUserByEmail(email: string): Promise<{ id: string } | null>` — meng-loop semua halaman `auth.admin.listUsers`.

 Kenapa tidak pakai `toLocalDateString` (`src/lib/operational/garansi-list.ts:35`): fungsi itu memakai `date.getDate()`, yaitu waktu lokal **server**. Di Vercel `TZ=UTC`, jadi hasilnya tetap tanggal UTC — bug yang sama. Zona harus ditulis eksplisit.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// src/lib/business-date.test.ts
import { describe, expect, it } from "vitest";
import { BUSINESS_TIME_ZONE, businessDate } from "./business-date";

describe("businessDate", () => {
  it("menggunakan tanggal kalender Asia/Jakarta, bukan UTC", () => {
    // 2026-10-17T20:00:00Z = 2026-10-18 03:00 WIB
    expect(businessDate(new Date("2026-10-17T20:00:00Z"))).toBe("2026-10-18");
  });

  it("tidak bergeser untukystore yang buka setelah tengah malam", () => {
    expect(businessDate(new Date("2026-10-17T17:00:00Z"))).toBe("2026-10-18");
    expect(businessDate(new Date("2026-10-17T16:59:59Z"))).toBe("2026-10-17");
  });

  it("menyimpan zona sebagai konstanta supaya migration bisa membacanya", () => {
    expect(BUSINESS_TIME_ZONE).toBe("Asia/Jakarta");
  });
});
```

```ts
// src/lib/supabase/admin-users.test.ts
import { describe, expect, it, vi } from "vitest";
import { findAuthUserByEmail } from "./admin-users";

describe("findAuthUserByEmail", () => {
  it("mencari di semua halaman, bukan hanya halaman pertama", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { users: [{ id: "a", email: "x@example.com" }] }, error: null })
      .mockResolvedValueOnce({ data: { users: [{ id: "b", email: "target@example.com" }] }, error: null });
    const admin = { auth: { admin: { listUsers } } } as never;

    await expect(findAuthUserByEmail(admin, "target@example.com")).resolves.toEqual({ id: "b" });
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it("mengembalikan null kalau tidak ada", async () => {
    const listUsers = vi.fn().mockResolvedValue({ data: { users: [] }, error: null });
    await expect(findAuthUserByEmail({ auth: { admin: { listUsers } } } as never, "x@example.com")).resolves.toBeNull();
  });

  it("melempar error Supabase, bukan menelan", async () => {
    const listUsers = vi.fn().mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(findAuthUserByEmail({ auth: { admin: { listUsers } } } as never, "x@example.com")).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Jalankan, harus gagal**

Run: `npx vitest run src/lib/business-date.test.ts src/lib/supabase/admin-users.test.ts`
Expected: FAIL — "Cannot find module '@/lib/business-date'".

- [ ] **Step 3: Implementasi**

```ts
// src/lib/business-date.ts
export const BUSINESS_TIME_ZONE = "Asia/Jakarta";

/**
 * Tanggal kalender toko, selalu di zona Asia/Jakarta.
 *
 * Server produksi berjalan di UTC, jadi `toISOString().slice(0, 10)` dan
 * `date.getDate()` sama-sama salah untuk toko WIB: transaksi antara 00:00
 * dan 07:00 WIB jatuh ke tanggal sebelumnya. `en-CA` diformat ISO-like.
 */
const FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE });

export function businessDate(date: Date = new Date()): string {
  return FORMATTER.format(date);
}
```

```ts
// src/lib/supabase/admin-users.ts
const PER_PAGE = 1000;

/**
 * Cari user auth berdasarkan email, meng-loop halaman.
 *
 * `listUsers` tidak punya filter email, dan hanya mengembalikan satu halaman;
 * `createTenant`/`createKaryawan` pernah gagal hanya karena email yang dicari
 * jatuh di halaman 2. Halaman berikutnya diambil hanya kalau halaman ini penuh.
 */
export async function findAuthUserByEmail(
  admin: { auth: { admin: { listUsers: (args: { page: number; perPage: number }) => Promise<{ data: { users: { id: string; email?: string | null }[] } | null; error: { message: string } | null }> } } },
  email: string,
): Promise<{ id: string } | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    const found = users.find((user) => user.email?.toLowerCase() === target);
    if (found) return { id: found.id };
    if (users.length < PER_PAGE) return null;
  }
}
```

- [ ] **Step 4: Jalankan lagi**

Run: `npx vitest run src/lib/business-date.test.ts src/lib/supabase/admin-users.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/business-date.ts src/lib/business-date.test.ts src/lib/supabase/admin-users.ts src/lib/supabase/admin-users.test.ts
git commit -m "feat(lib): helper tanggal bisnis Asia/Jakarta dan pencarian user auth"
```

---

## Track A — POS & Penjualan (temuan 3, 9, 12, 17, sebagian 4)

### Task A1: Penjualan jadi satu transaksi DB (temuan 3)

**Files:**
- Create: `supabase/migrations/20261018090000_create_sale_atomic.sql`
- Create: `src/lib/auth/create-sale-migration.test.ts`
- Modify: `src/app/app/penjualan/actions.ts:233-363` (`createSale`)
- Test: `src/app/app/penjualan/actions.test.ts`

**Interfaces:**
- Consumes: `apply_stock_delta(uuid, integer, integer, text, uuid, uuid)`, `has_tenant_branch_role(uuid, uuid, text[])`, `is_platform_admin()` — semuanya sudah ada.
- Produces: RPC `public.create_sale_atomic(p_customer_id uuid, p_items jsonb, p_payment_method text, p_kas_date date, p_paid integer, p_notes text, p_discount_total integer) returns uuid`.

**Invariant yang harus dijaga:** `createSale` tidak lagi menulis `cervise_sales`, `cervise_sales_items`, stok, atau `finance_tx` sendiri. Satu panggilan RPC, satu transaksi. Harga dan total dihitung ulang di SQL dari `cervise_products` — nilai dari klien tidak pernah dipercaya untuk uang.

- [ ] **Step 1: Test migration (gagal dulu)**

```ts
// src/lib/auth/create-sale-migration.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync("supabase/migrations/20261018090000_create_sale_atomic.sql", "utf8");

describe("create_sale_atomic", () => {
  it("adalah security definer dengan search_path terkunci", () => {
    expect(SQL).toContain("create or replace function public.create_sale_atomic(");
    expect(SQL).toContain("security definer");
    expect(SQL).toContain("set search_path = public");
  });

  it("hanya boleh dipanggil role cabang yang boleh menjual", () => {
    expect(SQL).toContain("array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text]");
    expect(SQL).toContain("grant execute on function public.create_sale_atomic(uuid, jsonb, text, date, integer, text, integer) to authenticated");
    expect(SQL).toContain("revoke all on function public.create_sale_atomic(uuid, jsonb, text, date, integer, text, integer) from public, anon");
  });

  it("mengunci baris stok dan menolak stok tidak cukup", () => {
    expect(SQL).toContain("for update");
    expect(SQL).toContain("raise exception 'stok tidak cukup'");
    expect(SQL).toContain("public.apply_stock_delta(");
  });

  it("hanya mengizinkan diskon untuk role yang boleh mengubah harga jual", () => {
    expect(SQL).toContain("raise exception 'hanya admin yang boleh memberikan diskon'");
  });

  it("menulis finance_tx dengan metode pembayaran agar Arus Kas bisa memisah kas dan non-kas", () => {
    expect(SQL).toContain("metode");
    expect(SQL).toContain("insert into public.finance_tx");
  });
});
```

- [ ] **Step 2: Jalankan, harus gagal**

Run: `npx vitest run src/lib/auth/create-sale-migration.test.ts`
Expected: FAIL — ENOENT migration.

- [ ] **Step 3: Tulis migration**

Buat `supabase/migrations/20261018090000_create_sale_atomic.sql` dengan urutan wajib ini (satu transaksi, `raise exception` = rollback otomatis):

1. `create or replace function public.create_sale_atomic(...) returns uuid`, `language plpgsql`, `security definer`, `set search_path = public`.
2. Validasi argumen: `p_customer_id` bukan null, `jsonb_array_length(p_items) > 0`, `p_payment_method in ('Tunai','Debit','Transfer','QRIS','E-Wallet')`, `p_paid >= 0`.
3. `select * into v_customer from public.cervise_customers where id = p_customer_id for update;` — `not found` → `raise exception 'customer tidak ditemukan'`.
4. Gate role: `public.is_platform_admin() or public.has_tenant_branch_role(v_customer.organization_id, v_customer.branch_id, array['MASTER_ADMIN','ADMIN','FRONTLINER'])` → selain itu `raise exception 'role tidak diizinkan'`.
5. Loop `jsonb_array_elements(p_items)` dengan `v_seen uuid[]` penolakan produk dobel (pesan `produk hanya boleh satu baris`), `select ... from public.cervise_products where id = v_product_id and branch_id = v_customer.branch_id and is_active for update`, cek `is_serialized → qty = 1`, cek `qty <= stock_qty`, dan **`unit_price` diambil dari `v_product.price`, bukan dari JSON klien**.
6. Diskon: `if p_discount_total > 0 and not (public.is_platform_admin() or public.has_tenant_branch_role(..., array['MASTER_ADMIN','ADMIN'])) then raise exception 'hanya admin yang boleh memberikan diskon';` lalu `p_discount_total = least(greatest(p_discount_total, 0), v_subtotal)`.
7. `v_total := v_subtotal - p_discount_total;` `v_paid := least(p_paid, v_total);` `v_status := case when v_paid >= v_total then 'lunas' when v_paid > 0 then 'dp' else 'belum_bayar' end;`
8. `sale_number` dari `public.next_platform_invoice_number()` **atau** pola `INV-S-<ymd>-<suffix>`; kalau pakai sequence yang sudah ada, tidak perlu kolom baru.
9. Insert `cervise_sales` (`branch_id`, `customer_id`, `sale_number`, `subtotal`, `discount_total`, `total`, `paid`, `payment_status`, `payment_method`, `status='selesai'`, `kas_date`, `notes`, `created_by = auth.uid()`) → `returning id into v_sale_id`.
10. Per item: insert `cervise_sales_items` (`cost`, `unit_price`, `line_total`, `is_serialized`, `item_meta` dengan `imei1`/`imei2` dari JSON) lalu `perform public.apply_stock_delta(v_product_id, -v_qty, v_product.stock_qty, 'sale', v_sale_id, null);`
11. `if v_paid > 0 then insert into public.finance_tx (branch_id, type, amount, kas_date, metode, description, created_by) values (..., 'pemasukan', v_paid, p_kas_date, p_payment_method, 'Penjualan ' || v_sale_number, auth.uid());`
12. Tag customer `sales`: `update public.cervise_customers set tags = ...` — pertahankan perilaku `createSale` sekarang; kalau malas, pindahkan penandaan ini ke pemanggil TypeScript **sebelum** RPC (tidak perlu atomik).
13. `return v_sale_id;` lalu `revoke all ... from public, anon; grant execute ... to authenticated;`

- [ ] **Step 4: Ubah `createSale` jadi pemanggil tipis**

```ts
// src/app/app/penjualan/actions.ts — bentuk akhir createSale
export async function createSale(input: {
  customerId: string;
  items: { product_id: string; qty: number; unit_price: number; imei1?: string; imei2?: string; warna?: string }[];
  payment_method: string;
  kas_date: string;
  paid: number;
  notes?: string;
  promoCode?: string | null;
  discount_total?: number;
}) {
  const { supabase, branchId, role } = await getBranchUser();
  requireSalesAccess(role);

  // Validasi friendly-message tetap di sini supaya kasir baca Bahasa Indonesia.
  //.shortcut: aturan nominal diduplikasi di SQL; SQL yang menentukan, TS hanya menolak lebih awal.
  // Saat SQL menambah aturan, samakan di sini atau hapus blok ini.
  const { data: prods } = await supabase
    .from("cervise_products")
    .select("id, sku, name, stock_qty, is_serialized, price")
    .eq("branch_id", branchId)
    .in("id", input.items.map((item) => item.product_id));
  validateSaleItems(input.items, (prods ?? []) as never);
  if (!["Tunai", "Debit", "Transfer", "QRIS", "E-Wallet"].includes(input.payment_method)) throw new Error("Metode invalid");
  if (!Number.isFinite(input.paid) || input.paid < 0) throw new Error("Pembayaran tidak valid");
  const requestedDiscount = Number(input.discount_total ?? 0);
  if (!Number.isFinite(requestedDiscount) || requestedDiscount < 0) throw new Error("Diskon tidak valid");
  if (!canAccess(role, "harga_jual") && requestedDiscount > 0) throw new Error("Hanya admin yang boleh memberikan diskon");

  const { data: saleId, error } = await supabase.rpc("create_sale_atomic", {
    p_customer_id: input.customerId,
    p_items: input.items.map((item) => ({
      product_id: item.product_id,
      qty: Number(item.qty),
      imei1: item.imei1?.trim() || null,
      imei2: item.imei2?.trim() || null,
      warna: item.warna ?? null,
    })),
    p_payment_method: input.payment_method,
    p_kas_date: input.kas_date,
    p_paid: Math.round(Number(input.paid)),
    p_notes: (input.promoCode ? `[Promo ${input.promoCode}] ` : "") + (input.notes?.trim() || ""),
    p_discount_total: Math.round(requestedDiscount),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/app/penjualan");
  revalidatePath("/app/laporan/penjualan");
  return { id: saleId as string, sale_number: null };
}
```

Catatan: `sale_number` harus dikembalikan RPC karena kasir butuh nomornya di struk. Balikin `jsonb` `{ "id": ..., "sale_number": ... }`, jangan menambah kolom sequence baru kalau belum perlu.

- [ ] **Step 5: Jalankan test**

Run: `npx vitest run src/lib/auth/create-sale-migration.test.ts src/app/app/penjualan/actions.test.ts`
Expected: PASS. Test lama yangocked `insert ke finance_tx` harus diperbarui: sekarang dicek `rpc create_sale_atomic` dipanggil dengan `p_payment_method` benar dan tidak ada `insert` langsung.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261018090000_create_sale_atomic.sql src/lib/auth/create-sale-migration.test.ts src/app/app/penjualan/
git commit -m "fix(penjualan): satu transaksi DB untuk penjualan, retur, dan stok"
```

### Task A2: Retur mengembalikan uang (temuan 9) + nomor nota lebih panjang (temuan 17)

**Files:**
- Create: `supabase/migrations/20261018091000_sale_return_finance.sql`, `src/lib/auth/sale-return-migration.test.ts`
- Modify: `src/app/app/penjualan/actions.ts:23-28` (`genNota`), `:365-389` (`returnSaleItems`)
- Test: `src/app/app/penjualan/actions.test.ts`

- [ ] **Step 1: Test migration `return_sale_items_atomic`**

```ts
const SQL = readFileSync("supabase/migrations/20261018091000_sale_return_finance.sql", "utf8");

describe("return_sale_items_atomic", () => {
  it("mengembalikan stok dan uang dalam satu fungsi", () => {
    expect(SQL).toContain("create or replace function public.return_sale_items_atomic(");
    expect(SQL).toContain("public.apply_stock_delta(");
    expect(SQL).toContain("insert into public.finance_tx");
    expect(SQL).toContain("'pengeluaran'");
    expect(SQL).toContain("source = 'penyesuaian'"); // retur dicatat lewat sumber yang sudah diizinkan CHECK
  });
  it("menolak retur melebihi sisa dan menolak retur ganda", () => {
    expect(SQL).toContain("raise exception 'qty retur invalid'");
    expect(SQL).toContain("for update");
  });
});
```

Perhatikan: `finance_tx.source` punya CHECK `in ('transaksi','kas_manual','penyesuaian')`, jadi retur memakai `source = 'penyesuaian'` — tanpa menambah nilai baru ke constraint — dan dibedakan lewat `description` yang diawali `Retur penjualan <nomor>`. Laporan Shift sudah menghitung `penyesuaian` sebagai kas keluar, jadi angka laci tetap benar.

- [ ] **Step 2: Jalankan, gagal**

Run: `npx vitest run src/lib/auth/sale-return-migration.test.ts` → FAIL (ENOENT).

- [ ] **Step 3: Tulis migration** — `return_sale_items_atomic(p_sale_id uuid, p_items jsonb) returns integer`:
   gate role `MASTER_ADMIN/ADMIN/FRONTLINER` pada branch sale; untuk tiap item `select ... from cervise_sales_items where id = ... and sale_id = p_sale_id for update`; `available := qty - qty_returned`; `p_qty > available` → exception; `apply_stock_delta(product_id, +p_qty, null, 'sale_return', null, p_sale_id)`; `update ... set qty_returned = qty_returned + p_qty`; kalau `v_retur_nominal > 0` insert satu `finance_tx` (`type='pengeluaran'`, `amount = qty * unit_price`, `kas_date = current_date`, `source='penyesuaian'`, `description='Retur penjualan '||sale_number`, `metode` = `payment_method` sale asalnya); kalau semua item sudah `qty = qty_returned` maka `update cervise_sales set status='retur'`. `grant execute ... to authenticated`, `revoke all ... from public, anon`.

- [ ] **Step 4: `returnSaleItems` jadi pemanggil tipis + `genNota` diperpanjang**

```ts
function genNota(): string {
  const d = new Date();
  const ymd = `${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  // 4 digit random + UNIQUE bentrok ~2% per hari pada 200 nota/hari.
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`.toUpperCase();
  return `INV-S-${ymd}-${suffix}`;
}
```

`returnSaleItems` memanggil `supabase.rpc("return_sale_items_atomic", { p_sale_id: saleId, p_items: returns })`, melempar error apa adanya, lalu `revalidatePath("/app/penjualan")`.

- [ ] **Step 5: Jalankan test**

Run: `npx vitest run src/lib/auth/sale-return-migration.test.ts src/app/app/penjualan/actions.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261018091000_sale_return_finance.sql src/lib/auth/sale-return-migration.test.ts src/app/app/penjualan/
git commit -m "fix(penjualan): retur mengembalikan stok dan uang, nomor nota lebih panjang"
```

### Task A3: Sanitasi pencarian + tanggal kas di file penjualan (temuan 12, 4)

**Files:**
- Modify: `src/app/app/penjualan/actions.ts:75` (`searchProductsForSale`), `src/components/penjualan/penjualan-cart-dialog.tsx:31`, `src/components/penjualan/penjualan-cart-panel.tsx:145`
- Create: `src/lib/search-term.ts`, `src/lib/search-term.test.ts`

**Interfaces:**
- Produces: `sanitizeSearchTerm(raw: string): string` — membuang `,` `(` `)` `*` `\` dan `%`, memotong 60 karakter, trim.

- [ ] **Step 1: Test `sanitizeSearchTerm`**

```ts
import { describe, expect, it } from "vitest";
import { sanitizeSearchTerm } from "./search-term";

describe("sanitizeSearchTerm", () => {
  it("membuang karakter yang bisa mengubah filter PostgREST", () => {
    expect(sanitizeSearchTerm("a,b")).toBe("ab");
    expect(sanitizeSearchTerm("x)y")).toBe("xy");
    expect(sanitizeSearchTerm("100%")).toBe("100");
    expect(sanitizeSearchTerm("a*b")).toBe("ab");
  });
  it("memangkas input panjang", () => {
    expect(sanitizeSearchTerm("a".repeat(200))).toHaveLength(60);
  });
  it("tidak mengubah teks biasa", () => {
    expect(sanitizeSearchTerm("  Redmi Note 13  ")).toBe("Redmi Note 13");
  });
});
```

- [ ] **Step 2: Jalankan, gagal** → `npx vitest run src/lib/search-term.test.ts` → FAIL.

- [ ] **Step 3: Implementasi**

```ts
// src/lib/search-term.ts
/** Panjang maksimum; query ilike di database juga dibatasi. */
const MAX_TERM_LENGTH = 60;

/**
 * Bersihkan input pencarian sebelum masuk `.or()` PostgREST.
 *
 * `.or()` menerima string filter mentah, jadi `,` `(` `)` di term akan menambah
 * atau menutup klausa filter. Hasilnya bukan error yang berguna untuk kasir.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()*\\%]/g, "").trim().slice(0, MAX_TERM_LENGTH);
}
```

- [ ] **Step 4: Pakai di `searchProductsForSale` dan tanggal**

```ts
// src/app/app/penjualan/actions.ts
import { sanitizeSearchTerm } from "@/lib/search-term";
...
const term = sanitizeSearchTerm(q);
```

```ts
// src/components/penjualan/penjualan-cart-dialog.tsx dan penjualan-cart-panel.tsx
import { businessDate } from "@/lib/business-date";
const kasDate = businessDate();            // menggantikan new Date().toISOString().slice(0, 10)
```

- [ ] **Step 5: Jalankan test + typecheck**

Run: `npx vitest run src/lib/search-term.test.ts src/app/app/penjualan/actions.test.ts && npm run typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/search-term.ts src/lib/search-term.test.ts src/app/app/penjualan/actions.ts src/components/penjualan/
git commit -m "fix(penjualan): sanitasi pencarian dan tanggal kas per zona toko"
```

---

## Track B — Servis & Kas (temuan 1, 2, 4, 10, 12, 14, 15)

### Task B1: Satu fungsi pembayaran servis (temuan 1 + 2)

**Files:**
- Modify: `src/app/app/actions/cash.ts:441-515` (ganti `payServis` dengan `recordServisPayment`)
- Modify: `src/app/app/servis/actions.ts:503-535` (hapus `addPembayaran`)
- Modify: `src/components/cash/payment-dialog.tsx:75`, `src/components/servis/servis-bayar-drawer.tsx:39`

**Interfaces:**
- Produces: `recordServisPayment(input: { servisId: string; amount?: number; metode: PaymentMethod; kasDate?: string; note?: string }): Promise<CashResult<{ saleId: string; saleNumber: string | null; totalPaid: number; alreadyPaid: number }>>`, diekspor dari `@/app/app/actions/cash`.
- Produces: `type PaymentMethod = "Tunai" | "Debit" | "Transfer" | "QRIS" | "E-Wallet"` dari file yang sama.
- Menghapus: `addPembayaran` dari `@/app/app/servis/actions`.

**Kenapa double-entry:** `createSale` sudah menulis dua hal — baris `cervise_sales` (faktur) dan `finance_tx` (kas masuk). Pembayaran servis harus mengikuti pola yang sama, supaya Laporan Penjualan **dan** Arus Kas sama-sama melihatnya. `buildLaporanShift` hanya menghitung `finance_tx` dengan `source in ('kas_manual','penyesuaian')`, jadi baris `source='transaksi'` tidak menambah dua kali di shift — ini alasan kenapa pola ini aman.

- [ ] **Step 1: Test yang gagal**

Tambahkan ke `src/app/app/actions/cash.test.ts` (buat file baru dengan mock yang sama seperti `penjualan/actions.test.ts`):

```ts
describe("recordServisPayment", () => {
  it("menulis sales DAN finance_tx supaya dua laporan sama-sama melihat", async () => {
    await recordServisPayment({ servisId: "s1", metode: "Tunai", amount: 150000 });
    const tables = mocks.calls.map((c) => c.table);
    expect(tables).toContain("cervise_sales");
    expect(tables).toContain("finance_tx");
  });

  it("menolak pembayaran lagi kalau servis sudah lunas", async () => {
    mocks.state.paidTotal = 150000; // sum(finance_tx income) untuk servis ini
    mocks.state.service = { id: "s1", price: 150000, price_estimasi: 150000, status: "Selesai", customer_id: "c1", branch_id: "b1", service_number: "SRV-1" };
    const result = await recordServisPayment({ servisId: "s1", metode: "Tunai" });
    expect(result).toEqual({ ok: false, error: "Servis ini sudah lunas" });
    expect(mocks.calls.filter((c) => c.op === "insert")).toHaveLength(0);
  });

  it("memperbolehkan DP di atas pembayaran yang sudah ada", async () => {
    mocks.state.paidTotal = 100000;
    mocks.state.service = { id: "s1", price: 100000, price_estimasi: 150000, status: "Selesai", customer_id: "c1", branch_id: "b1", service_number: "SRV-1" };
    const result = await recordServisPayment({ servisId: "s1", metode: "Tunai", amount: 50000 });
    expect(result.ok).toBe(true);
  });

  it("menerima nominal eksplisit untuk servis tanpa harga estimasi", async () => {
    mocks.state.paidTotal = 0;
    mocks.state.service = { id: "s1", price: 0, price_estimasi: null, status: "Selesai", customer_id: "c1", branch_id: "b1", service_number: "SRV-1" };
    const result = await recordServisPayment({ servisId: "s1", metode: "QRIS", amount: 75000 });
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan, gagal** → `npx vitest run src/app/app/actions/cash.test.ts` → FAIL.

- [ ] **Step 3: Implementasi**

```ts
// src/app/app/actions/cash.ts — ganti payServis
export type PaymentMethod = "Tunai" | "Debit" | "Transfer" | "QRIS" | "E-Wallet";
const PAYMENT_METHODS: PaymentMethod[] = ["Tunai", "Debit", "Transfer", "QRIS", "E-Wallet"];

/**
 * Satu-satunya jalan mencatat pembayaran servis.
 *
 * Menulis dua hal, persis seperti `createSale`:
 * - `cervise_sales` (faktur, `servis_id` terisi) supaya Laporan Penjualan dan
 *   deduplikasi Laporan Shift melihatnya.
 * - `finance_tx` (`source` default 'transaksi', `metode` terisi) supaya Arus Kas
 *   dan Laporan Keuangan melihatnya.
 *
 * `servis_id` di baris penjualan juga yang membuat servis ini hilang dari
 * antrean "Bayar" setelah dibayar.
 */
export async function recordServisPayment(input: {
  servisId: string;
  amount?: number;
  metode: PaymentMethod;
  kasDate?: string;
  note?: string;
}): Promise<CashResult<{ saleId: string; saleNumber: string | null; totalPaid: number; alreadyPaid: number }>> {
  if (!input.servisId) return fail("ID servis tidak valid");
  if (!PAYMENT_METHODS.includes(input.metode)) return fail("Metode pembayaran tidak valid");

  try {
    const { supabase, branchId, userId, role } = await cashContext();
    if (!canAccess(role, "penjualan")) return fail("Role tidak diizinkan melakukan pembayaran");

    const { data: service, error: serviceError } = await supabase
      .from("cervise_services")
      .select("id, price, price_estimasi, status, customer_id, branch_id, service_number")
      .eq("id", input.servisId)
      .eq("branch_id", branchId)
      .maybeSingle();
    if (serviceError) return fail(serviceError.message);
    if (!service) return fail("Servis tidak ditemukan");
    if (service.status === "Batal") return fail("Servis dibatalkan tidak bisa dibayar");

    const { data: paidRows, error: paidError } = await supabase
      .from("finance_tx")
      .select("amount")
      .eq("branch_id", branchId)
      .eq("servis_id", input.servisId)
      .eq("type", "pemasukan");
    if (paidError) return fail(paidError.message);
    const alreadyPaid = (paidRows ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

    // PENTING: `cervise_services.price` adalah total yang SUDAH dibayar (di-set
    // dari jumlah finance_tx di bawah), jadi jangan dipakai sebagai patokan
    // lunas —-patokannya `price_estimasi`, harga yang disepakati teknisi.
    // Kalauprice Estimasi 0 (servis tanpa estimasi), pembayaran tetap boleh
    // dicatat asal nominalnya diberikan.
    const quoted = Number(service.price_estimasi ?? 0);
    if (quoted > 0 && alreadyPaid >= quoted) return fail("Servis ini sudah lunas");
    const remaining = quoted > 0 ? quoted - alreadyPaid : 0;

    const amount = Math.round(input.amount === undefined ? remaining : Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) return fail("Nominal pembayaran tidak valid");

    const kasDate = input.kasDate ?? businessDate();
    const saleNumber = nextServisSaleNumber();

    const { data: sale, error: saleError } = await supabase
      .from("cervise_sales")
      .insert({
        branch_id: branchId,
        customer_id: service.customer_id,
        sale_number: saleNumber,
        subtotal: amount,
        discount_total: 0,
        total: amount,
        paid: amount,
        payment_status: "lunas",
        payment_method: input.metode,
        status: "selesai",
        kas_date: kasDate,
        notes: input.note?.trim() || `Pembayaran servis ${service.service_number ?? ""}`.trim(),
        created_by: userId,
        servis_id: service.id,
      })
      .select("id, sale_number")
      .single();
    if (saleError) return fail(saleError.message);

    const { error: financeError } = await supabase.from("finance_tx").insert({
      branch_id: branchId,
      servis_id: service.id,
      type: "pemasukan",
      amount,
      kas_date: kasDate,
      metode: input.metode,
      description: `Pembayaran servis ${service.service_number ?? ""} - ${input.metode}`,
      created_by: userId,
    });
    if (financeError) return fail(financeError.message);

    const totalPaid = alreadyPaid + amount;
    if (totalPaid !== price) {
      await supabase.from("cervise_services").update({ price: totalPaid }).eq("id", service.id).eq("branch_id", branchId);
    }

    return { ok: true, data: { saleId: (sale as { id: string }).id, saleNumber: (sale as { sale_number: string | null }).sale_number, totalPaid, alreadyPaid } };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal menyimpan pembayaran");
  }
}
```

`nextServisSaleNumber()` = pemindah `genNota`-like dari `payServis` lama (`cash.ts:479-483`), named eksplisit.

Tiga tempat yang harus ikut berubah supaya tidak ada dua pencatatatan pembayaran:

- Hapus seluruh `addPembayaran` dari `src/app/app/servis/actions.ts`.
- `getPembayaranHistory` **tetap** di `servis/actions.ts` (dipakai drawer), hanya writer-nya yang pindah.
- `payment-dialog.tsx`: `payServis({servisId, paymentMethod, amount})` → `recordServisPayment({servisId: service.id, metode: method, amount: value})`. `service.price` yang dipakai dialog sebagai "Total" **berubah makna** (jadi total yang sudah dibayar, bukan sisa tagihan) — jadi `FrontlinerQueueItem` harus expose `priceEstimasi` dan `alreadyPaid`, dan dialog menampilkan `sisa = max(0, priceEstimasi - alreadyPaid)`. Task B2 yang menambah kedua field itu; sampai B2 merges, dialog boleh menampilkan sisa memakai `service.price` seperti sekarang.
- `servis-bayar-drawer.tsx`: `addPembayaran({servisId, amount, metode, kas_date, keterangan})` → `recordServisPayment({servisId, amount, metode: metode, kasDate: kasDate, note: keterangan})`; hapus import `addPembayaran`.

- [ ] **Step 4: Jalankan test**

Run: `npx vitest run src/app/app/actions/cash.test.ts src/app/app/servis/actions.test.ts && npm run typecheck` → PASS. Tidak boleh ada referensi `payServis`/`addPembayaran` tersisa:

Run: `grep -rn "payServis\|addPembayaran" src/` → hanya boleh menyingkir di plan/CHANGELOG.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/actions/cash.ts src/app/app/actions/cash.test.ts src/app/app/servis/actions.ts src/components/cash/ src/components/servis/
git commit -m "fix(kas): satu pencatatan pembayaran servis untuk semua laporan"
```

### Task B2: Antrean kasir + konteks tenant satu kali (temuan 2, 19, 4)

**Files:**
- Modify: `src/app/app/actions/cash.ts` (`getFrontlinerQueue`, `checkOpenCashSession`, `toCalendarDate`)
- Test: `src/app/app/actions/cash.test.ts`

- [ ] **Step 1: Test antrean**

```ts
describe("getFrontlinerQueue", () => {
  it("tidak menampilkan servis yang sudah punya pembayaran finance_tx", async () => {
    mocks.state.services = [{ id: "s1", status: "Selesai", price: 150000, customer_id: "c1", created_at: "2026-10-18T02:00:00Z" }];
    mocks.state.paidServiceIds = ["s1"]; // servis_id yang muncul di finance_tx
    const result = await getFrontlinerQueue();
    expect(result.ok && result.data.map((item) => item.id)).toEqual([]);
  });

  it("tetap menampilkan servis yang belum dibayar", async () => {
    mocks.state.services = [{ id: "s2", status: "Selesai", price: 50000, customer_id: "c1", created_at: "2026-10-18T02:00:00Z" }];
    mocks.state.paidServiceIds = [];
    const result = await getFrontlinerQueue();
    expect(result.ok && result.data.map((item) => item.id)).toEqual(["s2"]);
  });
});
```

- [ ] **Step 2: Jalankan, gagal.**

- [ ] **Step 3: Ubah `getFrontlinerQueue`**

Tambah satu query `finance_tx` dengan `.eq("type", "pemasukan").not("servis_id", "is", null)` dan gabungkan dengan `paidIds` yang sudah ada dari `cervise_sales`:

```ts
const [paidSales, paidFinance] = await Promise.all([
  supabase.from("cervise_sales").select("servis_id").eq("branch_id", branchId).not("servis_id", "is", null),
  supabase.from("finance_tx").select("servis_id, amount").eq("branch_id", branchId).eq("type", "pemasukan").not("servis_id", "is", null),
]);
if (paidSales.error) return fail(paidSales.error.message);
if (paidFinance.error) return fail(paidFinance.error.message);
const paidIds = new Set(
  [...(paidSales.data ?? []), ...(paidFinance.data ?? [])]
    .map((row) => row.servis_id as string)
    .filter(Boolean),
);
```

Ganti `toCalendarDate` dengan `businessDate` dan hapus helper itu; `hydrateSessions` menerima `Actor` dari pemanggil (`cashContext()` dipanggil **satu kali** per exported action, lalu diteruskan), bukan memanggilnya sendiri.

Tambahkan juga dua field ke `FrontlinerQueueItem` supaya dialog bayar tahu sisa tagihan:

```ts
export type FrontlinerQueueItem = {
  // ...field yang sudah ada
  /** Harga yang disepakati teknisi; 0/null = belum ada estimasi. */
  priceEstimasi: number | null;
  /** Sudah dibayar (jumlah finance_tx income untuk servis ini). */
  alreadyPaid: number;
};
```

`servis` select di `getFrontlinerQueue` tambah `price_estimasi`, dan `alreadyPaid` diambil dari query `finance_tx` yang sama seperti `paidIds` di atas (pakai `select("servis_id, amount")` lalu jumlahkan per servis, bukan `.not("servis_id","is",null)` saja). Dialog memakai `sisa = Math.max(0, (priceEstimasi ?? 0) - alreadyPaid)` untuk prefill nominal.

**Catatan urutan:** Task B1 (dialog) dan Task B2 (antrean) berurutan dalam track yang sama, jadi `payment-dialog.tsx` tidak boleh diubah di B1 untuk field yang baru lahir di B2. Kalau B1 selesai lebih dulu, sisakan `service.price` dan tandai `shortcut:` sampai B2.

- [ ] **Step 4: Test + typecheck**

Run: `npx vitest run src/app/app/actions/cash.test.ts && npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/actions/cash.ts src/app/app/actions/cash.test.ts
git commit -m "fix(kas): antrean bayar ikut memperhitungkan finance_tx, konteks tenant satu kali"
```

### Task B3: Garansi mulai saat diambil, counter tag atomik, sanitasi sparepart (temuan 14, 15, 12)

**Files:**
- Create: `supabase/migrations/20261018092000_garansi_on_pickup.sql`, `src/lib/auth/garansi-pickup-migration.test.ts`
- Modify: `src/lib/operational/garansi-list.ts` (`toLocalDateString` → delegasi), `src/app/app/servis/actions.ts:239-254,261-265,212-216`, `src/app/app/servis/sparepart-actions.ts:102`
- Modify: `src/lib/operational/garansi-list.test.ts`

- [ ] **Step 1: Test migration garansi**

```ts
const SQL = readFileSync("supabase/migrations/20261018092000_garansi_on_pickup.sql", "utf8");

describe("garansi mulai saat diambil", () => {
  it("set_service_status mengisi garansi_until dari garansi_value saat Sudah Diambil", () => {
    expect(SQL).toContain("create or replace function public.set_service_status(");
    expect(SQL).toContain("garansi_until");
    expect(SQL).toContain("garansi_value");
  });
  it("memakai trigger set_garansi() yang sudah ada, tidak membuat trigger baru", () => {
    expect(SQL).toContain("public.set_garansi()");
  });
});
```

Isi migration: `create or replace function public.set_service_status(...)` (ganti versi sekarang) dengan, di dalam blok `update`:

```sql
if p_status = 'Sudah Diambil' then
  update public.cervise_services
  set status = p_status,
      garansi_until = case
        when garansi_value is null or garansi_value <= 0 then null
        else now() + (case garansi_unit
                        when 'tahun' then make_interval(secs => garansi_value * 365 * 86400.0)
                        when 'bulan' then make_interval(secs => garansi_value * 30  * 86400.0)
                        else make_interval(secs => garansi_value * 86400.0) end)
      end
  where id = v_service.id;
else
  update public.cervise_services set status = p_status where id = v_service.id;
end if;
```

`make_interval` menghindari perkalian integer yang meluap; `garansi_value`/`garansi_unit` sudah ada di tabel._baris `cervise_services` yang `garansi_until`-nya masih kosong tidak di-backfill di migration ini — biarkan, `resolveGaransiUntil` sudah punya fallback.

- [ ] **Step 2: Jalankan, gagal.**

- [ ] **Step 3: Tulis migration + test counter tag**

Tambah test untuk `usage_count` di file migration yang sama:

```ts
it("counter tag ditulis sebagai operasi database, bukan baca-sulis", () => {
  expect(SQL).toContain("usage_count = usage_count + 1");
  expect(SQL).toContain("greatest(0, usage_count - 1)");
});
```

Dan di `servis/actions.ts`, ganti loop `usage_count + 1` dan `Math.max(0, usage_count - 1)` dengan SQL langsung:

```ts
await supabase.from("cervise_service_tags").update({ usage_count: undefined } as never) // jangan lakukan ini
```

yakni: **tidak** bisa lewat supabase-js (tidak ada `usage_count = usage_count + 1` di PostgREST). Pilih salah satu:
1. RPC kecil `bump_service_tag_usage(p_branch_id uuid, p_name text, p_delta integer)` di migration yang sama — 12 baris SQL, lalu `callRpc` dari `servis/actions.ts`.
2. Atau tulis komentar `shortcut:` di kode dan terima drift pada kasus input bersamaan.

Pilih **1**; ini race yang nyata di toko dengan dua kasir.

- [ ] **Step 4: Ubah `garansi-list.ts`**

```ts
import { businessDate } from "@/lib/business-date";

/** Dipakai server (UTC) maupun browser, jadi selalu zona toko. */
export function toLocalDateString(date: Date): string {
  return businessDate(date);
}
```

- [ ] **Step 5: Sanitasi + hapus kode mati di `servis/actions.ts`**

```ts
import { sanitizeSearchTerm } from "@/lib/search-term";
...
const term = sanitizeSearchTerm(q);           // searchCustomers
```

Hapus: `const KONDISI_ITEMS_INTERNAL = [...]` (baris 10-22, tidak terpakai) dan blok `ilike("name")` kedua di `createServis` (baris 212-219 — kondisinya lebih sempit dari query pertama, jadi tidak pernah mengembalikan apa pun).

- [ ] **Step 6: Test + typecheck**

Run: `npx vitest run src/lib/auth/garansi-pickup-migration.test.ts src/lib/operational/garansi-list.test.ts src/app/app/servis/actions.test.ts src/app/app/servis/sparepart-actions.test.ts && npm run typecheck` → PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261018092000_garansi_on_pickup.sql src/lib/auth/garansi-pickup-migration.test.ts src/lib/operational/garansi-list.ts src/app/app/servis/
git commit -m "fix(servis): garansi mulai saat diambil, counter tag atomik, sanitasi pencarian"
```

---

## Track C — Laporan & Platform (temuan 5, 6, 7, 8, 18)

### Task C1: Total laporan tidak dipotong diam-diam (temuan 7)

**Files:**
- Modify: `src/app/app/keuangan/actions.ts`, `src/app/app/laporan/penjualan/actions.ts`, `src/app/app/laporan/servis/actions.ts`, `src/app/owner/actions.ts:84-87`
- Modify: komponen yang merender total: `src/components/transaksi-export-dialog.tsx`, `src/app/app/keuangan/arus-kas/arus-kas-client.tsx`, `src/app/app/laporan/penjualan/laporan-penjualan-client.tsx`, `src/app/app/laporan/servis/laporan-servis-client.tsx`
- Test: `src/lib/operational/laporan-keuangan.test.ts` (+ test baru untuk flag)

Pola yang sudah dipakai repo dan harus ditiru (`src/app/app/inventori/actions.ts:41-53`): ambil `CAP + 1` baris, `truncated = rows.length > CAP`.

```ts
const ROW_CAP = 1000;
...
.limit(ROW_CAP + 1);
...
const truncated = rows.length > ROW_CAP;
const capped = truncated ? rows.slice(0, ROW_CAP) : rows;
```

`buildLaporanKeuangan` menerima **sudah dipotong**; flag dikembalikan ke UI dan ditampilkan satu baris: `Menampilkan 1.000 transaksi terbaru. Total di bawah tidak mencakup transaksi yang lebih lama.` Kalau `FinanceData` jadi `{ transactions, branches, report, truncated }`, perbarui semua pemanggil (`getFinanceLedger` mengembalikan `data` yang sama, jadi tidak ada perubahan signature di luar).

Untuk `getOwnerDashboard`, `collected` dan `pendingInvoices` harus dihitung dengan query agregat, bukan dari 500 baris:

```sql
select status, count(*)::int as count, coalesce(sum(amount), 0)::int as total from public.invoices group by status
```

Artinya `stats` berasal dari RPC/baris agregat; test cukup untuk assert `stats.collected` memakai nilai agregat.

### Task C2: Arus Kas pisahkan kas dan non-kas (temuan 8)

**Files:** `src/lib/operational/laporan-keuangan.ts`, test-nya, `arus-kas-client.tsx`

Tambah ke `LaporanKeuangan`:

```ts
export type LaporanKeuangan = { ... totalMasukTunai: number; totalMasukNonTunai: number; ... };
```

di dalam loop: `if (isIncome && transaction.metode === "Tunai") totalMasukTunai += amount; else if (isIncome) totalMasukNonTunai += amount;`

Test wajib: baris `metode: null` (data lama sebelum kolom diisi) **tidak** boleh dihitung sebagai kas tunai — masuk ke non-kas supaya angka "+Tunai" tidak pernah lebih besar dari "+Non-Tunai + Tunai" secara keliru. Tampilkan dua baris di Arus Kas dengan catatan yang jujur: `Transfer/Debit/QRIS bukan uang di laci`.

### Task C3: `createTenant` mencari user di semua halaman (temuan 5)

**Files:** `src/app/owner/actions.ts:292-300`

Ganti blok `listUsers` + `.find` dengan helper Task 0:

```ts
const existing = await findAuthUserByEmail(admin, tenantInput.ownerEmail);
if (existing) {
  ownerId = existing.id;                       // password existing tidak diubah
} else {
  const generated = generateTempPassword();
  const { data, error } = await admin.auth.admin.createUser({ ... });
  ...
}
```

Test: `src/lib/platform/owner-accounts.test.ts` atau test action baru yang memock `findAuthUserByEmail` mengembalikan null/user ada; assert `createUser` tidak dipanggil saat user ditemukan.

### Task C4: Hapus status fiktif di daftar anggota cabang (temuan 6)

**Files:** `src/app/app/cabang/actions.ts:137-162`, `src/components/cabang/cabang-drawer.tsx:335-336`

Hapus `status`, `customStatus`, `active` (string "active now"/"idle") dari return. Kembalikan yang jujur: `{ id, name, initials, email, role, active }` dengan `active` boolean. Di drawer, ganti blok status dengan teks `Aktif`/`Nonaktif` atau sembunyikan. Tidak ada data online di database, jadi jangan dikarang.

Test: `src/components/cabang/branch-identity-guard.test.ts` sudah membaca file drawer — tambahkan assertion bahwa `customStatus` tidak lagi muncul di `cabang-drawer.tsx` maupun `actions.ts`.

### Task C5: Kode mati + satu gerbang subscription (temuan 18)

**Files:** `src/lib/billing/renewal.ts`, `src/lib/billing/renewal.test.ts`, `src/lib/supabase/actor.ts`, `src/app/dashboard/tenant/actions.ts`, `middleware.ts` (tidak diubah isinya, hanya dipastikan tidak memecah saat actor.ts berubah)

Tambah di `renewal.ts`:

```ts
export type TenantSubscriptionFacts = {
  status: SubscriptionLifecycleStatus;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  graceDays: number | null;
  now: Date;
  allowExpired: boolean;
};

/**
 * Satu-satunya aturan "apakah tenant boleh masuk".
 *okersia `allowExpired: true` HANYA untuk halaman penagihan.
 */
export function resolveTenantAccess(facts: TenantSubscriptionFacts):
  | { ok: true; status: SubscriptionLifecycleStatus; access: ActorSubscriptionState }
  | { ok: false; reason: "trial_expired" | "period_invalid" | "blocked" };
```

Test: lima kasus — trial berakhir, `active` tanpa `current_period_end`, `active` dalam grace, `grace` melewati `current_period_end + grace_days`, dan `allowExpired: true` tidak melempar untuk empat kasus pertama.

Lalu: `actor.ts` (`resolveTenant`), `getTenantBySlugForCurrentUser`, dan `dashboard/tenant/actions.ts` memanggil `resolveTenantAccess` dan memetakan `reason` ke `TenantAccessError.code` yang sudah ada. Hapus `getActiveTenantStrict` (tidak pernah dipanggil) dan `const orgFromHeader = null`.

Setelah semua hijau: `npm run typecheck && npm run lint && npm run test`.

Commit:

```bash
git commit -am "refactor(billing): satu gerbang akses subscription, hapus kode mati"
```

---

## Track D — Publik & Karyawan (temuan 11, 13)

### Task D1: Lacak publik terikat tenant dari URL (temuan 11)

**Files:** `src/app/lacak/actions.ts:133-191`, `src/app/lacak/actions.test.ts`

Urutannya: `getPublicTenant(slug)` (sudah ada, menolak slug yang statusnya bukan trial/active/grace). Kalau tenant tidak ditemukan, kembalikan `PUBLIC_LOOKUP_UNAVAILABLE_MESSAGE` **sebelum** menyentuh `cervise_services`. Lalu tambahkan `.eq("organization_id", tenant.organizationId)` pada query servis.

`PublicTenant` di `src/lib/public/landing.ts` belum tentu membawa `organizationId` - periksa; kalau tidak ada, tambahkan field itu di sana. File itu di luar daftar ownership karena dipakai bersama; catat penyimpangan ini di worktree comment sebelum mengedit.

Test (pola review focus #5): dengan slug yang tidak dikenal → `{ ok: false, message: UNAVAILABLE }` dan `cervise_services` **tidak** dikueri sama sekali (assert counter mock); dengan slug yang dikenal tapi kode milik tenant lain → `UNAVAILABLE`.

### Task D2: Karyawan yang sudah punya akun bisa ditambahkan (temuan 13)

**Files:** `src/app/app/karyawan/actions.ts:98-178`, `src/app/app/karyawan/actions.test.ts` (baru kalau belum ada)

```ts
const admin = createAdminClient();
const existingUser = await findAuthUserByEmail(admin, email);
let uid: string;
let tempPassword: string | null = null;

if (existingUser) {
  uid = existingUser.id;                     // akun orang ini dipakai, password tidak diubah
} else {
  tempPassword = generateTempPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) throw new Error(createError?.message ?? "Gagal membuat akun");
  uid = created.user.id;
}
```

`profiles` di-upsert seperti sekarang (`onConflict: "id"`), `employees` di-insert seperti sekarang, dan rollback (`profiles` + `deleteUser`) **hanya jalan kalau `tempPassword` tidak null** — kalau userexisting, `deleteUser` akan mengunci orang dari akunnya sendiri. Return `{ employeeId, profileId, tempPassword: tempPassword ?? "" }`; UI menampilkan password hanya kalau tidak kosong (cek `src/components/karyawan/karyawan-list.tsx:201` yang sudah memakai `info?.tempPassword`).

Test: user sudah ada → `createUser` tidak dipanggil, `tempPassword` kosong, `employees` tetap ter-insert; insert `employees` gagal → `deleteUser` **tidak** dipanggil untuk userexisting.

Commit: `git commit -am "fix(karyawan): daftarkan akun yang sudah ada sebagai karyawan tenant lain"`.

---

## Merge Order & Verifikasi

1. Task 0 di worktree `Auditor` (branch `satrioa/Auditor`), commit lebih dulu.
2. Spawn 4 worktree anak dari `Auditor`:

```bash
orca worktree create --name fix-pos        --parent-worktree active --agent claude --prompt "Baca docs/superpowers/plans/2026-10-18-perbaikan-hasil-audit.md, kerjakan Track A (Task A1-A3) saja. Jangan sentuh file di luar tabel Ownership File. Ikuti setiap langkah TDD dan commit per task." --json
orca worktree create --name fix-servis-kas --parent-worktree active --agent claude --prompt "Baca docs/superpowers/plans/2026-10-18-perbaikan-hasil-audit.md, kerjakan Track B (Task B1-B3) saja. Jangan sentuh file di luar tabel Ownership File. Ikuti setiap langkah TDD dan commit per task." --json
orca worktree create --name fix-laporan   --parent-worktree active --agent claude --prompt "Baca docs/superpowers/plans/2026-10-18-perbaikan-hasil-audit.md, kerjakan Track C (Task C1-C5) saja. Jangan sentuh file di luar tabel Ownership File. Ikuti setiap langkah TDD dan commit per task." --json
orca worktree create --name fix-publik    --parent-worktree active --agent claude --prompt "Baca docs/superpowers/plans/2026-10-18-perbaikan-hasil-audit.md, kerjakan Track D (Task D1-D2) saja. Jangan sentuh file di luar tabel Ownership File. Ikuti setiap langkah TDD dan commit per task." --json
```

Setiap worktree anak wajib `npm install` sebelum test pertama.
3. Merge berurutan **A → B → C → D** ke `satrioa/Auditor`. Tidak ada file yang sama antar track, jadi tidak ada konflik merge yang diharapkan; kalau ada, itu berarti agent melanggar ownership.
4. Setelah merge: `npm run typecheck && npm run lint && npm run test`, lalu `npm run build`.
5. Migration baru harus di-apply ke project Supabase (test SQL hanya memeriksa isi file, tidak menjalankannya). Urutan apply: A1 → A2 → B3 → C1. Terapkan lewat Supabase CLI/migration runner, bukan SQL Editor manual, supaya `supabase_migrations` tetap sinkron.

## Review Gaps (test yang belum ada, sudah ditempatkan di task pemilik kodenya)

- Tidak ada test untuk `middleware.ts` sebagai unit (logika `resolvePostLoginDestination` sudah diuji lewat `post-login.test.ts`; `middleware.ts` sendiri belum pernah dijalankan). Track C boleh menambahkan `src/lib/auth/authorization.test.ts` kasus baru untuk `getProtectedPathKind` + redirect owner/onboarding, tanpa mengubah `middleware.ts`.
- Tidak ada test end-to-end untuk RLS. Semua asumsi RLS di plan ini (mis. `finance_tx` punya grant `insert` untuk `authenticated`) diverifikasi dari isi migration, bukan dari database hidup. Sebelum merge, jalankan satu query verifikasi manual terhadap project Supabase:

```sql
select has_table_privilege('authenticated', 'public.finance_tx', 'INSERT') as finance_insert,
       has_table_privilege('authenticated', 'public.cervise_sales', 'INSERT') as sales_insert;
```

Kalau `finance_insert` false, semua pencatatan kas gagal diam-diam — itu temuan baru dan harus masuk plan, bukan diabaikan.