# Owner Tenant Detail — Polish Design

Tanggal: 2026-11-17
Scope: halaman `/owner/tenants/[id]` (owner platform).

## Masalah

1. Paket + custom price duplikat di tiga tempat: dialog **Perpanjang**, form **Paket, harga & grace**, dan form **Status akses** (yang mengirim ulang paket/harga/grace + status).
2. **Status akses manual** (trial/grace/blocked/suspended/cancelled) bertentangan dengan `accessState` yang sudah dihitung otomatis dari tanggal periode + grace. Menjadi sumber badge mismatch `DB: …`.
3. Kartu Subscription terlalu berat: 6 kotak statistik + 2 form, layout terasa tidak efisien.

## Keputusan

- **Layout A (ringkas)**: satu kartu Subscription berisi 3 metrik utama + baris detail sekunder + satu form pengaturan. Tombol **Perpanjang** di header kartu. Kartu Kontak & branch tetap di kanan.
- **Status akses manual dihapus** dari UI. `updateTenantSubscription` tetap ada di server (bisa dipakai alur lain), tapi tidak dipanggil dari halaman ini.
- **Perpanjang mewarisi paket & harga saat ini**: dialog hanya berisi durasi + catatan verifikasi WhatsApp. `packages` tidak lagi jadi prop dialog.
- **Badge `DB: <status>` tetap ditampilkan** bila status tersimpan beda dengan `accessState` (logika `isMismatch` tidak diubah).

## Perubahan file

### `src/components/owner/subscription-form.tsx`
- Hapus state `status`, `saving: "status"`, `saveStatus`, form kedua, `ShieldAlertIcon`, `LIFECYCLE_STATUSES`, import `updateTenantSubscription`.
- Sisa satu form: paket, custom price, grace days, tombol “Simpan pengaturan” (`adjustTenantSubscription`).
- Judul form: **Pengaturan langganan**.

### `src/components/owner/extend-subscription.tsx`
- Hapus select **Paket** dan input **Custom price** serta state `packageId`, `customPrice`, prop `packages`, import `getEffectiveMonthlyPrice`/`PackageOption`.
- `packageId` dan `customPrice` diambil dari `subscription` (nilai tersimpan), dikirim apa adanya ke `extendTenantSubscription`.
- Preview tetap menghitung periode & total memakai harga efektif dari subscription.
- `Subscription` type ditambah field `custom_monthly_price` (sudah ada di data halaman).

### `src/app/owner/tenants/[id]/page.tsx`
- Susun ulang kartu Subscription:
  - Header: judul + tombol Perpanjang.
  - 3 metrik utama: Paket, Harga / bulan, Akses s/d (atau Trial berakhir).
  - Baris detail sekunder ringkas: periode mulai, grace berakhir, grace days.
  - Badge akses + badge `DB:` (jika mismatch) tetap di atas metrik.
  - `SubscriptionForm` di bawah pemisah, tanpa form status.
- Tidak mengubah `resolveAccessState`, `isMismatch`, atau query data.

## Data & error handling

- Tidak ada perubahan server action, migrasi, atau kontrak RPC.
- `extendTenantSubscription` tetap menerima `packageId` & `customPrice`; klien hanya tidak lagi mengirim pilihan baru.
- Jika `subscription` null: tombol Perpanjang tetap disabled seperti sekarang; form pengaturan memakai paket pertama.

## Testing

- `npm run build`, `npm test`.
- Cek manual: halaman tenant dengan subscription aktif, trial, grace; pastikan badge `DB:` masih muncul saat status DB berbeda; Perpanjang tidak menampilkan field paket/harga; tidak ada lagi form Status akses.

## Risiko

- Menghapus status manual dari UI mengurangi kontrol darurat owner; sesuai keputusan user, akses sepenuhnya mengikuti tanggal + grace.
- Worktree memuat perubahan konkuren lain; commit hanya file yang tercantum di atas.
