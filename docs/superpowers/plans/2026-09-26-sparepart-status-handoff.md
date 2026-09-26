# Handoff: DB + sparepart/status servis (26 Sep 2026)

Catatan ini untuk sesi lain yang juga bekerja di repo ini. Semua perubahan di bawah
sudah **diterapkan ke project Supabase canonical** dan sudah terverifikasi.

## Migrasi yang sudah live (jangan apply ulang)

| Versi | Nama | Isi |
|---|---|---|
| `20260925130000` | `cervise_operational_schema` | Tabel/view operasional `cervise_*` (diterapkan sesi lain; versi metadata sudah diselaraskan) |
| `20260925140000` | `lock_product_stock` | `cervise_products` UPDATE manager-only, `stock_qty` dicabut dari column grant, 3 view kompatibilitas jadi read-only, `adjust_product_stock` |
| `20260925150000` | `service_spareparts_status` | `cervise_service_spareparts`, `cervise_stock_movements`, `service_number`, `apply_stock_delta`, `consume_service_spareparts`, `return_service_spareparts`, `mark_service_spareparts_kept`, `set_service_status`, `next_service_number`, `caller_branch_role` |
| `20260925160000` | `lock_function_acl` | Revoke `cervise_sale_item_branch` dari anon/authenticated, `caller_branch_role` dari authenticated |

Semua nomor versi di `supabase_migrations.schema_migrations` sudah disamakan dengan
nama file lokal, jadi `supabase db push` tidak akan mencoba apply ulang.

## Aturan baru yang harus dihormati kode

1. **Stok tidak boleh ditulis langsung.** `cervise_products.stock_qty` tidak punya
   grant update untuk `authenticated`. Selalu lewat `adjust_product_stock`
   (manager/frontliner) atau `apply_stock_delta` (internal, tidak terjangkau klien).
2. **Status servis hanya ditulis lewat `set_service_status`.** Modul lama menulis ke
   `repair_orders` (tabel tidak pernah ada). Semua pemanggilan harus memakai label UI
   (`Masuk`, `Dikerjakan`, `Batal`, ...) karena itu nilai yang disimpan di DB.
3. **Sparepart servis hanya lewat `consume_service_spareparts`.** TeknikHANYA boleh
   saat status `Dikerjakan`; gate ini ditegakkan di database, bukan di UI.
4. **`cervise_service_spareparts` dan `cervise_stock_movements` read-only dari klien.**
   Tidak ada policy insert/update/delete untuk `authenticated`.
5. **Pembatalan dengan sparepart terpakai wajib dua langkah:** `return_service_spareparts`
   atau `mark_service_spareparts_kept` (keduanya wajib `reason` minimal 3 karakter),
   baru `set_service_status(..., 'Batal')`. `set_service_status` menolak `Batal` selama
   masih ada line `is_returned = false`.
6. **Harga dalam rupiah, bukan cents.** Schema lama pakai `price_cents`; `cervise_products`
   dan `cervise_service_spareparts` memakai integer rupiah. Jangan bagi 100.

## Idi yang dihapus

- `/app/sparepart` **di-retire**. Route-nya sekarang redirect ke `/app/inventori`.
  `src/app/app/sparepart/actions.ts` dan seluruh `src/components/sparepart/` sudah dihapus.
  Jangan dihidupkan kembali; katalog sparepart dilayani `/app/inventori` di atas `cervise_products`.
- `src/app/app/servis/sparepart-actions.ts` di-rewrite total. Eksporanya:
  `searchSparepartStock`, `getServisSpareparts`, `useSparepartsForServis`,
  `addSparepartsToServis`, `cancelServisWithSpareparts(servisId, decision, reason)`,
  `updateServisStatus(servisId, status, note?)`.
- Tidak ada lagi referensi `inventory_items`, `inventory_stocks`, `inventory_movements`,
  `repair_orders`, `repair_order_items`, `repair_status_history` di seluruh `src/`.

## File yang boleh disentuh sesi lain

- `src/app/app/servis/actions.ts` — nama `service_number` diisi saat create (via
  `next_service_number`), dan `deleteServis` menolak menghapus servis yang masih punya
  sparepart terpakai. Kalau diubah, pertahankan kedua guard itu.
- `src/app/app/servis/page.tsx` — 5 tempat yang dulu menelan error sudah diganti toast
  + Server Action. Jangan dikembalikan ke pola `catch {}` + update state lokal.
- `src/app/app/servis/actions.test.ts` — mock `from()` sudah ditambah case
  `cervise_service_spareparts`.

## Peringatan

- **`profiles.role` itu legacy lowercase** (`master_admin`, `teknisi`, ...) dan punya CHECK
  constraint. Sumber otoritas role adalah **`employees.role`** (uppercase:
  `MASTER_ADMIN`, `ADMIN`, `FRONTLINER`, `TECHNICIAN`) — semua helper RLS membacanya.
  Jangan memfilter role dari `profiles`.
- Stok hanya bisa dikoreksi lewat `adjust_product_stock` dengan alasan
  (`stock_adjust`); setiap perubahan stok menulis baris di `cervise_stock_movements`.
- Leaked-password protection di Supabase Auth masih disabled (setting dashboard).
