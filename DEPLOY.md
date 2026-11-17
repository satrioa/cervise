# Deploy Cervise

Ringkasan gate dan langkah publish. Jalankan berurutan; jangan lewati gate DB.

## 1. Environment

Semua variabel di `.env.example` wajib terpasang di target deploy (Vercel → Project → Settings → Environment Variables).
Untuk local, salin ke `.env.local`.

| Variabel | Wajib | Catatan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ya | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya | key anon/publishable |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ya | dipakai client baru |
| `SUPABASE_SERVICE_ROLE_KEY` | ya | **jangan** diekspos ke client |
| `NEXT_PUBLIC_SITE_URL` | ya | dipakai link notifikasi & redirect email |
| `CRON_SECRET` | ya | header `Authorization: Bearer <secret>` untuk `/api/cron/*` |
| `FONNTE_TOKEN` | ya | notifikasi WhatsApp |
| `META_WA_ACCESS_TOKEN` | ya | token Meta; rahasia, jangan di-commit |
| `META_WA_PHONE_NUMBER_ID` | ya | nomor pengirim Meta |
| `META_WA_TEMPLATE_INVOICE` | ya | template invoice customer |
| `META_WA_TEMPLATE_STATUS` | ya | template status customer |
| `META_WA_TEMPLATE_TECHNICIAN` | ya | template teknisi |
| `OWNER_WHATSAPP_NUMBER` | ya | nomor owner platform |

## 2. Migrasi database

Apply berurutan (Supabase SQL Editor atau `supabase db push`):

1. `supabase/migrations/20261018130000_return_sale_items_atomic.sql`
2. `supabase/migrations/20261018140000_sale_return_finance.sql`
3. `supabase/migrations/20261022094942_login_access_gate.sql`
4. `supabase/migrations/20261023120000_branch_scope_and_admin_access.sql`

Tanpa nomor 4, `sale_number` masih UNIQUE global padahal nomor dibuat per
cabang: cabang kedua yang mulai dari `SLV-2026-0001` gagal dengan
`duplicate key value violates unique constraint "cervise_sales_sale_number_key"`.
Kode aplikasi (scope cabang MASTER_ADMIN) juga bergantung pada migrasi ini.

Verifikasi setelah apply:

```sql
-- Harus muncul return_sale_items_atomic dengan 4 argumen (uuid, uuid, jsonb, date),
-- bukan versi 3 argumen.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'return_sale_items_atomic',
    'get_my_login_access',
    'is_tenant_subscription_active'
  )
order by p.proname;

-- anon tidak boleh punya execute.
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('return_sale_items_atomic', 'get_my_login_access');
```

Pastikan `packages` berisi paket `code = 'trial'` dan `platform_settings` punya satu baris —
trigger `organizations_create_trial_subscription` akan gagal membuat tenant baru tanpa keduanya.

## 3. Gate kode

```bash
npm ci
npm run typecheck
npm test
npm run build
```

`npm run lint` masih memiliki error yang sudah disepakati ditunda; jangan jadikan gate sampai
pembersihannya selesai.

## 4. Smoke test setelah deploy

- [ ] Landing page terbuka, tombol login mengarah ke `/login`.
- [ ] Login tenant **aktif** → masuk dashboard.
- [ ] Login tenant **expired/trial habis** → diarahkan ke halaman subscription (bukan onboarding).
- [ ] Onboarding tenant baru membuat organisasi + trial subscription.
- [ ] Buat penjualan tunai → muncul di arus kas shift.
- [ ] Retur sebagian penjualan tunai → stok kembali, refund tercatat satu kali di kas.
- [ ] Retur penjualan DP → refund tidak melebihi `paid`.
- [ ] Tutup shift → rekap kas cocok dengan saldo awal + penjualan tunai + kas manual − refund.
- [ ] Halaman owner hanya bisa diakses platform admin.
- [ ] `/api/cron/service-notifications` menolak request tanpa `CRON_SECRET`.

## 5. Cron & notifikasi

Workflow `.github/workflows/service-notifications-cron.yml` sudah **diaktifkan** dengan
jadwal `*/5 * * * *` via GitHub Actions (selain `workflow_dispatch` manual).

- Secret yang dibutuhkan: `CRON_SECRET` (Settings → Secrets and variables → Actions).
- URL endpoint masih hardcoded ke `https://cervise.vercel.app`; ganti kalau domain berubah.

Urutan sebelum cron aktif:

1. Buat 3 template di Meta Business Manager — invoice customer, status customer, teknisi —
   dan tunggu status **APPROVED**. Jika cron aktif sebelum template disetujui, Meta
   mengembalikan error 132001 ("Template does not exist"); dispatcher menganggapnya
   terminal per pesan, sehingga notifikasi yang sudah antre gagal permanen setelah
   4 percobaan.
2. Jalankan SQL expiry di bawah.
3. Deploy / pastikan jadwal `schedule` aktif.

SQL ini adalah **purge seluruh antrean** (`where state = 'pending'`), bukan hanya baris
lama — baris pending yang baru saja masuk juga ikut di-set `failed`:

```sql
update public.cervise_notification_outbox
set state = 'failed', last_error = 'expired_before_activation'
where state = 'pending';
```
