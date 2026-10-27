# Pekerjaan yang belum selesai

Ditulis 26 Oktober 2026, setelah seluruh pekerjaan branch `satrioa/fix-servis-kas`
digabung ke `main` (merge commit `60252ca`).

Dokumen ini adalah daftar **pekerjaan yang masih tertunda** dari semua sesi
sebelum ini. Yang sudah selesai dan ter-commit **tidak** dicantumkan di sini;
lihat `git log --oneline -30` untuk itu.

Baca file ini sebelum mulai bekerja. Setiap bagian menyebut apa yang belum jadi,
kenapa penting, dan cara memverifikasinya.

---

## 1. Dua migrasi SQL belum ter-apply ke database

**Status:** BELUM SELESAI. Ini item paling kritis.

Dua migrasi ada di repo tapi **tidak pernah dijalankan** ke database produksi
(`https://yvekuahqzeqxggdyjecc.supabase.co`). Tidak ada `psql`/`sqlcmd` di
mesin ini, jadi belum bisa dipasang manual.

| File migrasi | Yang seharusnya ada | Kondisi sekarang |
| --- | --- | --- |
| `supabase/migrations/20261023120000_branch_scope_and_admin_access.sql` | fungsi `can_access_tenant_branch`, `caller_branch_role`, `can_view_employee`, `can_view_profile` + policy `employees_select` / `profiles_select` | **Hilang.** `POST /rest/v1/rpc/can_access_tenant_branch` balas 404. |
| `supabase/migrations/20261024120000_service_pickup_signature.sql` | kolom `cervise_services.pickup_signature` (text) dan `picked_up_at` (timestamptz) + fungsi `set_service_picked_up` | **Hilang.** Query kolom itu balas 400. |

### Kenapa penting

- `20261023120000` mengatur **isolasi cabang antar tenant**. Tanpa policy
  `employees_select` dan `profiles_select` yang benar, RLS lama masih berlaku
  dan data antar cabang bisa saling terlihat. Ini lubang privasi, bukan soal
  tampilan.
- `20261024120000` menopang fitur **tanda tangan customer saat device diambil**
  (commit `ba28822`). Tanpa kolomnya, alur pengambilan device yang meminta
  tanda tangan akan gagal saat menulis.

### Cara applying

Jangan `supabase db push` buta -- lihat catatan "Migrasi" di `docs/HANDOVER.md`:
beberapa nomor versi lokal tidak sama dengan yang sudah ter-apply, jadi push
buta akan mencoba menerapkan ulang migration yang sudah jalan.

Gunakan **MCP `apply_migration`** seperti yang sudah dilakukan sebelumnya,
supaya penomoran tetap konsisten dengan yang sudah ada di database.

### Verifikasi setelah apply

```powershell
$envMap = @{}
Get-Content ".env.local" | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') { $envMap[$matches[1].Trim()] = $matches[2].Trim() }
}
$url = $envMap['NEXT_PUBLIC_SUPABASE_URL']
$key = $envMap['SUPABASE_SERVICE_ROLE_KEY']
$h = @{ apikey = $key; Authorization = "Bearer $key" }

# 1. fungsi branch scope harus ada (VDN kalau masih ada = belum apply)
Invoke-RestMethod -Uri "$url/rest/v1/rpc/can_access_tenant_branch" `
  -Headers $h -Method Post -ContentType "application/json" -Body "{}"

# 2. kolom signature harus bisa di-select
Invoke-RestMethod -Uri "$url/rest/v1/cervise_services?select=pickup_signature,picked_up_at&limit=1" `
  -Headers $h
```

Kedua perintah harus berhasil tanpa error.

### Catatan

`20261025120000_must_change_password.sql` **sudah** ter-apply (kolom
`profiles.must_change_password` terbaca normal). Yang belum ter-apply hanya
dua di atas.

---

## 2. `main` dan branch sudah di-push ke origin

**Status:** SUDAH SELESAI (27 Oktober 2026).

Seluruh commit sudah ada di origin:

```
cfb0221 docs: catat pekerjaan yang belum selesai untuk agent berikutnya
60252ca merge: satrioa/fix-servis-kas into main
```

Setelah itu sesi lain menambah 6 commit lagi ke `main` dan semuanya sudah
di-pull serta di-push:

```
79582e2 fix: pesan gagal buka port serial tidak lagi menuduh aplikasi lain
6cb89b3 feat: cetak nota thermal, checkout POS, dan penyempurnaan servis
b4b820a style: hilangkan teks & header pembayaran, panel ikut tinggi frame
0006311 style: perbesar popover pembayaran servis (max-w-4xl, tinggi layar)
a81eef6 feat: pembayaran servis memakai panel pembayaran penjualan
6b80cbf fix: sticky promo/payment details in payment panel
```

Branch `satrioa/fix-servis-kas` sudah di-fast-forward ke `main` dan di-push,
jadi kedua checkout sekarang berisi kode yang sama.

Catatan untuk ke depan: `main` adalah branch deploy Vercel Connected, jadi
setiap push ke `main` langsung memicu deploy produksi.

---

## 3. Sesi kas basi: dialog "Saldo Awal" masih tidak bisa menampilkan peringatan

**Status:** BELUM SELESAI (sengaja ditunda, bukan overlooks).

**Yang sudah beres** (commit `705babf`): Home menampilkan banner amber
"Shift 24 Okt masih terbuka" dan judul kartu jadi "Ringkasan Shift (24 Okt)"
ketika `report.date` bukan hari ini. Jendela tanggal shift juga sudah
diperbaiki (`961f38b`), jadi kas manual hari ini **sudah ikut terhitung**.

**Yang belum beres:** `checkOpenCashSession` masih mengembalikan sesi lama
sebagai `current`:

```
src/lib/home/home-data.ts
current: hydrated.find(row => kalenderWIB(new Date(row.openAt)) === today) ?? hydrated[0] ?? null
stale:   hydrated.find(row => kalenderWIB(new Date(row.openAt)) !== today) ?? null
```

Karena `hydrated[0]` jadi fallback-nya, `current` tidak pernah `null` saat
sesi kemarin masih terbuka. Akibatnya `OpeningBalanceDialog` (yang punya
peringatan "Shift X belum ditutup") **tidak pernah muncul**.

### Kenapa belum dikerjakan

Ada index unik satu-sesi-terbuka-per-karyawan. Kalau `current` diubah jadi
hanya sesi hari ini, `OpeningBalanceDialog` akan berpikir "tidak ada sesi"
dan menawarkan membuat sesi baru -- padahal sesi lama masih menahan index,
sehingga pembuatan sesi baru **ditolak database**. Itu deadlock, bukan
perbaikan.

### Saran cara Completion

Refactor jadi dua langkah, bukan mengganti `current`:

1. `checkOpenCashSession` expose `current` (hari ini saja), `stale` (terbuka
   tapi bukan hari ini), dan `active` (sesi yang benar-benar terbuka --
   `current ?? stale`).
2. `OpeningBalanceDialog` kalau `stale` ada, **tampilkan peringatan lebih
   dulu** sebelum menawarkan form saldo awal, dan arahkan pengguna menutup
   shift lama lewat tombol Tutup Toko.
3. Home memakai `active` untuk menentukan sesi mana yang dipakai preview.

Jangan gunakan `current` di tempat yang butuh "sesi yang benar-benar terbuka"
tanpa memeriksa dulu ke `active`.

---

## 4. Aset suara: satu set file `.wav` duplikat

**Status:** RENDAH, tapi biar jelas.

Dua salinan aset suara ada di repo:

- `public/sounds/*.wav` (13 file) -- yang dipakai aplikasi saat runtime
- `docs/Music/*.wav` (13 file) -- file sumber, ditambahkan commit `a466b3d`
  supaya mudah menemukan sumber aslinya

Keduanya identik isinya. `public/sounds/` yang wajib ada -- jangan dihapus.
`docs/Music/` boleh dihapus kalau memang tidak ada rencana untuk mengedit
suara lagi, tapi lebih baik tetap disimpan sebagai sumber.

---

## 5. `npm run lint` masih merah (baseline, bukan regresi)

**Status:** TIDAK PERLU DIPERBAIKI kecuali diminta.

Sekitar 323 error, 260 di antaranya `no-explicit-any` di file yang tidak
disentuh berbulan-bulan (`src/i18n/request.ts`, `src/lib/format.ts`,
`src/components/ui/button.tsx`, dan seterusnya). Ini baseline yang sudah ada
sejak lama, bukan warisan working set baru.

Yang juga sengaja tidak diperbaiki: 4 error di
`src/components/interior/floating-label.tsx` (2 `set-state-in-effect`,
2 `immutability`).

Gerbang sebelum commit yang benar-benar dipakai:

```powershell
npm run typecheck    # wajib hijau
npm test             # wajib hijau
```

Status terakhir: typecheck bersih, **128 file / 1452 tes lulus**.

---

## 6. File junk yang ikut ter-track di git

**Status:** SUDAH SELESAI.

```
.superpowers/brainstorm/1463-1790236347/state/server.pid
.superpowers/brainstorm/1463-1790236347/state/server-stopped
```

Dua ini adalah file state runtime dari tool brainstorm, bukan source code.
Ter-track sejak commit `1a09021` ("commit Recent"). Sudah di-`git rm --cached`
dan `.superpowers/` ditambahkan ke `.gitignore`.

Perhatikan: `docs/superpowers/plans/` **boleh** tetap ter-track -- itu dokumen
rencana yang memang berguna, dan `.gitignore`-nya hanya menyentuh
`.superpowers/` (path berbeda).

---

## 7. Dua server dev lokal

**Status:** informatif.

Dua checkout berjalan lokal, jadi hati-hati jangan salah edit:

| Port | Folder | Branch | Status |
| --- | --- | --- | --- |
| 3001 | `C:\Users\MSI GF63\Documents\RBM\cervise` | `main` | **Yang dipakai user.** Shell baru + sound + perbaikan kas + printer. |
| 3000 | `C:\Users\MSI GF63\orca\workspaces\cervise\fix-servis-kas` | `satrioa/fix-servis-kas` | Worktree. Identik dengan `main` (fast-forward ke `79582e2`). |

Keduanya memakai Supabase project yang sama, jadi datanya identik -- yang
berbeda hanya kode/UI.

`npm` tidak bisa dipanggil langsung dari PowerShell di mesin ini (Execution
Policy memblokir `npm.ps1`). Pakai `cmd /c "npm ..."` atau `npm.cmd`.

---

## 8. Migrasi `must_change_password` -- alur belum diuji end-to-end

**Status:** BELUM SELESAI (perlu verifikasi manual, bukan kode).

Migrasi `20261025120000_must_change_password.sql` sudah TER-APPLY di database
(kolom `profiles.must_change_password` terbaca normal) dan kodenya sudah
merged (`b7438cd`: `src/components/initial-password-dialog.tsx`,
`src/app/app/actions/initial-password.ts`). Tapi belum ada yang **memverifikasi
alur lengkapnya di browser**: login pertama kali dengan password temporary ->
dialihkan ke dialog ganti password -> selesai -> bisa masuk.

Perlu dicek manual di 3001 dengan user yang masih punya password temporary.

---

## 9. Cache build di worktree 3000 masih berisi versi lama

**Status:** SUDAH SELESAI (27 Oktober 2026).

Worktree 3000 sempat `pnpm install` sehingga ada `node_modules/.pnpm` sendiri,
sedangkan `main` memakai `npm`. Akibatnya `ascii-reveal` (dependency GitHub)
tidak ada dan `/app` balas 500. Sudah diperbaiki dengan:

```powershell
cd C:\Users\MSI GF63\orca\workspaces\cervise\fix-servis-kas
npm ci
```

Kalau gejala serupa muncul lagi setelah dependency berubah, ulangi langkah di
atas. Jangan commit `node_modules`; sudah ter-ignore.

---

## Ringkasan prioritas

| # | Item | Dampak | Kesulitan |
| --- | --- | --- | --- |
| 1 | Apply 2 migrasi SQL | **Tinggi** -- kebocoran privasi antar cabang + fitur tanda tangan mati | Sedang (butuh MCP `apply_migration`) |
| 2 | Push `main` ke origin | **Sudah selesai** | - |
| 3 | Verifikasi alur ganti password | Sedang | Mudah (manual) |
| 4 | Refactor sesi kas basi | Sedang -- dialog peringatan mati & ada risiko deadlock | Sulit |
| 5 | Bereskan duplikat `.wav` | Rendah | Mudah |
| 6 | File junk `.superpowers` | **Sudah selesai** | - |
| 7 | Sinkronkan node_modules worktree 3000 | **Sudah selesai** | - |
