# Shell Compact dan Dashboard TEKNICIAN — Design Spec

Tanggal: 2026-09-28
Status: disetujui untuk diimplementasikan
Bergantung pada: `2026-09-28-role-scoped-access-admin-design.md` (Spec 1)

Spec ini membangun shell kedua untuk aplikasi Cervise: shell `compact` yang
khusus untuk `TEKNICIAN` (dan dipakai `FRONTLINER` juga di Spec 3). Dashboard
dan sidebar untuk `MASTER_ADMIN`, `ADMIN`, dan `FRONTLINER` **tidak** berubah.

## 1. Konteks dan tujuan

`TEKNICIAN` hari ini memakai shell yang sama persis dengan pemilik usaha: sidebar
16 item, header `PageHeader` generik, dashboard agregat yang dirancang untuk
membaca omzet dan laporan. Yang tidak ada: daftar tugas pribadi, antrean pekerjaan
yang butuh perhatian, dan angka target-vs-realisasi.

Tujuan spec ini, tiga hal:

1. **Shell `compact`** — sidebar ringkas, orientasi vertikal (icon di atas teks),
   ukuran icon lebih besar, nama tenant dengan baris informasi cabang
   underneath, tanpa branch switcher.
2. **Dashboard TEKNICIAN** — adaptasi dari blok `dashboards/home.json`, dengan
   konten Cervise: To-Do personal, antrean servis yang butuh perhatian, dan KPI
   target.
3. **To-Do personal** — disimpan per akun teknisi, tidak terlihat oleh akun lain.

Yang **tidak** termasuk: shell untuk `FRONTLINER` (Spec 3 memakai shell yang sama
dengan konten berbeda), dan perubahan dashboard `ADMIN`/`MASTER_ADMIN`.

## 2. Keputusan yang sudah dikunci

| Keputusan | Nilai | Alasan |
|---|---|---|
| Nama shell | `compact` | Manifest Spec 1 §3.1 punya `surface: Surface[]`; shell dipilih dari role yang punya entri tersebut |
| Sumber komponen | Adaptasi `layouts/app-shell.json` dari devl.sh | Design yang diminta; diadaptasi ke `@/components/ui/*` |
| Ikon sidebar | `size-[18px]`, item `px-3 py-2.5` | Diminta lebih besar dari `size-4` + `px-2.5 py-1.5` yang dipakai shell lama |
| Orientasi | Vertikal: icon di atas label | Diminta |
| Mobile | Tetap pola `h-svh` + `CerviseBottomNav` | Shell lama sudah punya bottom-nav 72px + FAB; pola `grid-cols-[256px_1fr]` dari devl tidak cocok untuk mobile Cervise |
| To-Do | Milik teknisi sendiri | Diminta "data disimpan tiap akun teknisi" |
| KPI Target | Pakai `branches.intensif_target_count` yang sudah ada | Kolom sudah ada + sudah dipakai `src/lib/operational/performa-teknisi.ts`; tidak perlu kolom baru |
| To-Do FRONTLINER | Tidak ada | Today Schedule-nya diganti antrean servis (Spec 3) |
| Navigasi sidebar | `Operasi` · `Laporan` | Keuangan dan manajemen bukan urusan teknisi |
| Branch switcher | Dihilangkan | `canSwitchBranch()` sudah hanya `MASTER_ADMIN`; jadi sudah tidak tampil, tapi eksplisitkan |

## 3. Divergence dari `layouts/app-shell.json`

Kode referensi memakai `@orbit/ui/*` yang **tidak ada** di repo ini. Yang harus
diubah:

| Referensi | Di sini |
|---|---|
| `@orbit/ui/button` | `@/components/ui/button` |
| `@orbit/ui/avatar` | `@/components/ui/avatar` |
| `@orbit/ui/input-group` | `@/components/ui/input-group` |
| `@orbit/ui/kbd` | **Tidak ada.** `src/components/ui/kbd.tsx` tidak ada di repo. Ganti dengan `<kbd>` HTML + kelas Tailwind (`rounded border border-border bg-muted px-1.5 font-mono text-[10px]`), yang persis seperti yang dilakukan `penjualan-toolbar.tsx`, `customer-toolbar.tsx`, dan `karyawan-toolbar.tsx` — ketiganya sudah punya komponen `Kbd` lokal masing-masing |
| `cn` dari `@orbit/…` | `import { cn } from "cn"` (`src/lib/utils.ts` re-export) |
| `font-heading` | **Ada** — `src/app/globals.css:14-16` |
| `font-mono` | **Ada** — Geist Mono, `--font-mono` |
| `@orbit/ui/input-group` | **Ada** — `src/components/ui/input-group.tsx` |

`Button` di repo ini membungkus SmoothUI (`src/components/ui/button.tsx`) dan
memetakan nama variant shadcn ke variant SmoothUI lewat `variantMap`. Kedua
nilai yang dipakai referensi devl **sudah tersedia**: `"ghost"` ada di
`LegacyVariant` (line 22) dan dipetakan di `variantMap` (line 43); `"icon"`
ada di `LegacySize` (line 21) dan dipetakan ke `"icon-sm"` (line 30).

`Card` juga tersedia di `src/components/ui/card.tsx`, tapi **tidak dipakai** —
lihat §13.

## 4. Komponen

### 4.1 `src/components/layout/compact-shell.tsx`

Struktur mengikuti `app-shell.tsx` yang sekarang: provider stack
`LocaleProvider → TenantProvider → BranchProvider → CommandPaletteProvider`,
lalu shell.

```
LocaleProvider
└─ TenantProvider        fixedOrganizationId = role === MASTER_ADMIN ? null : actor.orgId
   └─ BranchProvider     fixedBranchId       = role === MASTER_ADMIN ? null : actor.branchId ?? "unassigned"
      └─ CommandPaletteProvider
         └─ CompactShellInner
```

`CompactShellInner`:

```
<h-svh flex lg:grid lg:grid-cols-[256px_1fr]>
  header  h-14        (lg:hidden)  ← logo Cervise + notifikasi + avatar
  CompactSidebar       (lg:flex)   ← 256px
  <main>  scroll        + <CerviseBottomNav>  (lg:hidden)
```

Header desktop mengikuti referensi: search `⌘K` di tengah (memakai
`CommandSearchTrigger` yang sudah ada di `page-header.tsx`, bukan `InputGroup`
baru), notifikasi + avatar di kanan.

`TrialCard` **tidak** dirender di shell compact. Kartu itu menampilkan status
trial subscription, dan teknisi tidak punya aksi terhadapnya.

### 4.2 `src/components/layout/compact-sidebar.tsx`

```
┌─ header ─────────────────┐
│  Cervise                 │   ← logo mark (bg gradient) + wordmark
│  {tenant.name}           │   ← nama tenant
│  {branch.name}           │   ← baris informasi cabang  ← TAMBAHAN
├─ navigasi ───────────────┤
│  OPERASI                 │
│   [▣] Dashboard          │   ← icon di atas label
│   [▤] Servis              │
│   [▦] Inventori           │
│   [▢] Kategori Sparepart  │
│   [◈] Garansi             │
│  LAPORAN                 │
│   [◔] Analitik Servis     │
│   [▤] Laporan Servis      │
├─ footer ─────────────────┤
│  (avatar) {full_name}    │
│           {role_label}   │
│  [Pengaturan] [Keluar]   │
└──────────────────────────┘
```

Perubahan dari shell lama, sesuai permintaan:

1. **Blok "Tenant assigned" dihapus.** Itu teks statis di
   `app-shell.tsx:196` yang dirender saat `canSwitchTenant()` false. Di shell
   compact, nama tenant dirender langsung tanpa label.
2. **Baris informasi cabang.** Nama cabang tampil di bawah nama tenant. Sumbernya
   `useBranch().branch.label`. Tidak memakai `BranchSwitcher` sama sekali.
3. **Branch switcher dihilangkan.** `BranchSwitcher` menerima `canSwitch`, yang
   sudah bernilai `false` untuk `TEKNICIAN` (`src/lib/auth/access.ts:9-11`).
   Di shell compact komponen itu tidak di-render, dan sebagai gantinya dipakai baris
   teks statis.
4. **Orientasi vertikal + icon lebih besar.** Item:
   ```tsx
   <Link className="flex flex-col items-center gap-1.5 rounded-lg px-3 py-2.5 …">
     <item.icon className="size-[18px] opacity-70" />
     <span className="text-xs">{label}</span>
   </Link>
   ```
5. **Tanpa pengelompokan PROJECTS/TEAMS.** Group referensi dari devl
   (`PROJECTS`, `TEAMS` dengan titik warna dan angka) tidak relevan di Cervise.
   Hanya dua group: `Operasi` dan `Laporan`.

`activeItem` pakai `usePathname()` langsung, bukan state, supaya active-state
benar saat navigasi dari dashboard lewat link.

### 4.3 Menu TEKNICIAN

Dari manifest Spec 1 §3.2, entri yang memuat `"compact"` di `surface` **dan**
`TECHNICIAN` di `roles`:

| href | Group |
|---|---|
| `/app` | Dashboard |
| `/app/servis` | Operasi |
| `/app/inventori` | Operasi |
| `/app/kategori-sparepart` | Operasi |
| `/app/garansi` | Operasi |
| `/app/analitik-servis` | Laporan |
| `/app/laporan/servis` | Laporan |

Sidebar compact memfilter `NAV_ENTRIES` dengan
`entry.surface.includes("compact") && entry.roles.includes(actor.role)`. Tidak
ada daftar menu hardcoded di shell compact. Group diambil dari `entry.group`,
label dari `entry.key`.

## 5. Dashboard TEKNICIAN

Adaptasi `dashboards/home.json` (mode `home`).

### 5.1 Kerangka

```
<div className="min-h-svh bg-background text-foreground">
  <div className="px-10 py-10">
    <div className="mx-auto max-w-5xl">
      {label tanggal · font-mono text-[10px] uppercase tracking-[0.3em]}
      <h1 className="mt-1 font-heading text-4xl tracking-tight">Selamat {sapaan}, {nama}.</h1>
      <p className="mt-2 max-w-xl text-muted-foreground text-sm">
        {jumlah} hal perlu dikerjakan hari ini. Yang pertama kecil — mulai dari sana.
      </p>

      4 shortcut                grid-cols-2 sm:grid-cols-4
      ────────────────────────
      grid lg:grid-cols-[3fr_2fr]
        Kiri: To-Do             Kanan: Servis butuh perhatian
      ────────────────────────
      3 KPI                     sm:grid-cols-3
    </div>
  </div>
</div>
```

Struktur `Card` dan `FactCard` dari referensi dipakai ulang sebagai komponen
lokal di `technician-dashboard.tsx` (bukan `src/components/ui/card.tsx`, lihat
§13), dengan `title` diisi label Bahasa Indonesia: `Today's tasks` → `Tugas Saya`,
`Today's schedule` → `Servis butuh perhatian`.

### 5.2 Shortcut

Empat tombol, tujuan:

| Label | href |
|---|---|
| Servis baru | `/app/servis/baru` |
| Antrean saya | `/app/servis` |
| Input stok | `/app/inventori` |
| Target saya | `/app/analitik-servis` |

Tiga dari empat diambil dari `entry.href` di manifest. `/app/servis/baru` **tidak
ada** di manifest — ia adalah halaman anak, bukan entri navigasi. Label shortcut
ditulis sebagai string di komponen, bukan dari `entry.key`, karena shortcut bukan
item menu.

### 5.3 Kolom kiri — To-Do personal

Daftar tugas, `{ id, title, dueAt, doneAt }`.

- Checkbox toggle optimistic, gagal → `sonner` error + revert.
- Judul bisa diklik → modal edit (judul + tanggal).
- Tombol `+` di header card → baris input baru di paling atas.
- Baris selesai ditampilkan dengan `line-through text-muted-foreground`, tetap
  terlihat (bukan hilang) supaya teknisi bisa membatalkan centang.
- Badge kanan: `Hari ini` / `Besok` / tanggal. Kolom badge project dari referensi
  **dihapus** — To-Do personal Cervise tidak punya konsep project, dan tabel
  `cervise_staff_todos` tidak punya kolom untuk itu. Kolom kedua di baris menjadi
  lebar tetap untuk tanggal.

### 5.4 Kolom kanan — Servis butuh perhatian

Menggantikan `Today's schedule`. Daftar servis milik teknisi yang bermasalah,
dengan alasan yang bisa ditindaklanjuti.

Status `cervise_services` dibatasi oleh CHECK constraint
(`20260925130000_cervise_operational_schema.sql:24`):

```
Masuk | Diagnosa | Menunggu Konfirmasi | Menunggu Sparepart
Dikerjakan | Selesai | Sudah Diambil | Batal
```

Tidak ada status `Dijemput` — itu keliru. Tiga kategori, diurutkan:

| Prioritas | Kondisi | Keterangan |
|---|---|---|
| `tinggi` | `Masuk` lebih dari 24 jam | belum ditangani sama sekali |
| `tinggi` | `Dikerjakan` lebih dari 48 jam | dikerjakan tapi menggantung |
| `sedang` | `Selesai` lebih dari 24 jam | selesai tapi belum diambil |

Status `Diagnosa`, `Menunggu Konfirmasi`, `Menunggu Sparepart` sengaja tidak
dimasukkan: ketiganya menunggu keputusan manusia, bukan kemacetan kerja.

Masing-masing baris menampilkan nomor servis, perangkat, pelanggan, dan
durasi dalam jam ("2h 13j"). Klik baris → `/app/servis/[id]`.

`cervise_services` punya `created_at` **dan** `updated_at`
(`20260925130000_cervise_operational_schema.sql:41-42`). Durasi dihitung dari
`updated_at` — servis yang sudah ditangani lalu menggantung punya `updated_at`
yang jauh lebih baru daripada `created_at`, dan di situlah masalahnya terlihat.
Ambang waktu (24/48 jam) adalah konstanta di
`src/lib/operational/technician-dashboard.ts`, bukan di komponen, supaya bisa
diuji dan diubah di satu tempat.

Kosong → empty state "Tidak ada servis yang butuh perhatian."

### 5.5 Tiga KPI

| Kartu | Nilai | Sumber |
|---|---|---|
| **Target** | `selesai / target` + progress | `branches.intensif_target_count` |
| **Selesai bulan ini** | jumlah servis `Selesai`/`Sudah Diambil` bulan berjalan | `cervise_services` |
| **Rating** | `—` | Tidak ada sumber. Kolom `rating` di `TeknisiPerformanceRow` selalu `null` (`performa-teknisi.ts:118`). Kartu ditampilkan dengan teks "Belum ada penilaian" sampai ada sumberny |

Target memakai `is_intensif_enabled`. Kalau `false`, atau `intensif_target_count`
null/0, kartu menampilkan "Target belum diatur" dengan link ke `/app/analitik-servis`.

Logika `intensif` **tidak** ditulis ulang. `src/lib/operational/performa-teknisi.ts`
sudah punya `is_intensif_enabled`, `intensif_mode`, `intensif_value`,
`intensif_target_count`, dan menghitung `targetPct` (line 97-121). Spec ini
memanggilnya, bukan menduplikasi.

## 6. To-Do — data

### 6.1 Tabel

Migration `add_staff_todos`:

```sql
create table if not exists public.cervise_staff_todos (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cervise_staff_todos_owner_idx
  on public.cervise_staff_todos(employee_id, done_at, due_at);
```

**Tidak ada `organization_id`.** `employee_id` menunjuk ke `profiles.id`, dan
`profiles` tidak punya kolom tenant. Aturan akses diasumsikan dari `cervise_staff_todos.branch_id`
lewat `can_access_tenant_branch(branch_id)` — fungsi yang sudah ada. Menambah
`organization_id` akan menjadi denormalisasi tanpa sumber kebenaran yang bisa
di-update (dipakai `src/lib/operational/performa-teknisi.ts` sebagai catatan).

### 6.2 RLS

```sql
create policy cervise_staff_todos_select on public.cervise_staff_todos
  for select to authenticated
  using (
    public.is_platform_admin()
    or (public.can_access_tenant_branch(branch_id)
        and employee_id = auth.uid())
  );
```

`employee_id = auth.uid()` ada di policy select **dan** write — jadi teknisi lain
di cabang yang sama tidak bisa melihat To-Do rekannya. Ini yang membuat "data
disimpan tiap akun teknisi" benar di level database, bukan hanya di level UI.

Write policy memakai bentuk yang sama plus `with check`. `MASTER_ADMIN` lolos lewat
`is_platform_admin()` untuk keperluan operasional, tapi dashboard hanya
menampilkan baris milik `auth.uid()`.

### 6.3 Server action

`src/app/app/actions.ts`:

```ts
getMyTodos()            // semua To-Do milik auth.uid(), belum selesai di depan
createTodo({ title, dueAt })
updateTodo({ id, title?, dueAt? })
toggleTodo({ id, done })   // set done_at = now() atau null
deleteTodo({ id })
```

Setiap action memanggil `getActiveTenant()` lalu `assertOwnTodo(id)` —
`select id from cervise_staff_todos where id = $1 and employee_id = auth.uid()`.
Pemeriksaan di aplikasi sebagai defense dua lapis: RLS sudah menolak, tapi pesan
error dari RLS tidak informatif.

Return shape: `{ ok: true } | { ok: false; error: string }`, mengikuti pola yang
dipakai action lain di repo (bukan `throw`).

## 7. Analitik Servis sebagai route

`CerviseAnalyticsSection` sudah diekspor dari
`src/components/dashboards-analytics.tsx:47` (dengan
`CerviseAnalyticsSectionProps` di line 38) dan di-render di
`src/app/app/page.tsx:13,138`. Section itu tidak pernah menjadi route sendiri,
padahal sidebar sudah punya `/app/laporan/servis` yang berbeda isi.

Spec ini **membuat route baru** tanpa memindahkan komponen:

- `src/app/app/analitik-servis/page.tsx` (server) → `getDashboardData()` dari
  `src/app/app/actions.ts` (sudah ada, sudah dipakai `src/app/app/page.tsx:19`),
  lalu merender `<CerviseAnalyticsSection>`
- `src/app/app/page.tsx` **tidak berubah** — dashboard `MASTER_ADMIN`/`ADMIN`
  tetap menampilkan section-nya di tempat yang sama

Alasan tidak memindahkan: `CerviseAnalyticsSection` sudah berupa komponen
terpisah yang menerima props. Menjalinya dari `dashboards-analytics.tsx` hanya
mengubah lokasi file tanpa mengubah apa pun yang terlihat, sementara Spec 1
sudah menyatakan dashboard `ADMIN` tidak boleh berubah.

Data tersedia dari `summarizeDashboard` (`src/lib/operational/dashboard.ts:158`)
via `DashboardBucket[]` (line 33) — dipanggil ulang untuk route baru, bukan
dibagikan, karena `getDashboardData()` sudah mengembalikan satu payload
`DashboardData` yang mencakup bucket-nya.

Satu perubahan pada `dashboards-analytics.tsx`: ia menerima
`DateRangeFilter` (`src/components/date-range-filter.tsx`, sudah ada) supaya
route baru punya rentang tanggal. `MASTER_ADMIN`/`ADMIN` di `/app` melihat filter
yang sama — perubahan Presentational, bukan perubahan data.

### 7.1 Warna chart

`--chart-1` sampai `--chart-5` sekarang semuanya abu-abu:
`--chart-1: oklch(0.87 0 0)` dan `--chart-2: oklch(0.556 0 0)`
(`src/app/globals.css:106-107`, diulang di blok `.dark` line 169-170) —
semuanya chroma `0`. Tiga seri LineChart (masuk/diambil/batal) karena itu tidak
dibedakan kecuali oleh tebalan garis.

Spec ini mengganti lima pasangan nilai di `@theme inline` dengan warna
berbeda, tetap oklch, dengan `chroma` dan `hue` eksplisit. Rentang lightness
mempertahankan hierarki nilai yang sekarang dipakai abu-abu: seri utama paling
terang, seri sekunder lebih gelap. Kedua blok (`:root` dan `.dark`) memakai hue
yang sama, lightness berbeda.

Ini perubahan global — `/app/laporan/*` dan `/app/pengaturan/usage` memakai
token yang sama. Itu yang diinginkan: satu palet chart untuk seluruh aplikasi.

## 8. Fungsi murni

`src/lib/operational/technician-dashboard.ts` — mengikuti pola
`src/lib/operational/dashboard.ts` (fungsi murni, tanpa Supabase, diuji penuh):

| Fungsi | Keluaran |
|---|---|
| `buildAttentionQueue(services, now, thresholds)` | Antrean prioritas dengan `reason`, `hoursWaiting`, `priority` |
| `buildTechnicianKpi(services, branchIntensif, now)` | `{ target, selesai, targetPct, unset }` |
| `bucketDueLabel(dueAt, now)` | `"Hari ini"` / `"Besok"` / `"YYYY-MM-DD"` / `"Lewat"` |

Tipe masukan `services` memakai bentuk yang sama dengan
`ServisReportInput` di `src/lib/operational/laporan-servis.ts:3-10` — `{ id,
service_number, created_at, updated_at, branch_id, teknisi_id, status, price,
device }` — supaya `@/lib/operational` punya satu bentuk baris servis.

Semua menerima array datar, bukan hasil query.

## 9. Pengujian

| Test | Isi |
|---|---|
| `src/lib/operational/technician-dashboard.test.ts` | `buildAttentionQueue` dengan `now` tetap: `Masuk` 23h59m (tidak masuk), `Masuk` 24h01m (masuk, `tinggi`), `Dikerjakan` 48h01m (masuk, `tinggi`), `Diagnosa` 72h (**tidak** masuk); `buildTechnicianKpi` dengan `is_intensif_enabled: false`, `target: null`, `target: 0`, `target: 10` dengan 3 selesai (`targetPct` 30); `bucketDueLabel` untuk keempat kasus |
| `src/lib/auth/todos-migration.test.ts` | Isi migration memuat `employee_id = auth.uid()` di **semua** policy tabel `cervise_staff_todos` |
| `src/components/compact-nav.test.ts` | `compactNavFor("TECHNICIAN")` menghasilkan 7 entri persis (§4.3), urut dan tanpa duplikat |

Tidak ada test rendering React — lihat §"Pengujian" di Spec 1.

## 10. Urutan rollout

1. Migration `add_staff_todos` + RLS + test
2. `src/lib/operational/technician-dashboard.ts` + test
3. Server action To-Do (`getMyTodos` dsb.) + `assertOwnTodo`
4. Warna chart di `globals.css`
5. Route `/app/analitik-servis` + `DateRangeFilter` di `dashboards-analytics.tsx`
6. `compact-sidebar.tsx`
7. `compact-shell.tsx`
8. `technician-dashboard.tsx` (To-Do, antrean, KPI)
9. `app/layout.tsx` memilih shell berdasarkan role — `TEKNICIAN` dapat
   `surface` yang memuat `"compact"`, `MASTER_ADMIN`/`ADMIN` tetap `"legacy"`
   saja. `FRONTLINER` **tetap** dapat `legacy` sampai Spec 3, jadi entri
   manifest-nya belum ditulis ulang di sini; Spec 2 hanya menambahkan entri
   baru (`analitik-servis`, `kategori-sparepart`) yang belum punya peran aktif
   di shell lama.

Langkah 9 adalah satu-satunya yang mengubah perilaku untuk role lain, dan
hanya sampai sejauh itu: `MASTER_ADMIN` dan `ADMIN` tetap mendapat shell legacy.
`FRONTLINER` **juga** tetap di shell legacy pada akhir Spec 2. Aturan
seleksi shell: shell ditentukan oleh entri manifest untuk `/app` — kalau entri itu
memuat `"compact"` di `surface` untuk role pengguna, dipakai `CompactShell`; kalau
tidak, `AppShell`. Spec 2 tidak mengubah entri `/app` (tetap `L` untuk semua
role), jadi `FRONTLINER` tidak berpindah. Spec 3 yang mengubahnya.

## 11. Di luar scope

- **Shell compact untuk `FRONTLINER`** — Spec 3 memakai shell ini dengan konten
  dashboard dan tombol header berbeda.
- **Modal saldo awal / tutup toko** — Spec 3.
- **To-Do bersama atau yang ditugaskan** — hanya personal; menambah
  `assigned_by` dan akses baca untuk `ADMIN` belum dibutuhkan.
- **Notifikasi real-time** untuk To-Do — `CommandPaletteProvider` sudah ada tapi
  tidak dipakai untuk sinkronisasi daftar.
- **Mengubah `dashboards-analytics.tsx` Aside dari pemindahan** — section itu
  hanya dipindah, isinya tidak ditulis ulang.
- **Menambah `organization_id` ke `cervise_staff_todos`** — lihat §6.1.

## 12. Risiko

| Risiko | Mitigasi |
|---|---|
| `TECHNICIAN` punya `surface: "compact"` untuk `/app/inventori` dan `/app/kategori-sparepart`, tapi UI-nya belum ada | Spec 1 sudah mengizinkan akses RLS-nya; keduanya di Spec 1 §5. Halaman `/app/kategori-sparepart` sudah ada dan generic |
| Dashboard `MASTER_ADMIN`/`ADMIN` kehilangan analitik karena section-nya dipindah | `app/page.tsx` mengimpor section yang sama dari path baru — isi identik |
| Warna chart baru menurunkan kontras di light mode | Hue dipilih dengan lightness tetap sedekat mungkin dengan nilai lama; dicek visual pada mode terang dan gelap sebelum merge |
| Teknisi tidak punya `branchId` (kode membAllow `null`) | `BranchProvider` sudah memakai `?? "unassigned"` (`app-shell.tsx:640`); baris info cabang menampilkan label itu apa adanya |
| To-Do milik teknisi terlihat oleh teknisi lain | RLS `employee_id = auth.uid()` ada di policy select **dan** write (§6.2), diuji oleh `todos-migration.test.ts` |

## 13. Keputusan yang tidak diambil di sini

- **Menambah kolom `rating` ke `cervise_services`.** Kartu KPI ketiga menampilkan
  "Belum ada penilaian" dan itu jujur. Menambah rating berarti mendefinisikan siapa
  yang menilai, skala berapa, dan apakah itu memengaruhi insentif — bukan
  pekerjaan dashboard.
- **Reuse `src/components/ui/card`.** Referensi devl memakai komponen `Card` lokal
  dengan header `font-mono text-[10px]`. `Card` bawaan shadcn punya header berbeda;
  struktur lokal lebih dekat ke desain yang diminta.
- **Menambah KPI keempat** (mis. rata-rata waktu pengerjaan). Tiga sudah sesuai
  permintaan; menambah metrik tanpa kebutuhan yang nyata hanya menambah query.

