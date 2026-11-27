# Notifikasi In-App per Role — Desain

Tanggal: 2026-11-27
Status: desain disetujui, spec menunggu review

## Konteks

Aplikasi saat ini hanya punya notifikasi WhatsApp keluar (outbox + dispatcher cron). Belum ada notifikasi in-app sama sekali: tidak ada tabel, tidak ada server action, tidak ada icon bell di header. User ingin setiap role melihat notifikasi yang relevan dengan pekerjaannya, diakses lewat icon button bell di header.

Keputusan yang sudah disepakati:
- Pengambilan data saat halaman dibuka (fetch on mount), **tanpa** Supabase Realtime dan tanpa polling.
- Teknisi/frontliner hanya melihat notifikasi cabang aktif. Master/Admin melihat lintas cabang dengan label cabang di tiap baris.
- Status baca **per-user**.
- Event ditulis oleh helper di server action, bukan oleh trigger SQL.
- Master/Admin juga menerima event **Sparepart Habis**, selain Stok Alert.

## Tujuan

- Satu tempat (icon bell) untuk notifikasi yang relevan per role.
- Ces event yang diminta: servis baru, servis selesai, pembayaran servis & penjualan, request stok sparepart, stok alert, sparepart habis, buka toko, tutup toko.
- Status baca per akun, dengan jumlah belum dibaca di badge.

## Non-tujuan

- Tidak mengirim WA/push baru — channel WA yang ada tidak diubah.
- Tidak membangun preference center / pengaturan notifikasi per user.
- Tidak membuat halaman kelola notifikasi terpisah.
- Tidak membuat notifikasi realtime.

## Model data

Dua tabel baru di Supabase (migrasi additive):

### `cervise_app_notifications`
- `id uuid primary key default gen_random_uuid()`
- `organization_id uuid not null` — tenant pemilik
- `branch_id uuid` — nullable; null berarti lintas cabang
- `event text not null` — kode event dari katalog
- `audience_roles text[] not null` — role yang boleh melihat
- `title text not null`, `body text not null`
- `href text` — tujuan jika baris diklik
- `created_at timestamptz not null default now()`

Indeks: `(organization_id, created_at desc)` dan `(organization_id, branch_id)`.

### `cervise_app_notification_reads`
- `notification_id uuid not null references cervise_app_notifications(id) on delete cascade`
- `user_id uuid not null` — `auth.uid()`
- `read_at timestamptz not null default now()`
- primary key `(notification_id, user_id)`

RLS:
- Tabel notifikasi: hanya baris dengan `organization_id` yang menjadi tenant user (mengikuti pola migrasi existing).
- Tabel reads: user hanya bisa membaca/menulis baris dengan `user_id = auth.uid()`.

## Katalog event

| Event | Teknisi | Frontliner | Master/Admin | branch_id | Sumber |
|---|---|---|---|---|---|
| `servis_created` — Servis Baru | ya | ya | ya | cabang servis | `src/app/app/servis/actions.ts` → `createServis` |
| `servis_selesai` — Servis Selesai | tidak | ya | ya | cabang servis | `src/app/app/servis/sparepart-actions.ts` → `updateServisStatus` |
| `pembayaran_servis` | tidak | tidak | ya | cabang servis | `src/app/app/servis/actions.ts` → `recordServicePayment` |
| `pembayaran_penjualan` | tidak | tidak | ya | cabang penjualan | `src/app/app/penjualan/actions.ts` → `createSale` (pembayaran tercatat saat transaksi dibuat) |
| `request_stok_sparepart` | tidak | tidak | ya | cabang peminta | `src/app/app/sparepart/central-actions.ts` → `requestStock` |
| `stok_alert` — stok menipis | tidak | tidak | ya | cabang produk | aksi stok inventori (produk, bukan sparepart) |
| `sparepart_habis` | ya | ya | ya | cabang sparepart | aksi stok sparepart; dipicu saat stok mencapai 0 |
| `buka_toko` | tidak | tidak | ya | cabang shift | `src/app/app/actions/cash.ts` |
| `tutup_toko` | tidak | tidak | ya | cabang shift | `src/app/app/actions/cash.ts` |

`audience_roles` berisi kombinasi role di atas. Karena modelnya role-based, "Servis Baru" untuk teknisi berarti semua teknisi di cabang tersebut, bukan hanya teknisi yang ditugaskan. Ini disengaja agar tidak perlu kolom `audience_user_ids`.

## Helper penulisan

Satu fungsi server, misalnya `notifyRoles({ organizationId, branchId, event, roles, title, body, href })`, dipanggil dari server action setelah mutasi berhasil. Helper:
- Mengabaikan kegagalan penulisan notifikasi (fail-soft) agar mutasi utama tidak ikut gagal — dicatat dengan `console.error`.
- Tidak dipanggil dari client component.
- Memakai `getActiveTenant()` untuk mengisi `organization_id` bila tidak diberikan.

## Alur data

1. Mutasi berhasil di server action → helper menulis 1 baris notifikasi.
2. Saat halaman dibuka, komponen bell memanggil server action `getNotifications()`.
3. Server action mengambil `getActiveTenant()`, lalu query: `organization_id = org`, `audience_roles @> [role aktif]`, dan untuk teknisi/frontliner `branch_id = branch aktif`. Master/Admin tidak difilter cabang.
4. Server action menggabungkan status baca dari `cervise_app_notification_reads` untuk `auth.uid()`, mengurutkan belum dibaca lebih dulu lalu `created_at desc`, membatasi 20 baris, dan mengembalikan `unreadCount`.
5. Klik "tandai dibaca" / "tandai semua" memanggil server action yang menulis ke tabel reads dengan `user_id` dari sesi (bukan dari client).

## UI bell

Satu komponen client `NotificationBell`, dipakai di:
- `ShellChrome` (shell legacy / admin),
- header desktop `compact-shell.tsx`, di samping tombol menu,
- header mobile `CompactBottomBar`, di samping tombol grid.

Bentuk: icon button `Bell`/bell-fill dengan badge angka belum dibaca (merah), sembunyi jika 0. Klik membuka popover Base UI: judul "Notifikasi", tombol "Tandai semua dibaca", daftar 20 notifikasi terbaru. Tiap baris: judul, ringkasan, waktu relatif, badge cabang untuk master/admin. Klik baris → tandai dibaca lalu navigasi penuh ke `href` (`window.location.assign`), konsisten dengan strategi navigasi shell yang sudah ada. Empty state: "Belum ada notifikasi". Error: toast, tidak menggantikan seluruh halaman.

## Edge cases

- Notifikasi untuk cabang yang sudah dihapus: `branch_id` sengaja tanpa foreign key cascade agar riwayat tidak hilang (mengikuti pola outbox WA).
- User pindah cabang: karena navigasi penuh, komponen bell mount ulang dan query ulang.
- Role berubah: sama, diambil dari sesi server saat fetch — bukan dari prop client.
- Mutasi utama gagal: helper tidak dipanggil.
- Penulisan notifikasi gagal: mutasi tetap sukses, error hanya dicatat.

## Testing

- Test source-text/migrasi untuk keberadaan dua tabel, RLS, dan indeks.
- Test helper `notifyRoles`: fail-soft, tidak menulis jika org/branch tidak ada.
- Test `getNotifications`: filter role + cabang, urutan unread-first, batas 20, unreadCount.
- Test menandai dibaca: hanya `auth.uid()` yang ditulis, tidak bisa menandai notifikasi user lain.
- Test regresi UI: bell hadir di tiga lokasi header dan memakai popover, bukan halaman baru.

## Risiko / keterbatasan

- Karena penulisan lewat server action, perubahan langsung ke database (mis. PATCH manual ke `cervise_services`) **tidak** menghasilkan notifikasi in-app. Ini celah yang sudah disadari dari pola outbox WA; jika nanti dibutuhkan, baru tambahkan trigger.
- Fetch on mount berarti notifikasi yang terjadi saat user sedang diam di satu halaman tidak muncul sampai halaman dibuka ulang. Ini trade-off yang disetujui.
- Model role-based tidak mendukung notifikasi per-user (mis. hanya teknisi yang ditugaskan) tanpa tambahan kolom.
