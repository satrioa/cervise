# Notifikasi WhatsApp Servis — Design Spec

Tanggal: 2026-09-27
Status: disetujui untuk diimplementasikan

## 1. Konteks dan tujuan

Setiap servis yang dibuat di Cervise harus memberi tahu dua pihak lewat WhatsApp:
**customer** (konfirmasi penerimaan + cara melacak) dan **teknisi** (ada pekerjaan baru).
Perubahan status ke arah "Selesai" atau "Sudah Diambil" juga memberi tahu customer.

Tujuan: menghapus kebutuhan pelanggan menelepon untuk menanyakan status, dan memastikan
teknisi tahu ada antrean tanpa harus membuka aplikasi.

Yang **tidak** termasuk: mengirim dokumen PDF, dan notifikasi untuk status selain dua di atas.

## 2. Keputusan yang sudah dikunci

| Keputusan | Nilai | Alasan |
|---|---|---|
| Provider | Fonnte, satu nomor platform (`FONNTE_TOKEN`) | Sudah terpasang dan dipakai produksi; Meta Cloud API butuh app review dan template review |
| Isi pesan | Teks saja | Menghapus kebutuhan headless PDF renderer |
| Pemicu | `servis_created`, `status` → `Selesai`, `Sudah Diambil` | Dua status itu yang paling dibaca pelanggan |
| Penerima | `servis_created` → customer + teknisi; `status` → customer saja | Teknisi tidak perlu diberi tahu bahwa pekerjaannya sendiri dia yang selesaikan |
| Nomor teknisi | `profiles.phone` (kolom yang sudah ada) | `cervise_services.teknisi_id` menunjuk ke `profiles.id`; kolom kedua hanya menambah risiko sinkronisasi |
| Keandalan | Outbox + trigger database + cron retry | Pembuatan servis tidak boleh gagal karena WhatsApp |
| Anti-spam | Dedupe `servis:<id>:status:<status>` | Satu notifikasi per nilai status, meski ada rework |

## 3. Sumber nomor teknisi

`profiles.phone` sudah ada (`20260925090000_cervise_owner_platform_additive.sql:61`) dan
sudah punya field di form karyawan (`src/components/karyawan/karyawan-form-dialog.tsx:83`).
Persoalannya ada di data dan validasi, bukan di skema.

Kondisi live saat spec ini ditulis:

```
profiles.phone terisi  : 0 baris (100% NULL)
employees per role     : MASTER_ADMIN x 1, TECHNICIAN x 0
```

Artinya tidak ada data legacy yang perlu dimigrasikan, dan sebuah CHECK constraint baru
bisa langsung divalidasi tanpa `NOT VALID`.

Tiga alasan tidak menambah kolom `employees.phone`:

1. `cervise_services.teknisi_id` → `profiles(id)` (`20260925130000:25`), jadi nomor pada
   `profiles` bisa dibaca langsung sedangkan `employees` butuh join tiga tabel.
2. `employees.profile_id` hanya unik per `(organization_id, profile_id)`
   (`20260925090000:106`). Satu orang di dua tenant punya dua baris `employees`, sehingga
   nomor yang sama bisa tersimpan dua kali dan berbeda antar tenant.
3. Jalur edit mandiri sudah memberi akses tulis ke `profiles.phone`
   (`20260925122000:35`, dikunci test di `src/lib/auth/security-migration.test.ts:24-31`).
   Kolom kedua harus disertai aturan prioritas, atau jalur itu harus ditutup.

## 4. Arsitektur

Pemisahan menangkap-event dari merender-pesan, karena URL halaman lacak membutuhkan
origin aplikasi yang tidak diketahui database.

```
createServis  |  set_service_status  |  consume_service_spareparts  |  PATCH langsung
        |
        v
  TRIGGER (metadata saja, tanpa body pesan)
        |  2 baris untuk created, 1 baris untuk status
        v
  public.cervise_notification_outbox
        |
        v
  cron  /api/cron/service-notifications
        |  resolve penerima + render teks + kirim
        v
  Fonnte  ->  sent | skipped | failed (+ retry)
```

Trigger diperlukan karena ada **empat jalur** penulisan status, dan grants masih
mengizinkan `PATCH` langsung: table-level `UPDATE` ke `authenticated` pada
`cervise_services` tidak pernah di-revoke (`20260925130000:240`), berbeda dengan
`cervise_products` yang sudah dikunci di `20260925140000`. Satu-satunya trigger yang ada
di `cervise_services` adalah `updated_at`; tidak ada trigger status.

Akibatnya dispatcher yang mem-poll `cervise_service_logs` akan misses jalur `PATCH`,
karena jalur itu tidak menulis log sama sekali.

## 5. Migration A — `20260925190000_profile_phone_validation.sql`

```sql
alter table public.profiles add constraint profiles_phone_charset
  check (phone is null or (length(phone) <= 24 and phone ~ '^[0-9+\-\s()]+$'));
```

Grant self-service `update (full_name, phone, settings)` tidak diubah. Yang hilang adalah
validasi, bukan akses, dan grant itu dikunci oleh test yang sudah ada.

Constraint ini ditegakkan di database, bukan hanya di server action, karena
`PATCH /rest/v1/profiles` langsung bisa melewati validasi aplikasi.

## 6. Helper bersama — `src/lib/phone.ts`

Aturan yang sudah ada di repo tapi tidak bisa dipakai ulang. Versi di
`src/lib/auth/account-input.ts:92-98` hanya terpakai di satu dari empat penulis nomor, dan
normalisasi `0` ke `62` di `src/app/onboarding/actions.ts:9-14` hanya dipakai untuk nomor
cabang.

| Fungsi | Aturan |
|---|---|
| `normalizePhone62(raw)` | ambil digit; `0...` dan `8...` menjadi `62...`; tolak di luar 9-14 digit |
| `validatePhone(raw)` | `null` atau string kosong menjadi null; maksimal 24 karakter; hanya `/^[0-9+\-\s()]+$/`; awalan `62` atau `08` |
| `toFonnteTarget(raw)` | digit saja, bentuk `62...`, untuk dikirim ke Fonnte |

## 7. Halaman karyawan dan prasyarat dropdown

- Field Telepon wajib saat role `TECHNICIAN`, di client dan server, untuk create dan edit.
- `inputMode="tel"`, `autoComplete="tel"`, placeholder menampilkan format yang diterima.
- Disimpan dalam bentuk kanonik `62...`. `updateProfile` memakai validator yang sama.
- Daftar karyawan memakai kolom Telepon tersendiri, bukan fallback `email ?? phone`
  (`src/components/karyawan/karyawan-list.tsx:133`). Selama ini nomor tidak pernah terlihat,
  sehingga perubahan lewat edit mandiri juga tidak terlihat admin.
- Badge "belum ada nomor" untuk teknisi yang nomornya masih kosong.
- Header CSV diperbaiki: nilai nomor saat ini ditulis di bawah header literal `"Email"`
  (`src/components/karyawan/export-karyawan-csv.tsx:22`).

**Prasyarat — perbaiki `getTeknisi()`.** `src/app/app/servis/actions.ts:100-103` memfilter
`profiles.branch_id` dan `profiles.role = 'teknisi'`, tetapi `createKaryawan`
(`src/app/app/karyawan/actions.ts:136-142`) tidak pernah menulis `profiles.branch_id`.
Akibatnya teknisi yang dibuat lewat UI tidak muncul di dropdown, sehingga tidak bisa dipilih
dan notifikasi ke teknisi tidak akan pernah terkirim. Diubah mengikuti pola yang sudah dipakai
di `src/app/app/laporan/performa/actions.ts:28-32`:

```ts
supabase.from("employees")
  .select("profile_id, profiles(id, full_name, phone)")
  .eq("organization_id", orgId).eq("branch_id", branchId)
  .eq("role", "TECHNICIAN").eq("is_active", true)
```

Nilai dropdown tetap `profiles.id`, karena itu yang direferensikan `teknisi_id`.

## 8. Migration B — `20260925200000_service_notification_outbox.sql`

```sql
create table public.cervise_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  servis_id uuid,
  event text not null check (event in ('servis_created','servis_status')),
  to_kind text not null check (to_kind in ('customer','technician')),
  to_status text,
  dedupe_key text not null unique,
  state text not null default 'pending'
    check (state in ('pending','sent','skipped','failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index cervise_notification_outbox_pending_idx
  on public.cervise_notification_outbox (next_attempt_at)
  where state = 'pending';
```

`servis_id` sengaja tanpa foreign key. `cervise_service_logs` memakai `on delete cascade`
(`20260925130000:72`) sehingga menghapus servis menghapus seluruh riwayatnya, dan outbox
tidak boleh ikut hilang.

Trigger:

- `AFTER INSERT ON cervise_services` → dua baris, `created:customer` dan
  `created:technician` bila `teknisi_id is not null`
- `AFTER UPDATE OF status ON cervise_services` → satu baris ke customer, hanya saat
  `new.status` termasuk `Selesai` atau `Sudah Diambil` **dan** status benar-benar berubah
- `ON CONFLICT (dedupe_key) DO NOTHING` supaya idempoten
- Memeriksa `current_setting('cervise.suppress_notifications', true)`.
  `scripts/seed-demo-data.mjs` menyetelnya di sekitar insert-nya, supaya data demo tidak
  mengirim pesan ke nomor Fonnte asli.
- Isolasi: `enable row level security`, `revoke all from anon, authenticated`,
  `grant ... to service_role`, tanpa policy RLS. Mengikuti pola `public_rate_limits` di
  `20260925170000`.

## 9. Isi pesan

Customer, servis dibuat:

```
Servisin — Servis diterima
No. Servis : SRV-2026-0012
Perangkat  : Xiaomi Redmi 13C
Keluhan    : Layar pecah, Baterai drop
Kode cek   : F5FB0DFCB6
Cek status : {origin}/servisin/lacak/F5FB0DFCB6
```

Teknisi, servis dibuat:

```
Servisin — Servis baru masuk
SRV-2026-0012 · Xiaomi Redmi 13C
Keluhan: Layar pecah, Baterai drop
Buka: {origin}/app/servis/{id}
```

Customer, status kunci:

```
Servisin — Status servis SRV-2026-0012
Perangkat  : Xiaomi Redmi 13C
Status     : Selesai
Kode cek   : F5FB0DFCB6
Cek status : {origin}/servisin/lacak/F5FB0DFCB6
```

Nama toko selalu ada di setiap pesan. Ini mitigasi atas keputusan memakai nomor platform:
pelanggan membalas ke nomor platform, bukan ke nomor toko.

Tidak ada fallback fiktif. Field kosong dihilangkan, bukan dirender sebagai `undefined`,
menikuti `src/components/print-templates.tsx:157`.

Garansi diambil dari `garansi_value` dan `garansi_unit`, bukan teks hardcode.

## 10. Dispatcher

`src/lib/notifications/dispatcher.ts`, dipanggil dari
`src/app/api/cron/service-notifications/route.ts` dengan `runtime = "nodejs"`,
`maxDuration = 60`, dan `isAuthorizedCronRequest` dari `src/lib/cron-auth.ts`.

1. **Claim** baris dengan pola yang sama seperti
   `src/app/api/cron/subscription-renewals/route.ts:77-98`: `update ... set attempts = attempts + 1
   where state = 'pending' and next_attempt_at <= now() ... returning *`, supaya dua worker
   tidak mengirim pesan yang sama.
2. **Resolve penerima saat render**, bukan snapshot saat trigger, supaya perbaikan data
   masih terbaca bila dikirim pada percobaan berikutnya.
   - customer: `cervise_customers.phone`
   - teknisi: `profiles.phone` via `cervise_services.teknisi_id`, hanya bila ada baris
     `employees` yang aktif untuk organisasi cabang tersebut. Teknisi yang sudah
     dinonaktifkan tidak lagi diberi tahu. Nomor kosong → `state = 'skipped'` dengan
     `last_error = 'no_phone'`, tanpa retry, supaya masalah data tetap terlihat di tabel.
3. Nomor diteruskan lewat `toFonnteTarget()`, plus `countryCode=62` ke Fonnte.
4. Hasil kirim disimpan: `sent` dengan `provider_message_id`, atau `failed` dengan
   `last_error`.
5. Backoff `1m → 5m → 30m → 2h`, maksimum 4 percobaan, lalu `failed` permanen.
6. Cap 25 pesan per run, dikirim dalam chunk paralel 5.

Cron `*/5 * * * *` di `vercel.json`. Butuh paket Pro; pada Hobby cadence-nya harus hourly.

## 11. Perbaikan `src/lib/fonnte.ts`

Fonnte membalas HTTP 200 dengan body `{ "status": false }` saat kehabisan kuota:

```json
{ "reason": "insufficient quota", "status": false, "requestid": 2937124 }
```

Kode sekarang hanya mengecek `res.ok`, sehingga kehabisan kuota dilaporkan sukses.

```ts
const payload = await res.json();
if (!res.ok || payload?.status === false) {
  const bodyReason = typeof payload?.reason === "string" ? payload.reason : null;
  const reason = bodyReason ?? `HTTP ${res.status}`;
  // Hanya alasan dari Fonnte yang bisa memvonisi pesan. Tanpa alasan, kita
  // tidak tahu apakah nomornya salah atau tokennya yang kedaluwarsa.
  const messageScoped = bodyReason ? isPermanentReason(bodyReason) : false;
  throw new FonnteError(reason, !messageScoped, messageScoped ? "message" : "infrastructure");
}
```

`FonnteError` membawa tiga hal: `reason` untuk disimpan di `last_error`, `retryable`
untuk keputusan retry, dan `scope` untuk membedakan kegagalan yang memang soal pesan
dari kegagalan infrastruktur. Pemakai harus memutuskan terminal berdasarkan `scope`,
bukan `retryable`: satu token dipakai bersama semua tenant, jadi token kedaluwarsa
membalas 401 untuk setiap pesan sekaligus, dan memperlakukannya terminal akan membuang
semua notifikasi tanpa jejak saat token itu diputar.

Kalau Fonnte tidak menyebutkan alasannya, kegagalannya dianggap infrastruktur, bukan
soal nomor. Alasannya, tanpa alasan kita tidak bisa membedakan nomor yang salah dari
token yang kedaluwarsa, dan mengulanginya lebih aman daripada membuang notifikasi.

| `insufficient quota` dan error jaringan → retryable; `invalid target` dan parameter yang salah → permanen dan tidak di-retry; penolakan token (401/403) → dicoba lagi nanti, bukan terminal, karena pesannya sendiri masih layak.

## 12. Pengujian

| Target | Yang diuji |
|---|---|
| `src/lib/phone.test.ts` | `08...`, `8...`, `62...`, `+62...` jadi satu bentuk kanonik; tolak huruf, terlalu pendek atau panjang, `0` di tengah; `null` lolos |
| `src/lib/auth/profile-phone-migration.test.ts` | CHECK ada; grant self-service tidak berubah; tidak ada kolom phone di `employees` |
| `src/lib/auth/notification-outbox-migration.test.ts` | RLS aktif tanpa policy; revoke anon dan authenticated; grant service_role; `servis_id` tanpa FK cascade; index dedupe unik; kedua trigger ada; signature trigger mengecek suppress GUC |
| `src/lib/fonnte.test.ts` | body `status: false` dianggap gagal; kuota retryable; `invalid target` permanen |
| `src/lib/notifications/service-message.test.ts` | nama toko selalu ada; tidak ada `undefined`; garansi dari data; URL memakai origin yang diteruskan |
| `src/lib/notifications/dispatcher.test.ts` | dedupe; claim tidak dobel; backoff; `skipped` tanpa retry; teknisi nonaktif dilewati; cap per run |
| `src/app/app/karyawan/actions.test.ts` | teknisi tanpa nomor ditolak; admin boleh kosong; nomor tersimpan kanonik |
| test `getTeknisi` | membaca `employees`; filter org, branch, role, aktif; mengembalikan `profiles.id` |
| 378 test yang sudah ada | tetap hijau. Pembuktian bahwa trigger cukup tanpa mengubah kode aplikasi |

Tidak ada integration test database di repo ini, jadi tidak diperkenalkan. Trigger dijaga
lewat test statis migration, seperti empat migration sebelumnya.

## 13. Urutan rollout

1. `src/lib/fonnte.ts` + test — terisolasi, bisa langsung di-merge
2. `src/lib/phone.ts` + test
3. Migration A + test guard, lalu apply
4. Form karyawan, daftar, CSV, `updateProfile`, `onboarding/actions.ts`, `getTeknisi` + test
5. `src/lib/notifications/service-message.ts` + test
6. Migration B + trigger + test guard, lalu apply
7. `src/lib/notifications/dispatcher.ts` + test
8. Route cron + `vercel.json`
9. Suppressor GUC di `scripts/seed-demo-data.mjs`
10. Verifikasi: `npm run typecheck`, `npm test`, `npm run build`, ESLint terarah

**Peringatan urutan:** langkah 4 harus selesai sebelum cron diaktifkan. Kalau tidak, batch
pertama akan menandai semua pesan teknisi sebagai `skipped`.

Setelah setiap migration di-apply, versi di `supabase_migrations.schema_migrations` harus
diselaraskan dengan versi nama file, karena `supabase_apply_migration` mencatat versi
timestamp.

## 14. Di luar scope

- PDF atau dokumen apa pun
- Token Fonnte per tenant
- Saklar on/off notifikasi per tenant
- Inbound reply atau webhook Fonnte
- Status selain `Selesai` dan `Sudah Diambil`
- Audit trail perubahan nomor telepon
- Perbaikan teks hardcode "Garansi 3 bulan" di `src/app/app/servis/page.tsx:344`. Bug
  terpisah yang bertentangan dengan `garansi_value` di database dan "2 Minggu" di struk;
  dilaporkan tapi tidak disentuh di sini.

## 15. Risiko

| Risiko | Mitigasi |
|---|---|
| Satu nomor platform, bukan nomor toko | Disengaja. Nama toko selalu ada di setiap pesan. Keputusan produk |
| Kuota platform dipakai bersama semua tenant | Fonnte mengembalikan `payload.quota` di setiap respons dan `provider_message_id` tersimpan, jadi alarm bisa ditambahkan tanpa perubahan skema. Tidak dibuat di spec ini |
| Nol teknisi dan nol nomor di live DB | Wajib di form plus badge. Urutan rollout menentukan |
| Cron per beberapa menit butuh Vercel Pro | Paket Hobby harus memakai cadence hourly |
| Nomor bisa diubah sendiri tanpa audit | Nomor kini terlihat admin di daftar karyawan. Audit ditunda |

## 16. Keputusan yang tidak diambil di sini

- Apakah perlu alarm kuota. Default: tidak, dengan data yang diperlukan sudah terkumpul.
- Apakah "wajib untuk teknisi" digulirkan terpisah. Default: ya, mendahului aktivasi cron.
