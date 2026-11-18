# Custom WhatsApp Templates Design

Tanggal: 2026-11-18

## Tujuan

Mengganti pengirim notifikasi WhatsApp dari 3 template lama ke 5 template buatan user, termasuk notifikasi buka/tutup shift ke owner tenant.

## Template

| Key | Nama Meta | Bahasa | Placeholder (urutan named parameter) |
|---|---|---|---|
| servis_created_customer | `servis_masuk_v2` | id | customer, device, nomor_servis, complaint, estimated, tenant, cabang |
| servis_status_customer | `servis_siap_diambil_v1` | id | nama_customer, device, service_number |
| servis_created_technician | `servis_baru_teknisi_v1` | en | nama_teknisi, device, complaint, service_number |
| shift_open | `shift_open_v1` | id | tenant, cabang, user-open, date_open, saldo_awal |
| shift_closed | `shift_close_v1` | en | tenant, cabang, date, user-open, shift_open_time, user-close, shift_close_time, saldo_awal, saldo_akhir |

Nama template dibaca dari env global. Env lama tetap jadi fallback untuk 3 template servis. Bahasa hardcoded per template (id/en), dikirim sebagai `template.language.code`.

## Data

- Servis: `tenantName` dari `organizations.name`, `branchName` dari `branches.name`, `customerName` dari `cervise_customers.name`, `nama_teknisi` dari `profiles.full_name`.
- Shift: snapshot disimpan di kolom `payload jsonb` outbox saat enqueue, berisi tenant, cabang, user-open, date_open, shift_open_time, user-close, shift_close_time, saldo_awal, saldo_akhir. Tidak dihitung ulang saat dispatch.
- Penerima shift: `organizations.owner_phone`, fallback `contact_phone`; kosong → skip.
- Semua value kosong dikirim `"-"` agar Meta tidak menolak.

## Perubahan

- `src/lib/notifications/wa-templates.ts` (baru): registry template + builder parameter.
- `src/lib/meta-wa.ts`: `sendMetaWA` menerima `language`.
- `src/lib/notifications/service-message.ts`: input ditambah customerName/tenantName/branchName/technicianName; builder lama diganti.
- `src/lib/notifications/dispatcher.ts`: pakai registry; to_kind owner; select tambahan name/full_name/branch name/payload; template language.
- Migrasi Supabase: event `shift_opened`/`shift_closed`, to_kind `owner`, kolom `payload jsonb`.
- `src/app/app/actions/cash.ts`: enqueue outbox saat buka/tutup shift.
- `.env.example`, tes, dan env Vercel.

## Risiko

- Nama placeholder dengan hyphen harus persis sesuai Meta; kalau ditolak, template harus dibuat ulang dengan underscore.
- Template status nama/bahasa diasumsikan `servis_siap_diambil_v1` / `id`.
- Notifikasi shift tidak terkirim bila owner_phone & contact_phone kosong.
