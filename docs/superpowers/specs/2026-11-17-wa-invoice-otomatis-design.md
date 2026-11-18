# Invoice WhatsApp Otomatis via Meta Cloud API — Design Spec

Tanggal: 2026-11-17
Status: disetujui untuk diimplementasikan

## 1. Konteks dan tujuan

Saat servis dibuat, customer harus otomatis menerima **invoice berupa pesan teks WhatsApp**, dan teknisi tetap menerima notifikasi "servis baru masuk" seperti perilaku saat ini.

Repo sudah punya pipeline notifikasi servis berbasis outbox + trigger + cron
(`docs/superpowers/specs/2026-09-27-whatsapp-notifikasi-servis-design.md`), tetapi
pengirimannya memakai **Fonnte** dan cron-nya sengaja dimatikan
(`.github/workflows/service-notifications-cron.yml`). User menyediakan token
**Meta WhatsApp Cloud API** dan memilih Meta sebagai provider.

Tujuan: mengaktifkan kembali pipeline yang sudah ada dengan pengirim Meta, tanpa
mengubah trigger database dan tanpa menggagalkan pembuatan servis ketika WhatsApp
sedang bermasalah.

Yang **tidak** termasuk: PDF/attachment, template per tenant, inbound reply/webhook,
status selain yang sudah ada, dan penggantian Fonnte di jalur lain.

## 2. Keputusan yang disetujui

| Keputusan | Nilai | Alasan |
|---|---|---|
| Provider | Meta WhatsApp Cloud API | Token yang disediakan berformat `EAA…` (Meta), bukan Fonnte |
| Pendekatan | Reuse outbox + cron yang sudah ada | Dedupe, retry, dan isolasi baris sudah teruji; tanpa migrasi DB |
| Customer | Teks invoice (template) menggantikan "Servis diterima" | Sesuai permintaan: invoice saat servis dibuat |
| Teknisi | Tetap "Servis baru masuk" | Perilaku lama tidak diubah |
| Isi pesan | Template Meta Utility, bahasa `id` | Business-initiated message wajib memakai template yang disetujui |
| Nomor tujuan | `cervise_customers.phone` dan `profiles.phone` | Sumber yang sudah dipakai dispatcher |
| Keandalan | `skip` bila env kosong; retry/backoff dari dispatcher | Antrean tidak boleh hilang hanya karena konfigurasi belum ada |
| Phone Number ID | `1443653698834770` | Diberikan user; disimpan di env, bukan di kode |

## 3. Arsitektur

```
createServis (INSERT cervise_services)
  └─ trigger cervise_enqueue_service_notification  [sudah ada]
       └─ outbox: 2 baris "servis_created" → customer + teknisi
            └─ cron GET /api/cron/service-notifications  [tiap 5 menit]
                 └─ dispatcher: resolve penerima + susun payload template
                      └─ sendMetaWA → POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
                           └─ state: sent | pending+backoff | failed
```

Tidak ada perubahan database. Trigger
`cervise_enqueue_service_notification` di
`supabase/migrations/20260925290000_service_notification_outbox.sql` sudah
mengantre dua baris pada `AFTER INSERT` dan RPC `claim_service_notifications`
sudah menangani klaim + lease.

## 4. Template Meta

Dibuat di Meta Business Manager, category **Utility**, bahasa **`id`**. Nama
template disimpan di environment variable supaya perubahan nama tidak perlu
mengubah kode.

Variabel ditulis **bernama** (`{{store_name}}`), bukan posisional (`{{1}}`):
form Meta menolak variabel angka, dan variabel juga tidak boleh berada di awal
atau akhir body. Nama di template harus sama dengan `parameter_name` yang
dikirim `service-message.ts`.

### Customer — nilai `META_WA_TEMPLATE_INVOICE`

```
Invoice servis {{store_name}}
No. Servis: {{service_number}}
Perangkat: {{device}}
Keluhan: {{complaint}}
Estimasi biaya: {{estimate}}
Garansi: {{warranty}}
Cek status: {{tracking_url}}.
```

| Variabel | Sumber |
|---|---|
| `{{store_name}}` | `organizations.name` |
| `{{service_number}}` | `service_number` |
| `{{device}}` | `device` |
| `{{complaint}}` | `complaint` |
| `{{estimate}}` | `price_estimasi` diformat Rupiah; fallback "Menunggu pemeriksaan" |
| `{{warranty}}` | `garansi_value` + `garansi_unit`, mis. "3 bulan" |
| `{{tracking_url}}` | URL lacak publik dari `publicLacakUrl()` |

`price` bernilai 0 saat servis dibuat, jadi yang ditampilkan adalah
`price_estimasi`. Field kosong memakai fallback teks, bukan string kosong atau
`undefined`.

### Teknisi — nilai `META_WA_TEMPLATE_TECHNICIAN`

```
Servis baru masuk - {{store_name}}
No. Servis: {{service_number}}
Perangkat: {{device}}
Keluhan: {{complaint}}
Buka: {{service_url}}.
```

| Variabel | Sumber |
|---|---|
| `{{store_name}}` | `organizations.name` |
| `{{service_number}}` | `service_number` |
| `{{device}}` | `device` |
| `{{complaint}}` | `complaint` |
| `{{service_url}}` | URL internal `/app/servis/{id}` |

### Customer status — nilai `META_WA_TEMPLATE_STATUS`

Event `servis_status` (`Selesai` / `Sudah Diambil`) tetap dikirim ke customer.
Tanpa template ini dispatcher akan merendernya dengan template invoice.

```
Status servis {{service_number}}
Toko: {{store_name}}
Perangkat: {{device}}
Status: {{status}}
Kode cek: {{tracking_code}}
Cek status: {{tracking_url}}.
```

`{{store_name}}` nama toko · `{{service_number}}` nomor servis (fallback nama perangkat) ·
`{{device}}` device · `{{status}}` status yang diantrekan (`to_status`) ·
`{{tracking_code}}` kode cek · `{{tracking_url}}` link lacak.

Payload yang dikirim: `messaging_product: "whatsapp"`, `to`, `type: "template"`,
`template: { name, language: { code: "id" }, components: [{ type: "body",
parameters: [{ type: "text", parameter_name, value }] }] }`. Urutan tidak lagi
menentukan karena setiap parameter membawa `parameter_name`.

## 5. Environment

Variabel baru (ditambahkan ke `.env.example`, `DEPLOY.md`, environment Vercel,
dan `.env.local` untuk development):

| Variabel | Wajib | Catatan |
|---|---|---|
| `META_WA_ACCESS_TOKEN` | ya | Token `EAA…`; rahasia, tidak boleh di-commit |
| `META_WA_PHONE_NUMBER_ID` | ya | `1443653698834770` |
| `META_WA_TEMPLATE_INVOICE` | ya | Nama template customer |
| `META_WA_TEMPLATE_TECHNICIAN` | ya | Nama template teknisi |
| `META_WA_TEMPLATE_STATUS` | ya | Nama template status customer |

`NEXT_PUBLIC_SITE_URL` dan `CRON_SECRET` sudah ada dan tetap dipakai.
`WABA_ID` tidak diperlukan untuk mengirim pesan, jadi tidak ditambahkan.

Token yang sudah terekspos di percakapan wajib di-rotate setelah setup selesai.

## 6. Perubahan kode

| File | Perubahan |
|---|---|
| `src/lib/meta-wa.ts` | **Baru.** `sendMetaWA(phone, templateName, parameters)`. `skip: true` bila token/phone number ID/template kosong. `MetaWaError` dengan `reason` dan `scope: "message" \| "infrastructure"`. Mapping error: 190/401/429/5xx/jaringan → `infrastructure`; 100/131026/132001 → `message`. Simpan `wamid` sebagai `provider_message_id`. |
| `src/lib/notifications/service-message.ts` | Tambah `buildCustomerInvoiceParameters(input)`, `buildCustomerStatusParameters(input)`, dan `buildTechnicianJobParameters(input)` yang menghasilkan daftar parameter terurut (bukan string pesan). Perluas `ServiceMessageInput` dengan `priceEstimasi`, `garansiValue`, `garansiUnit`. |
| `src/lib/notifications/dispatcher.ts` | Ganti `sendFonnteWA` → `sendMetaWA`; `resolveRow` mengembalikan `{ target, template, parameters }`; mapping `MetaWaError` untuk `terminal`; tambah `price_estimasi, garansi_value, garansi_unit` ke `select` servis; `providerMessageIdOf` membaca `messages[0].id` dari respons Meta. |
| `src/lib/notifications/dispatcher.test.ts` | Mock `sendMetaWA`, sesuaikan expectation payload & error. |
| `src/lib/notifications/service-message.test.ts` | Uji parameter template: fallback estimasi, garansi, URL, tanpa `undefined`. |
| `src/lib/meta-wa.test.ts` | **Baru.** Uji payload, skip tanpa env, mapping error, ekstraksi `wamid`. |
| `.env.example`, `DEPLOY.md` | Dokumentasi variabel baru. |
| `.github/workflows/service-notifications-cron.yml` | Tambahkan `schedule: - cron: "*/5 * * * *"`; `CRON_SECRET` sebagai GitHub Secret. |

`src/lib/fonnte.ts` dan `src/lib/fonnte.test.ts` dibiarkan utuh; tidak lagi
dipanggil oleh dispatcher. `src/app/api/cron/service-notifications/route.ts`
tidak diubah.

## 7. Rollout

1. Isi env vars di Vercel + `.env.local`; `CRON_SECRET` sebagai GitHub Secret.
2. Buat tiga template di Meta Business Manager dan **tunggu approval**.
3. Implementasi + tes; jalankan `npm test`, `npm run typecheck`, `npm run build`.
4. Expire baris pending lama:
   `update public.cervise_notification_outbox set state = 'failed', last_error = 'expired_before_activation' where state = 'pending';`
5. Aktifkan jadwal cron.
6. Smoke test: buat servis → ≤5 menit → customer terima invoice, teknisi terima
   "servis baru masuk"; cek baris outbox ber-`state = 'sent'`.

Cron **tidak boleh** diaktifkan sebelum template disetujui: error template belum
ada akan menghabiskan empat attempts dan membuat antrean gagal permanen.

## 8. Pengujian

| Target | Yang diuji |
|---|---|
| `src/lib/meta-wa.test.ts` | payload sesuai Graph API; `skip` tanpa env; error 190 retryable, 131026 terminal; `wamid` terbaca |
| `src/lib/notifications/service-message.test.ts` | parameter invoice & teknisi lengkap; fallback saat estimasi kosong; tidak ada `undefined` |
| `src/lib/notifications/dispatcher.test.ts` | dedupe/claim/backoff tetap bekerja; penerima salah nomor tetap terminal; pengirim baru dipanggil |
| Gate existing | `npm test`, `npm run typecheck`, `npm run build` tetap hijau |

Tidak ada integration test database; trigger dijaga oleh test statis migration
yang sudah ada.

## 9. Risiko dan di luar scope

- **Template approval** — pengiriman baru jalan setelah Meta menyetujui template.
- **Token terekspos** — wajib di-rotate; hanya env var yang menyimpannya.
- **Estimasi kosong** — `price_estimasi` nullable; fallback dipakai supaya tidak ada parameter kosong.
- **Nomor teknisi kosong** — baris tetap `failed` dengan `last_error = 'no_phone'` (perilaku lama).
- **Kuota Meta** — tidak ada alarm khusus di spec ini.
- Di luar scope: PDF/attachment, template per tenant, webhook inbound, status lain, penggantian Fonnte di jalur lain.
