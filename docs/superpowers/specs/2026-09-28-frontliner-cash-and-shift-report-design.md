# Kas FRONTLINER dan Laporan Shift — Design Spec

Tanggal: 2026-09-28
Status: disetujui untuk diimplementasikan
Bergantung pada:
- `2026-09-28-role-scoped-access-admin-design.md` (Spec 1)
- `2026-09-28-compact-shell-technician-dashboard-design.md` (Spec 2)

Spec ini mengaktifkan `FRONTLINER` sebagai role dengan tanggung jawab kas harian,
dan menambah Laporan Shift yang bisa dibaca pemilik usaha.

## 1. Konteks dan tujuan

`FRONTLINER` hari ini bisa membuat penjualan dan mencatat transaksi, tapi tidak
ada konsep saldo kas harian. Kasir mencatat pemasukan dan pengeluaran, tetapi
tidak ada yang meminta saldo pembuka saat shift dimulai, tidak ada yang meminta
saldo penutup saat shift berakhir, dan tidak ada catatan kas manual (koreksi,
setoran, pengeluaran kecil) yang terpisah dari transaksi penjualan.

Tiga kebutuhan:

1. **Saldo awal wajib saat login.** Setelah login berhasil, `FRONTLINER` harus
   mengisi saldo awal kas. Wajib — tanpa itu, laporan shift tidak punya pijakan.
2. **Saldo masuk/keluar manual.** Koreksi, setoran owner, pengeluaran kecil di
   luar penjualan.
3. **Tutup toko.** Tombol di header dashboard, dengan preview laporan shift
   terlebih dulu, lalu saldo akhir dicatat dan selisihnya dihitung.

Ditambah satu halaman laporan:

4. **Laporan Shift.** Gabungan Laporan Servis + Laporan Penjualan + kas manual
   untuk satu hari shift, dibuat otomatis begitu saldo awal diisi, dengan
   tombol download (PDF/Excel) dan copy as text. Diakses `MASTER_ADMIN` dan
   `ADMIN`.

Yang **tidak** termasuk: inventaris uang fisik (uang receivable, transfer antar
rekening), dan approval shift oleh manager.

## 2. Keputusan yang sudah dikunci

| Keputusan | Nilai | Alasan |
|---|---|---|
| Sumber kas manual | Kolom `source` di `finance_tx`, **bukan** tabel terpisah | Kalau tabel terpisah, Laporan Shift menggabungkan 3 sumber dan angka kas bisa tidak cocok dengan `/app/keuangan/arus-kas` |
| Timing generate | Record sesi dibuat saat saldo awal; laporan **dihitung live** | Saat saldo awal diisi belum ada transaksi — tidak ada yang bisa di-generate |
| Snapshot | `snapshot jsonb` disimpan saat tutup toko | Laporan historis tidak boleh berubah retroactive kalau ada koreksi setelah shift ditutup |
| Tanggal penjualan | `cervise_sales.kas_date` | Konsisten dengan `laporan/penjualan/actions.ts:192-193` yang sudah memakainya |
| Tanggal servis | `cervise_services.created_at` | `cervise_services` tidak punya `kas_date`; `laporan-servis.ts:4` sudah memakainya |
| Pengait servis ↔ penjualan | Kolom baru `cervise_sales.servis_id` | Tanpa itu, servis yang dibayar lewat `PaymentDialog` terhitung dua kali (§5.2) |
| Download | PDF + Excel, satu klik | `xlsx` sudah jadi dependency dan dipakai di `transaksi-export-dialog.tsx:100`; PDF lewat pola `print-templates.tsx` |
| Akses Laporan Shift | `MASTER_ADMIN` + `ADMIN` saja | `FRONTLINER` menutup shift-nya sendiri; tidak perlu melihat shift orang lain |
| Shell | Pakai shell `compact` Spec 2 | Konten berbeda, kerangka sama |
| To-Do FRONTLINER | **Tidak ada** | Today Schedule-nya diganti antrean servis |
| Tombol Tutup Toko | Di header dashboard | Diminta; header compact Spec 2 |

### 2.1 Trade-off yang disadari

Penjualan memakai `kas_date`, yang bisa diisi kasir dengan tanggal berbeda dari
hari transaksi. consequence: penjualan yang di-backdate masuk ke laporan shift
yang salah — dan `/app/laporan/penjualan` punya masalah yang sama karena juga
memakai `kas_date`. Konsistensi dengan laporan yang ada dianggap lebih penting
daripada akurasi per hari kerja. Alternatifnya kolom `shift_id` ditolak karena
menyentuh semua creation flow penjualan.

## 3. Tabel

### 3.1 `cervise_cash_sessions`

```sql
create table if not exists public.cervise_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  employee_id uuid not null references public.profiles(id),
  open_at timestamptz not null default now(),
  opening_balance integer not null check (opening_balance >= 0),
  closed_at timestamptz,
  closing_balance integer check (closing_balance >= 0),
  expected_cash integer,
  variance integer,
  snapshot jsonb,
  created_at timestamptz not null default now()
);
```

`amount` dan `finance_tx.amount` keduanya `integer`, jadi saldo tidak pecahan
rupiah. `expected_cash` dan `variance` nullable karena hanya diisi saat ditutup.

`variance` = `closing_balance - expected_cash`. Nilai **negatif** berarti kas fisik
kurang dari seharusnya; positif berarti lebih.

Constraint integritas:

```sql
alter table public.cervise_cash_sessions
  add constraint cervise_cash_sessions_closed_check
  check (
    (closed_at is null and closing_balance is null and snapshot is null)
    or
    (closed_at is not null and closing_balance is not null and snapshot is not null)
  );
```

Sesi yang sudah tertutup tidak bisa kembali terbuka tanpa update eksplisit.

Index unik: satu sesi terbuka per karyawan:

```sql
create unique index if not exists cervise_cash_sessions_open_unique
  on public.cervise_cash_sessions(employee_id)
  where closed_at is null;
```

Ini yang membuat "wajib isi saldo awal" bisa ditegakkan database, bukan hanya
tombol UI.

### 3.2 `finance_tx.source`

```sql
alter table public.finance_tx
  add column if not exists source text not null default 'transaksi'
  check (source in ('transaksi', 'kas_manual', 'penyesuaian'));
```

### 3.2b `cervise_sales.servis_id`

```sql
alter table public.cervise_sales
  add column if not exists servis_id uuid
    references public.cervise_services(id) on delete set null;

create index if not exists cervise_sales_servis_idx
  on public.cervise_sales(servis_id) where servis_id is not null;
```

Pengait yang mencegah `PaymentDialog` (§4.4) dan baris servis terhitung dua kali
di Laporan Shift. Alasan lengkap di §5.2. Kolom nullable; baris lama dan
penjualan barang tidak tersentuh.

Tidak ada view kompatibilitas untuk `cervise_sales` — tiga view yang ada hanya
`cervise_branches`, `cervise_finance_tx`, `cervise_spareparts`
(`20260925130000:244-248`). Kolom baru tidak perlu masuk view apa pun.

Kolom ini harus ikut di view `cervise_finance_tx`
(`20260925130000_cervise_operational_schema.sql:246-247`) supaya klien yang
membaca view bisa membedakan sumber:

```sql
create or replace view public.cervise_finance_tx
  with (security_invoker = true) as
select id, branch_id, servis_id, type, amount, kas_date, metode, keterangan,
       description, created_by, created_at, source
  from public.finance_tx;
```

`grant select` pada view sudah ada (line 252) dan tidak perlu diulang —
`CREATE OR REPLACE VIEW` mempertahankan grant yang melekat pada view.

`kas_manual` = yang diinput frontliner. `penyesuaian` = koreksi yang dilakukan
admin setelah shift ditutup. `transaksi` = default, semua baris yang sudah ada.

### 3.3 RLS

`cervise_cash_sessions` — staff hanya boleh sesi sendiri, manager boleh semua
sesi cabang:

```sql
create policy cervise_cash_sessions_select on public.cervise_cash_sessions
  for select to authenticated
  using (
    public.is_platform_admin()
    or (
      public.can_access_tenant_branch(branch_id)
      and (
        employee_id = auth.uid()
        or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN'])
      )
    )
  );
```

Write policy: `FRONTLINER` hanya boleh menutup sesi sendiri; `MASTER_ADMIN` dan
`ADMIN` boleh menutup sesi siapa pun di cabang mereka (koreksi shift tertinggal).

`finance_tx` — `finance_insert` sudah mengizinkan `FRONTLINER`
(`20260925122000_harden_auth_rls.sql:267-269`), jadi kas manual tidak butuh
perubahan policy. Yang ditambahkan hanya kolom `source`.

`finance_update` dan `finance_delete` tetap `MASTER_ADMIN`/`ADMIN` saja
(line 270-276) — frontliner tidak bisa mengoreksi barisnya sendiri. Koreksi
sebelum tutup toko dilakukan dengan membuat baris `penyesuaian` baru, bukan
mengubah baris lama.

## 4. Alur

### 4.1 Saldo awal (wajib)

```
Login FRONTLINER
  → CompactShell mount
  → checkOpenCashSession()
  → belum ada sesi terbuka untuk hari ini?
      ya  → <OpeningBalanceDialog />  (wajib, belum bisa ditutup)
      tidak → dashboard
```

Pintasan modal: `Escape` dan klik backdrop **tidak** menutup dialog. Sesi
hanya bisa ditutup lewat tombol di dashboard.

Dialog berisi:
- Nama karyawan, nama cabang, tanggal
- Saldo awal (input angka, wajib, ≥ 0)
- Catatan opsional

Setelah tersimpan, sesi dibuat dengan `open_at = now()` dan `opening_balance`
dari input. **Laporan tidak dibuat di sini** — sesi ini adalah record; laporan
dihitung dari sesi tersebut.

Kalau ada sesi terbuka dari shift **kemarin** yang belum ditutup (lupa tutup
toko), dialog menampilkan peringatan: "Shift tanggal {tanggal} belum ditutup"
dengan tombol Lihat → `/app/laporan/shift`. Sesi baru tetap boleh dibuat;
`cervise_cash_sessions_open_unique` mencegah ini, jadi dialog memaksa user
menutup shift lama dulu.

### 4.2 Kas manual

Tombol `+ Transaksi` di header dashboard, atau dari menu **Transaksi** di
sidebar compact.

Dialog: arah (Pemasukan / Pengeluaran), nominal, keterangan (wajib), tanggal
default hari ini.

Menulis ke `finance_tx` dengan `source = 'kas_manual'`, `created_by = auth.uid()`.
Aturan `finance_insert` yang sudah ada mengizinkan `FRONTLINER`.

### 4.3 Tutup toko

```
Klik "Tutup Toko" (header dashboard)
  → <ClosingDialog />
      Tahap 1 — Preview Laporan Shift  (live, dari open_at s/d now)
      Tahap 2 — Saldo akhir
      Tahap 3 — Konfirmasi + simpan snapshot
```

Tahap 1 menampilkan laporan shift lengkap (§5). Saldo akhir belum diminta —
user harus melihat angkanya dulu.

Tahap 2: input saldo akhir fisik.

Tahap 3: sistem menghitung
`expected_cash = opening_balance + penjualan_lunas + kas_masuk - kas_keluar`
dan menampilkan `variance = closing_balance - expected_cash`. Keputusan:

| Nilai | Tampilan |
|---|---|
| `0` | "Saldo sesuai" (hijau) |
| `< 0` | "Kurang Rp {n}" (merah) + wajib alasan |
| `> 0` | "Lebih Rp {n}" (kuning) + opsional alasan |

Alasan disimpan di `snapshot.reason`, bukan kolom terpisah.

Setelah disimpan, `closed_at`, `closing_balance`, `expected_cash`, `variance`,
`snapshot` terisi. Sesi tidak bisa ditutup lagi.

### 4.4 Pembayaran servis

Dari antrean servis di dashboard frontliner, tombol **Bayar** membuka
`<PaymentDialog />`: keranjang (item servis + harga + metode pembayaran) dan
tombol konfirmasi.

`FRONTLINER` **tidak boleh** memakai `payService()` di
`src/app/app/servis/actions.ts:489` — aksi itu dijaga
`canAccess(role, "keuangan_transaksi")`, dan `MENU_ACCESS` untuk kunci itu
hanya `MASTER_ADMIN` + `ADMIN` (`src/lib/rbac.ts:22`). Spec 1 §3.4 mempertahankan
itu lewat `CAPABILITY_ACCESS`, jadi caption `canAccess("FRONTLINER",
"keuangan_transaksi") === false` di `src/lib/rbac.test.ts:12` **tidak berubah**.

Konsekuensinya, `PaymentDialog` Spec 3 memakai jalur **`cervise_sales`**, bukan
`finance_tx`: menambah item penjualan yang terhubung ke servis. Jalur itu sudah
dilewati `FRONTLINER` setiap hari — `canAccess("FRONTLINER", "penjualan")` bernilai
`true` (`rbac.ts:17`, dibuktikan `rbac.test.ts:16`) dan `cervise_sales_insert`
mengizinkan `FRONTLINER`
(`20260925130000_cervise_operational_schema.sql:216`).

Jadi `PaymentDialog` adalah UI untuk alur penjualan yang sudah ada, bukan gerbang
role baru. `cervise_sales` yang dihasilkan otomatis dari satu item servis masuk ke
Laporan Shift lewat baris `sales` (§5.1), bukan lewat `cashTx`.

`PaymentDialog` **tidak membuat** baris `finance_tx`. Kalau ia juga membuatnya,
penjualan akan terhitung dua kali di Laporan Shift — sekali dari `sales`, sekali
dari `cashTx`. Kombinasi keduanya adalah satu-satunya jalur untuk pembayaran
servis.

## 5. Laporan Shift

### 5.1 Sumber data

| Bagian | Tabel | Filter |
|---|---|---|
| Servis | `cervise_services` | `branch_id`, `created_at >= open_at AND created_at < close_at` |
| Penjualan | `cervise_sales` | `branch_id`, `kas_date = tanggal shift` |
| Kas manual | `finance_tx` | `branch_id`, `source = 'kas_manual'`, `kas_date = tanggal shift` |

`teknisi_id` sengaja tidak dipakai sebagai filter — Laporan Shift adalah laporan
kas toko, bukan laporan performa teknisi. Filter teknisi ada di
`/app/laporan/performa`.

Servis dipisahkan oleh `open_at`/`close_at` karena `cervise_services` punya
`created_at timestamptz` (`20260925130000:41`) yang menyimpan jam. Penjualan dan
kas manual **tidak** bisa — `kas_date` bertipe `date`
(`20260925130000:95` dan `schema.sql:69`), jamnya hilang.

Akibatnya, penjualan dan kas manual mencakup seluruh transaksi kalender hari itu,
termasuk yang terjadi sebelum shift dibuka (misalnya koreksi pagi dari kasir
sebelumnya) dan setelah shift ditutup. Servis justru dipotong tepat pada jam
buka/tutup. Perbedaan ini disadari dan diterima; menyamakan keduanya butuh kolom
timestamp di `finance_tx` dan `cervise_sales`, yang berarti mengubah tiga
creation flow.

Batas atas `close_at` bersifat `<`, bukan `<=`, supaya servis yang tercatat tepat
di detik penutupan tidak terhitung dua kali bila `close_at` diisi ulang.

### 5.2 Struktur laporan

```
LAPORAN SHIFT
Toko: {cabang}          Shift: {tanggal}
Frontliner: {nama}      Jam: {open_at} – {close_at}

── SALDO AWAL ─────────────────
Saldo awal                    Rp {opening}

── LAYANAN SERVIS ────────────
{device} · {service_number}    Rp {price}     [status]

── PENJUALAN ──────────────────
{sale_number} · {payment_method} Rp {total}   [lunas/belum]

── TRANSAKSI KAS MANUAL ───────
Pemasukan  {keterangan}        Rp {amount}
Pengeluaran {keterangan}       Rp {amount}

── REKAP ─────────────────────
Omzet servis                  Rp {total_servis}
Omzet penjualan               Rp {total_penjualan}
{+/-} Transaksi manual         Rp {total_manual}
─────────────────────────────────────
{+/-} Total                    Rp {expected}
{+/-} Saldo akhir fisik        Rp {closing}
{+/-} Selisih                  Rp {variance}
```

`expected` = `opening + total_servis_lunas + total_penjualan_lunas + manual_net`.

Hanya penjualan `payment_status = 'lunas'` yang dihitung. Kolom itu CHECK-nya
`not null default 'belum_bayar'` (`20260925130000:92-93`) dan tidak punya CHECK
constraint nilai, jadi filter `= 'lunas'` ditulis eksplisit: nilai selain
`lunas` diperlakukan sebagai belum masuk, bukan diabaikan diam-diam.

Untuk servis, yang dihitung adalah `cervise_services.price` untuk status
`Selesai` dan `Sudah Diambil` — himpunan yang sama dengan `DONE` di
`src/lib/operational/laporan-servis.ts:32`. Servis `Batal` tidak dihitung, dan
`price` bertipe `integer` dengan `check (price >= 0)`
(`20260925130000:26`).

**Risiko domain yang harus diketahui.** Status `Selesai` berarti selesai
dikerjakan, bukan sudah dibayar — `cervise_services` tidak punya kolom
pembayaran sama sekali. Laporan Shift karena itu menganggap setiap servis
`Selesai`/`Sudah Diambil` sudah masuk kas. Kalau cabang memakai DP atau
pelunasan terpisah, `expected` akan terlalu tinggi.

Tiga konsekuensi yang harus disepakati sebelum implementasi:

1. Kalau frontliner membuat **keduanya** — `cervise_services.status = 'Selesai'`
   dan `cervise_sales` lewat `PaymentDialog` — penjualan terhitung dua kali.
2. Kalau frontliner membuat **hanya `cervise_sales`**, servis yang dikerjakan tapi
   belum dibayar tidak muncul di laporan sama sekali.
3. Yang dipakai adalah opsi kedua dengan konsekuensi satu diperbaiki: baris
   `sales` yang `notes`-nya menandai `servis_id` tetap dihitung **sekali**,
   dan baris `cervise_services` yang punya `cervise_sales` terkait
   **dihitung lewat `sales`, bukan lewat `services`**.

Aturan ini butuh kolom pengait. `cervise_sales` punya `servis_id`? Tidak —
`finance_tx` yang punya (`20260925130000:142` membuat index
`finance_tx_servis_idx`), `cervise_sales` tidak. Yang punya adalah
`cervise_sales_items`, yang tidakJmempunyai `servis_id` juga.

Artinya **menambah kolom `servis_id uuid references cervise_services(id)` ke
`cervise_sales`** adalah bagian dari spec ini — nullable, karena penjualan barang
tidak terkait servis. Aturan §5.2 jadi:

```
total_servis = Σ price dari servis Selesai/Sudah Diambil
               yang TIDAK punya cervise_sales terkait
total_penjualan = Σ total dari cervise_sales lunas pada tanggal itu
```

Tidak ada double counting, dan servis yang dibayar lewat `PaymentDialog` tetap
terhitung lewat `sales`. Kolom baru ini nullable, jadi penjualan barang tetap
berfungsi tanpa perubahan.

Kolom ini **tidak** termasuk dalam scope minimal: kalau tim memutuskan
`PaymentDialog` tidak dipakai — yaitu frontliner mencatat pembayaran lewat
`finance_tx` `source = 'kas_manual'` — kolom itu tidak perlu. Spec ini memilih
`PaymentDialog` karena permintaan eksplisit (tombol Bayar dengan keranjang), jadi
kolomnya diperlukan, dan `buildLaporanShift()` diuji untuk kedua jalur tersebut.

### 5.3 Fungsi murni

`src/lib/operational/laporan-shift.ts` — mengikuti pola
`src/lib/operational/laporan-penjualan.ts`:

| Fungsi | Keluaran |
|---|---|
| `buildLaporanShift({ session, services, sales, cashTx, now })` | Objek laporan lengkap dengan semua baris dan rekap |
| `formatShiftAsText(report)` | String plain text untuk "copy as text" |
| `formatShiftRowsForSheet(report)` | Array-of-array untuk XLSX |

Semua menerima array datar, tanpa Supabase. `now` selalu parameter — tidak
`new Date()` di dalam fungsi, supaya hasil deterministik dan bisa diuji.

### 5.4 Snapshot

Saat tutup toko, `buildLaporanShift()` hasilnya disimpan ke `snapshot`:

```json
{
  "schemaVersion": 1,
  "branchName": "Cabang Pusat",
  "employeeName": "Rina",
  "date": "2026-09-28",
  "openAt": "2026-09-28T08:00:00Z",
  "closingAt": "2026-09-28T17:30:00Z",
  "openingBalance": 250000,
  "closingBalance": 248500,
  "expectedCash": 250000,
  "variance": -1500,
  "reason": "SelisihWOWO karena tukar uang 500",
  "services": [ ... ],
  "sales": [ ... ],
  "cashTx": [ ... ],
  "totals": { "services": 0, "sales": 0, "manualIn": 0, "manualOut": 0 }
}
```

`schemaVersion` supaya perubahan format di masa depan bisa dideteksi. Snapshot
adalah sumber untuk download dan copy as text — **tidak** dihitung ulang dari
data mentah, supaya laporan yang sudah diunduh tidak berubah isinya.

### 5.5 Halaman `/app/laporan/shift`

Daftar sesi, terbaru di atas. Kolom:

| Kolom | Sumber |
|---|---|
| Tanggal | `snapshot.date` |
| Cabang | `branch.name` |
| Frontliner | `employee.full_name` |
| Saldo awal | `snapshot.openingBalance` |
| Saldo akhir | `snapshot.closingBalance` |
| Selisih | `snapshot.variance` |
| Action | Download · Copy as text |

Kolom Action **hanya untuk sesi yang sudah tertutup** (`closed_at` bukan null).
Sesi terbuka tidak punya laporan final.

**Download** membuka `<ShiftDownloadDialog />`: satu klik mengunduh PDF,
satu klik mengunduh Excel. PDF dibangun dari snapshot sebagai HTML yang
dicetak (`window.print()`), mengikuti pola `print-templates.tsx`
(`renderJetHtml` line 270). Excel dibangun dengan `XLSX.utils.aoa_to_sheet`
lalu `XLSX.writeFile` — pola yang sudah ada di `transaksi-export-dialog.tsx:96-100`.

**Copy as text** memakai `navigator.clipboard.writeText(formatShiftAsText(report))`
dengan fallback `document.execCommand("copy")` untuk browser tanpa Clipboard API.
Konfirmasi lewat `sonner`.

Untuk sesi yang belum ditutup, tombol **Lihat** membuka preview live dengan
layout yang sama seperti di dialog tutup toko.

## 6. Dashboard FRONTLINER

Shell compact Spec 2, konten berbeda:

```
{label tanggal}                    Tutup Toko
Selamat pagi, {nama}.
{n} servis menunggu pembayaran.

4 shortcut
───────────────────────────────
grid lg:grid-cols-[3fr_2fr]
  Kiri: Tugas & Antrean          Kanan: Antrean Servis Masuk
  (To-Do)                        + tombol Bayar
───────────────────────────────
4 KPI: Servis Masuk · Diambil · Batal · Proses Pengerjaan
```

**Kolom kiri — Antrean Tugas.** `FRONTLINER` **tidak** punya To-Do pribadi
(tabel `cervise_staff_todos` ada, tapi role ini tidak mendapat akses ke sana —
To-Do itu khusus `TECHNICIAN`, Spec 2 §6). Kolom ini menampilkan tiga daftar
ringkas, masing-masing dengan jumlah di badge dan baris teratas tiga:

| Judul | Isi |
|---|---|
| Belum dibayar | `cervise_services` hari ini, belum punya `cervise_sales` terkait |
| Menunggu pengerjaan | status `Masuk` atau `Diagnosa` hari ini |
| Siap diambil | status `Selesai` hari ini |

Tiap baris diklik → `/app/servis/[id]`. Jumlah lengkap ada di link "Lihat semua"
yang menuju ke `/app/servis` dengan filter status terkait.

**Kolom kanan — Antrean Servis Masuk.** Daftar servis hari ini yang belum punya
`cervise_sales` terkait, dengan tombol **Bayar** di setiap baris. Baris diklik (di
luar tombol) → `/app/servis/[id]`.

**Empat KPI:**

| KPI | Definisi | Sumber |
|---|---|---|
| Servis Masuk | `cervise_services` dibuat hari ini | `created_at` |
| Diambil | status `Sudah Diambil`, `created_at` hari ini | CHECK constraint, `20260925130000:24` |
| Batal | status `Batal`, `created_at` hari ini | idem |
| Proses Pengerjaan | status `Masuk` + `Diagnosa` + `Menunggu Konfirmasi` + `Menunggu Sparepart` + `Dikerjakan`, `created_at` hari ini | idem |

Status `Dijemput` **tidak ada** di CHECK constraint
(`20260925130000:24`) — daftar status sebenarnya adalah `Masuk`, `Diagnosa`,
`Menunggu Konfirmasi`, `Menunggu Sparepart`, `Dikerjakan`, `Selesai`,
`Sudah Diambil`, `Batal`. "Proses Pengerjaan" memakai lima status di antaranya.

Keempat KPI dihitung oleh `src/lib/operational/dashboard.ts` yang sudah ada
(`summarizeDashboard`, line 158) dan dipakai `getDashboardData()`. Spec 3
memanggilnya, tidak menulis ulang — dengan penyesuaian nama field agar mengikuti
status yang sebenarnya.

**Shortcut (4):**

| Label | tujuan |
|---|---|
| Servis baru | `/app/servis/baru` |
| Penjualan baru | `/app/penjualan` |
| Input kas | membuka `AdjustmentDialog` |
| Laporan shift | `/app/laporan/shift` — **tidak muncul** di sidebar compact `FRONTLINER` (menu di §7 tidak memuatnya, sesuai Spec 1 §3.2); yang punya akses di sidebar adalah `MASTER_ADMIN`/`ADMIN` |

## 7. Menu FRONTLINER

Dari manifest Spec 1 §3.2, entri yang memuat `"compact"` di `surface` **dan**
`FRONTLINER` di `roles`:

| href | Group |
|---|---|
| `/app` | Dashboard |
| `/app/servis` | Operasi |
| `/app/customer` | Operasi |
| `/app/penjualan` | Operasi |
| `/app/inventori` | Operasi |
| `/app/garansi` | Operasi |
| `/app/analitik-servis` | Laporan |
| `/app/laporan/servis` | Laporan |
| `/app/laporan/keuangan` | Laporan |
| `/app/laporan/penjualan` | Laporan |
| `/app/keuangan/transaksi` | Keuangan |
| `/app/keuangan/arus-kas` | Keuangan |

Sidebar compact Spec 2 (§4.3) memfilter `NAV_ENTRIES` dengan
`entry.surface.includes("compact") && entry.roles.includes(actor.role)`, jadi
tidak ada konfigurasi per-role di dalam komponen. Untuk `TECHNICIAN` hasilnya
7 entri (§4.3 Spec 2); untuk `FRONTLINER` 12 entri seperti tabel di atas, dengan
group `Keuangan` tambahan. Group compact yang dipakai: `Operasi`, `Laporan`,
`Keuangan`. `Akun` (`/app/pengaturan/profil`, `/lokalisasi`) **tidak** dirender
di sidebar compact — kedua halaman itu tetap diakses lewat ikon pengaturan di
footer, seperti di `AppShell`.

## 8. Server action

`src/app/app/actions.ts` (tambahan):

```ts
checkOpenCashSession()   // sesi terbuka employee_id = auth.uid(), atau null
openCashSession({ openingBalance, note })   // insert
closeCashSession({ sessionId, closingBalance, reason })  // update + snapshot
addCashAdjustment({ direction, amount, description, kasDate })  // insert finance_tx
getShiftPreview(sessionId)   // live, untuk dialog tutup toko
listShiftSessions({ from, to })   // untuk /app/laporan/shift
getShiftReport(sessionId)  // dari snapshot, untuk download/copy
```

Semua memanggil `getActiveTenant()` lebih dulu, dan
`checkOpenCashSession` menolak bila role bukan `FRONTLINER`/`ADMIN`/`MASTER_ADMIN`.
`closeCashSession` memverifikasi ulang sesi masih terbuka sebelum update
(optimistic lock di level aplikasi; `cervise_cash_sessions_closed_check` sebagai
jaring kedua).

## 9. Pengujian

| Test | Isi |
|---|---|
| `src/lib/operational/laporan-shift.test.ts` | `buildLaporanShift` dengan data tetap: penjualan lunas masuk rekap, penjualan `belum_bayar` **tidak** masuk; kas manual `kas_manual` masuk, `transaksi` tidak; `expected` = opening + servis lunas + penjualan lunas + manual net; `variance` benar untuk closing di atas, sama, dan di bawah expected. `formatShiftAsText` menghasilkan baris yang memuat semua nominal; `formatShiftRowsForSheet` menghasilkan jumlah baris = jumlah item + header + rekap |
| `src/lib/auth/cash-sessions-migration.test.ts` | Migration memuat unique index parsial `where closed_at is null`; `snapshot` ada di constraint; policy select memuat `employee_id = auth.uid()`; `finance_tx.source` punya CHECK ketiga nilainya |
| `src/lib/operational/dashboard-frontliner.test.ts` | Empat KPI: servis dengan `created_at` hari ini masuk hitungan; lima status proses (`Masuk`, `Diagnosa`, `Menunggu Konfirmasi`, `Menunggu Sparepart`, `Dikerjakan`) masuk "Proses Pengerjaan"; `Batal` masuk "Batal" dan **tidak** masuk "Proses"; `Sudah Diambil` masuk "Diambil" dan **tidak** masuk "Proses" |
| `src/lib/operational/laporan-shift.test.ts` (lanjutan) | Aturan anti-double-counting §5.2: servis dengan `cervise_sales.servis_id` menunjuk dirinya **tidak** masuk `total_servis`; penjualan yang menunjuk servis itu **tetap** masuk `total_penjualan`; penjualan tanpa `servis_id` (barang) masuk normal |

`laporan-shift.test.ts` punya dua blok: satu untuk rekap dan format, satu untuk
aturan pengait `servis_id`. Keduanya satu file karena aturan itu hanya berarti
dalam konteks rekap.

Tidak ada test rendering React — lihat §"Pengujian" di Spec 1.

## 10. Urutan rollout

1. Migration `add_cash_sessions` — `cervise_cash_sessions` + RLS,
   `finance_tx.source` + view, `cervise_sales.servis_id` + index, + test
2. `src/lib/operational/laporan-shift.ts` + test (termasuk blok pengait `servis_id`)
3. Server action kas + sesi
4. `OpeningBalanceDialog` + wire ke `compact-shell`
5. `AdjustmentDialog`
6. `ShiftReport` (komponen preview, dipakai dialog dan halaman)
7. `ClosingDialog` (3 tahap)
8. `PaymentDialog`
9. `frontliner-dashboard.tsx`
10. `/app/laporan/shift` + `ShiftDownloadDialog` + copy as text
11. Guard `requireMenu("laporan_shift")` — entri sudah ada di Spec 1

Langkah 11 sengaja terakhir: halaman bisa terbuka lebih dulu tanpa guard, karena
RLS `cervise_cash_sessions` sudah membatasi baris ke cabang.

## 11. Di luar scope

- **Multi-shift per hari** (dua shift oleh satu orang). Index unik satu sesi
  terbuka per karyawan, dan sesi tertutup per hari dihitung dari
  `snapshot.date`. Dua shift di hari yang sama butuh perubahan pada unik index.
- **Approval shift oleh `ADMIN`.** `ADMIN` bisa menutup sesi frontliner yang
  tertinggal (§3.3), tapi tidak ada alur approval formal.
- **Pembayaran bertahap / DP.** `cervise_sales.paid` sudah ada
  (`20260925130000:91`) dan `payment_status` punya `belum_bayar`, tapi
  `buildLaporanShift()` menghitung dari `total` untuk yang `lunas`. Transaksi
  parsial tidak menambah saldo shift.
- **Rekonsiliasi dengan bank.** `variance` dicatat; tidak ada yang cocok dengan
  mutasi rekening.
- **Uang receivable / cicilan.** Pembayaran lewat `PaymentDialog` (§4.4);
  installment tidak ada.
- **Termasuk `FRONTLINER` di `/app/kategori-sparepart`.** Master kategori tetap
  `MASTER_ADMIN`/`ADMIN`/`TECHNICIAN` sesuai matriks Spec 1.
- **Mengganti format snapshot yang sudah ada.** `schemaVersion` dicantumkan, tapi
  belum ada migrasi snapshot. Snapshot pertama akan lahir saat Spec 3 ini dipakai.

## 12. Risiko

| Risiko | Mitigasi |
|---|---|
| Laporan shift mencakup penjualan & kas manual di luar jam shift, sementara servis dipotong tepat | `kas_date` bertipe `date` di `cervise_sales` dan `finance_tx` (§5.1); disadari dan diterima, konsisten dengan `laporan/penjualan` |
| Servis terhitung dua kali kalau dibayar lewat `PaymentDialog` | `cervise_sales.servis_id` sebagai pengait (§3.2b); aturan rekap di §5.2; diuji |
| `expected` terlalu tinggi karena DP / pelunasan terpisah | `cervise_services` tidak punya kolom pembayaran (§5.2). Kalau cabang memakai DP, rekap harus dihitung dari `cervise_sales` saja. **Keputusan domain yang harus dikonfirmasi pemilik usaha sebelum implementasi** |
| `snapshot` jadi basi kalau format berubah | `schemaVersion` ada; perubahan format nanti menambah versi dan fallback ke data mentah untuk versi lama |
| Frontliner lupa tutup toko → shift berikutnya terkunci | Dialog opening menampilkan peringatan sesi tertinggal dengan link ke `/app/laporan/shift` (§4.1); index unik mencegah duplikasi |
| `variance` negatif tanpa alasan yang jelas | `variance` negatif mewajibkan alasan; snapshot menyimpan `reason`; `formatShiftAsText` memuatnya |
| `cervise_finance_tx` view tidak menampilkan kolom baru | View di-update dalam migration yang sama, sebelum ada data `kas_manual` |
| Download PDF menghasilkan halaman kosong | `renderJetHtml` sudah jadi pola diuji; PDF dibangun dari snapshot, bukan dari query ulang |

## 13. Keputusan yang tidak diambil di sini

- **Menambah `notes` ke `cervise_cash_sessions`.** Catatan alasan disimpan di
  `snapshot.reason`, jadi tidak ada kolom yang hanya terisi setelah tutup toko.
- **Tabel `cervise_cash_adjustments` terpisah.** Ditolak karena membuat angka kas
  harus konsisten di dua tempat (§2).
- **Menghapus `cervise_sales.payment_method` untuk kas manual.** Tidak ada
  hubungan — metode pembayaran penjualan dan sumber transaksi kas adalah konsep
  berbeda.
- **Menambah "status shift" (terbuka/tertutup/selesai) sebagai enum.** Dua nilai
  nullability (`closed_at`) sudah cukup, dan `closed_at` bisa dipakai untuk
  query rentang tanpa indeks tambahan.
