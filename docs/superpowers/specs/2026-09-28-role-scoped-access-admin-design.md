# Fondasi RBAC dan Halaman ADMIN — Design Spec

Tanggal: 2026-09-28
Status: disetujui untuk diimplementasikan
Bagian dari: 3 spec pemisahan tampilan per role
- Spec 1 (dokumen ini) — fondasi RBAC + halaman ADMIN
- Spec 2 — shell & dashboard TEKNICIAN
- Spec 3 — kas FRONTLINER + Laporan Shift

Spec 2 dan Spec 3 bergantung pada manifest yang dibuat di sini. Spec ini **tidak**
mengubah shell TEKNICIAN/FRONTLINER maupun menambah tabel apa pun.

## 1. Konteks dan tujuan

Aplikasi Cervise punya empat role dalam `employees.role` (constraint di
`20260925090000_cervise_owner_platform_additive.sql:102`):

```
MASTER_ADMIN | ADMIN | FRONTLINER | TECHNICIAN
```

Pemilik usaha (`MASTER_ADMIN`) sudah mendapat pengalaman yang berbeda dari-roll
lainnya, tapi tiga role lainnya memakai dashboard dan sidebar yang sama persis
dengan `MASTER_ADMIN`, dan tidak ada satu pun route yang menolak role yang salah.

Tiga sumber kebenaran hak akses sekarang hidup berdampingan dan tidak saling
sinkron:

| Sumber | Lokasi | Masalah |
|---|---|---|
| `MENU_ACCESS` | `src/lib/rbac.ts:13-37` | 24 kunci, tidak pernah dipakai untuk memfilter sidebar |
| `NAV_GROUPS` + `navItemKey()` | `src/components/layout/app-shell.tsx:57-138` | 16 item, mapping `href → i18n key` ditulis manual |
| `GROUPS` | `src/app/app/pengaturan/layout.tsx:7-24` | daftar sendiri, tidak difilter role sama sekali |

Tiga masalah nyata yang folgt dari itu:

1. **Tidak ada route guard per-role.** `middleware.ts` hanya memutuskan *app mana*
   yang dibuka (`getProtectedPathKind`, `middleware.ts:46`). Guard di
   `src/app/app/layout.tsx:6-24` hanya memvalidasi tenant. Setiap karyawan bisa
   membuka `/app/cabang`, `/app/keuangan/*`, `/app/laporan/*`, dan
   `/app/karyawan`; kegagalan muncul sebagai server action yang melempar error
   atau tabel kosong — bukan sebagai penolakan yang bisa dimengerti.
2. **`MENU_ACCESS` tidak mungkin benar.** Nilainya `teknisi`
   (`src/lib/rbac.ts:14-36`) sedangkan kolom database berisi `TECHNICIAN`.
   `canAccess()` menormalisasi ke huruf besar (`src/lib/auth/authorization.ts:45-48`),
   jadi `canAccess("TECHNICIAN", …)` mengembalikan `false` untuk **setiap** kunci —
   termasuk `dashboard` dan `servis`. Tidak ada test yang menutup ini.
3. **Menu `/app/pengaturan` ditampilkan ke semua orang.** `FRONTLINER` dan
   `TECHNICIAN` melihat link Subscription dan Usage; memilih link itu akan
   berakhir dengan error dari server action.

Tujuan spec ini: **satu sumber kebenaran** untuk siapa boleh melihat dan menulis
apa, yang dipakai bersama oleh sidebar, route guard, server action, dan RLS.
Setelah spec ini, `canAccess("TECHNICIAN", …)` benar, halaman yang tidak
dibolehkan menolak dengan benar, dan menambah halaman baru cukup menambah satu
baris manifest.

## 2. Keputusan yang sudah dikunci

| Keputusan | Nilai | Alasan |
|---|---|---|
| Sumber kebenaran | `src/lib/nav/manifest.ts` | Nav, guard, dan `canAccess()` membaca file yang sama; mustahil lagi tidak sinkron |
| Penegakan | sembunyikan menu **dan** route guard server-side | Menyembunyikan menu saja menyisakan halaman terbuka lewat URL |
| Casing role | `TECHNICIAN` (huruf besar) satu-satunya bentuk | Menghapus bug `teknisi`/`TECHNICIAN` secara struktural, bukan dengan patch |
| ADMIN | manajer operasional, terkunci 1 cabang | `BranchProvider` sudah mem-pin `actor.branchId` untuk non-`MASTER_ADMIN` (`app-shell.tsx:640`) |
| Dashboard ADMIN | shell dan dashboard **sekarang**, tidak berubah | ADMIN sudah punya aksesnya; yang hilang adalah kebocoran akses, bukan tampilannya |
| Sidebar ADMIN | sidebar sekarang, tidak diubah | Perubahan visual hanya diminta untuk Teknisi & Frontliner (Spec 2/3) |
| Tema (`Tampilan`) | MASTER_ADMIN saja | Disimpan di cookie `cervise-theme`, jadi sifatnya global lintas cabang — bukan milik per-role |
| Kategori Sparepart | pindah ke `/app/kategori-sparepart` | `/app/pengaturan` secara praktis milik MASTER_ADMIN; halaman ini perlu masuk manifest sebagai menu Inventori |
| Karyawan | ADMIN boleh CRUD | Kepemilikan bisnis; RLS dibatasi per cabang (§5). `canManageEmployees()` diperbarui, lihat §3.5 |
| Cabang | ADMIN read-only | `branches_update` saat ini mengizinkan ADMIN (`20260925090000:336-339`) — harus dicabut |
| Pola test | assertion terhadap isi file migration | `vitest.config.ts` tidak punya environment DOM, dan test migrasi sudah memakai pola ini (`src/lib/auth/*-migration.test.ts`) |

## 3. Manifest

### 3.1 Bentuk

`src/lib/nav/manifest.ts`:

```ts
export const APP_ROLE = [
  "MASTER_ADMIN",
  "ADMIN",
  "FRONTLINER",
  "TECHNICIAN",
] as const

export type AppRole = (typeof APP_ROLE)[number]

export type Surface = "legacy" | "compact"

export type NavEntry = {
  href: string
  key: string          // kunci i18n, mis. "nav.items.servis"
  icon: LucideIcon
  group: string        // id group, mis. "operasional"
  roles: AppRole[]     // boleh membuka halaman
  surface: Surface[]   // shell mana yang menampilkannya
  readOnly?: AppRole[] // role yang boleh membuka tapi tidak boleh menulis
  menuKeys?: string[]  // kunci kapabilitas tanpa rute, mis. ["inventory"]
}
```

`surface` adalah array, bukan satu nilai: `/app/servis` tampil di shell lama
(`MASTER_ADMIN`, `ADMIN`) **dan** shell compact (`FRONTLINER`, `TECHNICIAN`).
Shell dipilih dari role, bukan dari halaman — jadi satu entri dapat masuk keduanya.

`menuKeys` memegang kunci `canAccess()` yang tidak punya rute sendiri
(§3.4). Entri `/app/inventori` punya `menuKeys: ["inventory"]`.

### 3.2 Isi

Kolom `surface` memakai `L` = `legacy`, `C` = `compact`. `compact` diisi oleh
Spec 2 (`TECHNICIAN`) dan Spec 3 (`FRONTLINER`); nilainya sudah terlihat di sini
supaya matriks role dapat diverifikasi sebagai satu dokumen.

| href | group | surface | roles | readOnly | menuKeys |
|---|---|---|---|---|---|
| `/app` | `dashboard` | L | semua | — | `["dashboard"]` |
| `/app/servis` | `operasional` | L, C | semua | — | `["servis"]` |
| `/app/customer` | `operasional` | L, C | MASTER_ADMIN, ADMIN, FRONTLINER | — | `["customer"]` |
| `/app/penjualan` | `keuangan` | L, C | MASTER_ADMIN, ADMIN, FRONTLINER | — | `["penjualan"]` |
| `/app/inventori` | `operasional` | L, C | semua | — | `["inventory"]` |
| `/app/kategori-sparepart` | `operasional` | L, C | MASTER_ADMIN, ADMIN, TECHNICIAN | — | `["kategori_sparepart"]` |
| `/app/karyawan` | `manajemen` | L | MASTER_ADMIN, ADMIN | — | `["karyawan"]` |
| `/app/cabang` | `manajemen` | L | MASTER_ADMIN, ADMIN | `ADMIN` | `["cabang"]` |
| `/app/keuangan/transaksi` | `keuangan` | L, C | MASTER_ADMIN, ADMIN, FRONTLINER | — | — |
| `/app/keuangan/arus-kas` | `keuangan` | L, C | MASTER_ADMIN, ADMIN, FRONTLINER | — | — |
| `/app/laporan/servis` | `laporan` | L, C | semua | — | — |
| `/app/laporan/keuangan` | `laporan` | L | MASTER_ADMIN, ADMIN, FRONTLINER | — | — |
| `/app/laporan/penjualan` | `laporan` | L | MASTER_ADMIN, ADMIN, FRONTLINER | — | — |
| `/app/laporan/performa` | `laporan` | L | MASTER_ADMIN, ADMIN, FRONTLINER | — | — |
| `/app/laporan/shift` | `laporan` | L | MASTER_ADMIN, ADMIN | — | — |
| `/app/analitik-servis` | `laporan` | C | FRONTLINER, TECHNICIAN | — | — |
| `/app/garansi` | `layanan` | L, C | semua | — | — |
| `/app/audit-log` | `layanan` | L | MASTER_ADMIN, ADMIN | — | — |
| `/app/pengaturan/profil` | `akun` | L, C | semua | — | — |
| `/app/pengaturan/lokalisasi` | `akun` | L, C | semua | — | `["pengaturan_lokalisasi"]` |
| `/app/pengaturan` | `pengaturan` | L | MASTER_ADMIN | — | `["pengaturan_general"]` |
| `/app/pengaturan/tampilan` | `pengaturan` | L | MASTER_ADMIN | — | `["pengaturan_tampilan"]` |
| `/app/pengaturan/subscription` | `pengaturan` | L | MASTER_ADMIN | — | `["pengaturan_subscription"]` |
| `/app/pengaturan/usage` | `pengaturan` | L | MASTER_ADMIN | — | `["pengaturan_usage"]` |

Tiga baris terakhir `readOnly`-nya kosong: `ADMIN` dan `FRONTLINER` memang tidak
boleh membuka `/app/pengaturan` sama sekali, jadi tidak ada read-only yang perlu
didefinisikan.

Baris `/app` menentukan shell mana yang dipakai: `surface` berisi `"compact"`
→ `CompactShell` (Spec 2), hanya `"legacy"` → `AppShell`. Karena baris ini `L`
untuk semua role, **Spec 1 tidak mengubah shell siapa pun**; Spec 2 dan Spec 3
yang menambah `"compact"` di baris ini untuk role masing-masing.

`/app/laporan/shift` dan `/app/analitik-servis` sengaja ada di sini walau
halamannya dibuat di Spec 2 dan Spec 3: guard harus menolak role yang salah
sejak hari pertama, bukan menunggu halamannya ada.

`/app/laporan/servis` dan `/app/analitik-servis` keduanya memberi `TECHNICIAN` akses
data servis, jadi navigasi mereka mirip. Yang membedakan: `/app/laporan/servis`
adalah tabel, `/app/analitik-servis` adalah grafik. Keduanya ada karena Spec 2
meminta analitik sebagai route tersendiri.

`/app/sparepart` tidak masuk manifest. Halamannya sudah `redirect("/app/inventori")`
(`src/app/app/sparepart/page.tsx:4`) dan `next.config.ts` sudah redirect
`/app/inventory`. Tidak ada kebutuhan entri untuk redirect.

`/app/sparepart` tidak masuk manifest. Halamannya sudah `redirect("/app/inventori")`
(`src/app/app/sparepart/page.tsx:4`) dan `next.config.ts` sudah redirect
`/app/inventory`. Tidak ada kebutuhan entri untuk redirect.

### 3.3 Yang dihapus

| Yang dihapus | Lokasi | Diganti oleh |
|---|---|---|
| `MENU_ACCESS` | `src/lib/rbac.ts:13-37` | `NAV_ENTRIES` |
| `NAV_GROUPS`, `FLAT_NAV` | `app-shell.tsx:57-102` | `NAV_ENTRIES` + `groupsFor()` |
| `navItemKey()`, `groupTranslationKey()` | `app-shell.tsx:104-138` | `entry.key` / `entry.group` |
| `GROUPS` | `pengaturan/layout.tsx:7-24` | `NAV_ENTRIES` |
| Daftar `CommandItem` | `command-palette.tsx:69-153` | `NAV_ENTRIES` |

`canAccess(role, menu)` di `src/lib/rbac.ts` **tetap ada** sebagai wrapper
`NAV_ENTRIES.some(...)`, karena 12 server action memakainya:
`karyawan/actions.ts:49,89`, `penjualan/actions.ts:19,256`, `customer/actions.ts:15`,
`cabang/actions.ts:7`, `garansi/actions.ts:56` (via `isManagerRole`),
`pengaturan/actions.ts:21,55,96`, `pengaturan/photo-actions.ts:28`,
`pengaturan/subscription/actions.ts:7`, `servis/actions.ts:489`.

Wrapper itu harus menerima key menu yang **sama** dengan yang dipakai `MENU_ACCESS`
sekarang supaya tidak ada caller yang perlu diubah. Kunci yang benar-benar
dipanggil di kode:

| Kunci | Call site |
|---|---|
| `karyawan` | `karyawan/actions.ts:49,89` |
| `cabang` | `cabang/actions.ts:8` |
| `customer` | `customer/actions.ts:16` |
| `inventory` | `inventori/actions.ts:26` |
| `keuangan_transaksi` | `servis/actions.ts:489` |
| `penjualan` | `penjualan/actions.ts:20` |
| `harga_jual` | `penjualan/actions.ts:256` |
| `pengaturan_general` | `pengaturan/actions.ts:21,96`, `pengaturan/photo-actions.ts:29` |
| `dashboard` | `pengaturan/actions.ts:55` |
| `pengaturan_subscription` | `pengaturan/subscription/actions.ts:8,107`, `app-shell.tsx:377` |

Kunci `MENU_ACCESS` berikut **tidak punya call site** dan hilang bersama
`MENU_ACCESS`: `sparepart`, `laporan_servis`, `laporan_keuangan`,
`laporan_performa`, `laporan_penjualan`, `keuangan_arus_kas`, `pengaturan`,
`pengaturan_kategori`, `pengaturan_usage`, `laporan_performa_teknisi`.

Tiga di antaranya tetap bertahan sebagai `menuKeys` di `NAV_ENTRIES` walau tanpa
call site, karena mereka adalah halaman nyata yang butuh guard:
`pengaturan_tampilan`, `pengaturan_lokalisasi`, dan `pengaturan_usage` (lihat
kolom `menuKeys` di §3.2).

Aturan yang ditegakkan `manifest.test.ts`: setiap kunci di tabel di atas wajib punya
entri di `NAV_ENTRIES` dengan `roles` yang sesuai matriks §3.2.

### 3.4 Dua kunci yang tidak punya halaman

`keuangan_transaksi` dan `harga_jual` bukan rute — keduanya adalah **kapabilitas
di dalam** `/app/keuangan/transaksi` dan `/app/penjualan`. `NAV_ENTRIES` tidak
mempunyai baris untuk itu, jadi wrapper punya dua sumber:

```ts
export function canAccess(role: string | null | undefined, key: string): boolean {
  const normalized = normalizeRole(role)
  if (!normalized) return false
  if (key in CAPABILITY_ACCESS) {
    return CAPABILITY_ACCESS[key].includes(normalized as AppRole)
  }
  const entry = NAV_ENTRIES.find(
    (item) => item.href === key || item.menuKeys?.includes(key)
  )
  return entry ? entry.roles.includes(normalized as AppRole) : false
}
```

`NavEntry` mendapat satu field baru, `menuKeys?: string[]` — nama lain dari
`href`, untuk kapabilitas yang tidak punya halaman. `inventory` perlu
ditambahkan ke `menuKeys` entri `/app/inventori`, karena `MENU_ACCESS` punya
kunci `inventory` sementara halamannya `/app/inventori`.

`CAPABILITY_ACCESS` yang terpisah hanya berisi `keuangan_transaksi` dan
`harga_jual`; keduanya tidak punya rute.

### 3.5 `canManageEmployees` dan `requireManager`

`canManageEmployees()` (`src/lib/auth/account-input.ts:50-52`) hanya menerima
`MASTER_ADMIN` dan itu **disengaja** — komentarnya di line 41-46 menjelaskan bahwa
ia mencerminkan policy database, bukan selera aplikasi. Spec ini mengubah policy
itu (§5), jadi `canManageEmployees` ikut diperbarui: menerima
`MASTER_ADMIN` dan `ADMIN`. Karena policy baru sudah dibatasi per cabang (§5),
ADMIN yang berada di cabang A tidak akan bisa menyentuh karyawan cabang B.

`requireManager()` (`karyawan/actions.ts:28-30`, `MASTER_ADMIN`+`ADMIN`) tetap
seperti sekarang untuk aksi hapus karyawan.

`src/lib/auth/employee-access.test.ts:16-20` menguji bahwa `canManageEmployees`
menolak `ADMIN`. Test itu **harus diubah** oleh spec ini, dan perubahannya adalah
satu-satunya alasan test itu perlu disentuh.

## 4. Route guard

`src/lib/auth/require-menu.ts`:

```ts
import { redirect } from "next/navigation"
import { getActiveTenant } from "@/lib/supabase/actor"
import { canAccess } from "@/lib/rbac"

export async function requireMenu(key: string) {
  const actor = await getActiveTenant()
  if (!canAccess(actor.role, key)) {
    redirect("/app?error=forbidden")
  }
  return actor
}
```

`key` boleh `href` penuh (`"/app/karyawan"`) atau `menuKeys` (`"karyawan"`);
`canAccess()` mencari keduanya.

Menyertakan `getActiveTenant()` yang dikembalikan supaya halaman tidak memanggilnya
dua kali.

Penempatan:

| Lokasi | Kunci `menuKeys` | Catatan |
|---|---|---|
| `src/app/app/keuangan/layout.tsx` (baru) | — | Entri `/app/keuangan/transaksi` dan `/app/keuangan/arus-kas` tidak punya `menuKeys`; layout memanggil `requireMenu("keuangan_transaksi")` yang dibaca dari `CAPABILITY_ACCESS` (§3.4) |
| `src/app/app/laporan/layout.tsx` (baru) | — | Tidak ada satu kunci bersama; lihat di bawah |
| `src/app/app/karyawan/page.tsx` | `karyawan` | |
| `src/app/app/cabang/page.tsx` | `cabang` | |
| `src/app/app/audit-log/page.tsx` | — | Entri `/app/audit-log` mendapat `menuKeys: ["audit_log"]` baru di Spec 1 |
| `src/app/app/garansi/page.tsx` | — | Entri `/app/garansi` mendapat `menuKeys: ["garansi"]` baru di Spec 1 |
| `src/app/app/customer/page.tsx` | `customer` | |
| `src/app/app/penjualan/page.tsx` | `penjualan` | |
| `src/app/app/inventori/page.tsx` | `inventory` | Server action sudah memanggilnya (`inventori/actions.ts:26`); guard menutup jalur UI |

`audit_log`, `garansi`, dan `kategori_sparepart` **baru** sebagai kunci — tidak
pernah ada di `MENU_ACCESS`. Semuanya ditambahkan ke kolom `menuKeys` di §3.2
kecuali tiga ini, yang perlu satu baris tambahan saat ditulis.

`/app/laporan/layout.tsx` tidak bisa memakai satu kunci karena isinya berbeda
per child: `/laporan/servis` boleh `TECHNICIAN`, `/laporan/shift` hanya
`MASTER_ADMIN`/`ADMIN`, tiga halaman lain tidak boleh `TECHNICIAN`. Pola:
layout hanya memvalidasi bahwa pengguna punya akses ke *minimal satu* halaman
laporan, lalu tiap halaman memanggil `requireMenu` dengan `href`-nya sendiri:

```ts
// di setiap page.tsx di bawah /app/laporan
const actor = await requireMenu("/app/laporan/keuangan")
```

`requireMenu` menerima `href` maupun `menuKeys`; ia mencari entri dengan
`entry.href === key || entry.menuKeys?.includes(key)`. Satu fungsi, dua bentuk
kunci.

`requireMasterAdmin()` di `src/lib/supabase/actor.ts:205-209` sekarang diekspor
tanpa pernah dipanggil. Spec ini memakainya untuk halaman pengaturan MASTER_ADMIN
(`/app/pengaturan`, `/tampilan`, `/subscription`, `/usage`) alih-alih
`requireMasterAdminStrict()` yang terduplikasi di
`pengaturan/master-admin-actions.ts:30-34`. Duplikat itu dihapus.

### 4.1 Halaman read-only

`readOnly` produciendo dua efek: tombol tambah/edit/hapus disembunyikan, dan
server action menolak. Untuk `ADMIN` di `/app/cabang`, `cabang/actions.ts` sudah
mendekati ini (`roleLabel` + permission di line 111/133); spec menyelaraskan
policy RLS-nya (§5) agar kedua lapis setuju.

## 5. Migration `add_role_scoped_policies`

| Policy | Perubahan | Alasan |
|---|---|---|
| `employees_insert` / `_update` / `_delete` | Tambah `ADMIN`; ganti `has_tenant_role(organization_id, …)` → `has_tenant_branch_role(organization_id, branch_id, …)` terhadap branch **target** | Policy sekarang tidak punya filter branch sama sekali. Tanpa ini ADMIN bisa mengubah karyawan cabang lain dalam tenant yang sama |
| `branches_update` | Cabut `ADMIN` dari `has_tenant_role(...)` | ADMIN read-only di `/app/cabang` |
| `cervise_products_insert` / `_update` / `_delete` | Tambah `TECHNICIAN` | Katalog inventori full akses untuk semua role |
| `cervise_sparepart_categories_insert` / `_update` / `_delete` | Tambah `TECHNICIAN` | Kategori sparepart full akses untuk semua role kecuali FRONTLINER |
| `adjust_product_stock(uuid, int, int)` | Tambah `TECHNICIAN` | Teknisi harus bisa menyelesaikan servis yang memakai sparepart |

`has_tenant_branch_role(organization_id, branch_id, roles)` sudah ada dan sudah
di-grant ke `authenticated` (`20260925122000_harden_auth_rls.sql`, grant di
`20260925120000_add_cervise_products.sql`). Tidak perlu fungsi baru.

Untuk `employees`, filter branch ditulis sebagai subquery karena policy
mengakses branch milik **target**, bukan milik caller:

```sql
using (
  public.is_platform_admin()
  or public.has_tenant_role(organization_id, array['MASTER_ADMIN']::text[])
  or exists (
    select 1 from public.employees caller
    where caller.profile_id = auth.uid()
      and caller.organization_id = employees.organization_id
      and caller.branch_id = employees.branch_id
      and caller.role = 'ADMIN'
      and caller.is_active
  )
)
```

`with check` memakai bentuk yang sama agar row yang ditulis ulang harus tetap
berada di cabang yang sama.

### 5.1 Yang tidak berubah

`stock_qty` tetap `revoke update` dari `authenticated`
(`20260925140000_lock_product_stock.sql:20-23`). "CRUD produk" berarti metadata
produk boleh diedit/hapus; **angka stok hanya boleh berubah lewat
`adjust_product_stock()`**. Memberi `TECHNICIAN` akses ke fungsi itu (§5) sudah
cukup.

## 6. Perpindahan halaman

`src/app/app/pengaturan/kategori-sparepart/page.tsx` → `src/app/app/kategori-sparepart/page.tsx`.

Perubahan: `git mv` foldernya, ubah import relatif, dan tambahkan guard
`requireMenu("kategori_sparepart")`. Tidak ada perubahan pada isi halaman —
`page.tsx` sudah query langsung ke `cervise_sparepart_categories` dan RLS-nya
sudah role-aware.

Tidak ada link masuk yang perlu diperbarui: halaman ini tidak pernah muncul di
`NAV_GROUPS` (`app-shell.tsx:57-99`), hanya di `pengaturan/layout.tsx`, yang
diganti manifest.

## 7. Perbaikan yang ikut

**`messages/id.json`** — file ini **JSON valid** (diverifikasi dengan
`ConvertFrom-Json`; kunci duplikat tidak membuat parser gagal, nilai terakhir
yang menang). Yang ada di line 34-36 adalah `"inventory": "Inventori"` (indeks
4, benar, di dalam `nav.items`) dan lagi `"inventory": "Inventori"` di line 36 —
duplikat tepat di objek `nav.items` yang sama. Nilai keduanya `"Inventori"`, jadi
akibatnya nol; yang tersisa hanya satu baris mubazir.

Kunci `nav.items` yang tersedia: `dashboard`, `service`, `sales`, `inventory`,
`sparepart`, `customer`, `employee`, `branch`, `transaction`, `cashflow`,
`reportService`, `reportFinance`, `reportPerformance`, `reportSales`, dan
lainnya di line 46+.

`NAV_ENTRIES` **tidak menambah kunci i18n baru** untuk 24 halaman yang sudah ada.
Empat halaman baru yang diperkenalkan Spec 2 dan Spec 3 — `analitik-servis`,
`kategori-sparepart`, `laporan/shift` — memakai label string yang sudah ada
(`Servis`, `Sparepart`, `Servis`) supaya tidak perlu menyentuh `messages/*.json`
dalam scope ketiga spec. Label sidebar compact dengan teks penuh
(`Analitik Servis`, `Kategori Sparepart`, `Laporan Shift`) berasal dari
`group`/`key` baru yang ditambahkan sebagai satu perubahan kecil pada
`messages/id.json` dan `messages/en.json` di Spec 2, bukan per spec.

**`src/lib/rbac.test.ts`** — test yang ada sekarang (`canAccess("ADMIN","karyawan")`
`true`, `canAccess("TECHNICIAN","karyawan")` `false`, dan enam assertion lain)
sebagian besar **tetap berlaku** setelah spec ini. Yang berubah hanya
`canAccess("FRONTLINER", "keuangan_transaksi")`: sekarang `false`
(`rbac.test.ts:12`) tapi Spec 3 memberi `FRONTLINER` akses ke
`/app/keuangan/transaksi` dan Spec 1 §3.2 tidak memberi role itu ke
`keuangan_transaksi`. Assertion itu **tidak diubah** oleh Spec 1 — `FRONTLINER`
tidak boleh mencatat pembayaran servis lewat `servis/actions.ts:489`; dia
memakai dialog pembayaran Spec 3, yang jalurnya berbeda. `rbac.test.ts` ditambah,
bukan diganti.

**`profiles.role` vs `employees.role`** — dua kolom role bisa berbeda. Spec ini
tidak menyatukannya, tapi menegaskan aturan: **seluruh pembacaan role lewat
`getActiveTenant()`**, yang mengambil dari `employees` (`actor.ts:182`, default
`"TECHNICIAN"`). Laporan yang pernah membaca `profiles.role` langsung
(`laporan/servis/actions.ts:34-35`) tidak worsened oleh spec ini.

## 8. Pengujian

| Test | Isi |
|---|---|
| `src/lib/nav/manifest.test.ts` | Setiap role menghasilkan daftar menu yang **expected** (daftar literal, bukan file terpisah); tidak ada `href` duplikat; setiap `roles` berisi role yang valid; setiap nilai `surface` adalah `"legacy"` atau `"compact"`; setiap `menuKeys` unik lintas seluruh manifest; setiap `key` ada di `messages/id.json`; setiap kunci di §3.3 punya entri |
| `src/lib/auth/require-menu.test.ts` | `requireMenu` melempar redirect untuk role yang salah, meloloskan role yang benar; `getActiveTenant` di-mock dengan `vi.hoisted()` + `vi.mock`, mengikuti `src/app/app/servis/actions.test.ts` |
| `src/lib/auth/rbac-migration.test.ts` | Isi file migration memuat policy baru; setiap policy `employees` memuat `caller.branch_id = employees.branch_id`; `branches_update` tidak lagi memuat `'ADMIN'`; `adjust_product_stock` memuat `'TECHNICIAN'`; setiap policy `cervise_products` dan `cervise_sparepart_categories` untuk write memuat `'TECHNICIAN'` |
| `src/lib/rbac.test.ts` | Ditambah, bukan diganti (§7): `canAccess("TECHNICIAN", "dashboard")` dan `canAccess("TECHNICIAN", "servis")` bernilai `true` — kasus yang dulu mustahil. Assertion lama yang masih berlaku dibiarkan |
| `src/lib/auth/employee-access.test.ts` | Diubah: `canManageEmployees("ADMIN")` sekarang `true` (sebelumnya `false`). Pernyataan "rejects ADMIN even though canAccess(pengaturan_general) allows it" yang jadi alasan tulisannya dihapus — keduanya sudah benar setelah spec ini |

Tidak ada test rendering React: `vitest.config.ts` hanya punya
`resolve.alias`, tanpa environment DOM, dan suite ini tidak pernah render
komponen. Pola yang dipakai adalah assertion pada konstanta yang diekspor
(`src/components/owner/owner-navigation.test.ts` sudah begitu).

## 9. Urutan rollout

1. `src/lib/nav/manifest.ts` + `manifest.test.ts` — belum dipakai apa pun
2. `require-menu.ts` + test
3. Migrasi RLS + `rbac-migration.test.ts`
4. `rbac.ts` jadi wrapper; `account-input.ts` `canManageEmployees` diperbarui;
   `employee-access.test.ts` disesuaikan
5. `rbac.test.ts` ditambah assertion baru
6. `app-shell.tsx`, `pengaturan/layout.tsx`, `command-palette.tsx` membaca manifest
7. `git mv` kategori-sparepart
8. Guard per halaman

Tidak ada langkah `messages/id.json` di spec ini: file itu JSON valid, dan satu
baris duplikat di dalamnya dibersihkan bersama langkah 6 ketika pemetaan
`navItemKey()` diganti.

Migrasi RLS (4) sebelum UI (6) supaya tidak ada jarring di mana UI menyembunyikan
link yang RLS-nya sudah melonggarkan.

## 10. Di luar scope

- **Shell dan dashboard TEKNICIAN** — Spec 2. Spec ini hanya menyiapkan `surface`
  dan menulis entri `"compact"`.
- **Kas FRONTLINER dan Laporan Shift** — Spec 3.
- **Menyatukan `profiles.role` dan `employees.role`** — migration yang lebih besar
  dengan backfill dan risiko data. Aturan "baca role dari `getActiveTenant()`"
  cukup untuk sekarang.
- **Mengganti `employees.role` dari enum-ish CHECK ke enum Postgres** — CHECK
 constraint sudah bekerja; tidak perlu.
- **Menambah role baru** — manifest designed untuk itu, tapi tidak ada role kelima
  yang dibutuhkan sekarang.
- **Menyembunyikan aksi tulis di UI per `readOnly`** — dilakukan di Spec 1 hanya
  untuk `ADMIN` di `/app/cabang`; tidak ada read-only lain di spec ini.

## 11. Risiko

| Risiko | Mitigasi |
|---|---|
| Migrasi `employees` terlalu ketat → ADMIN terkunci dari karyawan sendiri | Subquery filter `caller.branch_id = employees.branch_id` memakai baris `employees` **target**, bukan cabang caller; diuji terhadap data live sebelum rollout |
| Manifest menjadi tempat penolakan yang tidak terlihat | `manifest.test.ts` mengunci daftar menu setiap role; menambah halaman tanpa entri akan menggagalkan test |
| `canAccess` yang berubah tidak merusak caller yang ada | Wrapper menjaga nama kunci lama; 12 call site diverifikasi satu per satu di §3.3 |
| Sidebar jadi kosong untuk role yang salah baca | Setiap role punya minimal 4 entri (lihat §3.2) dan `manifest.test.ts` gagal kalau ada role dengan daftar kosong |

## 12. Keputusan yang tidak diambil di sini

- **Satu `RoleShell` yang memilih layout di `app/layout.tsx`.** Manifest sudah
  menyimpan `surface`, jadi langkah berikutnya cukup memilih komponen shell.
  Pindah ke `app/layout.tsx` sekarang akan membuat dua subtree layout dengan
  navigasi, active-state, dan analytics yang berbeda — belum perlu.
- **Memoize `NAV_ENTRIES` per role.** Daftar kecil, filtering `Array.filter` di
  setiap render sidebar cukup. Memoize ditambahkan kalau muncul evidence.

