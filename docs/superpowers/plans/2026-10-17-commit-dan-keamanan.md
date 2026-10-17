# Commit working set, lalu perbaikan keamanan

Tanggal: 2026-10-17
Konteks: pindah komputer. Semua konteks di dokumen ini harus ikut pindah ke
mesin baru -- dokumen ini adalah satu-satunya catatan state project.

## Latar Belakang

Audit plan lama (branch-switcher, security-hardening, whatsapp-notifikasi-servis,
sparepart-status-handoff, inventori-variant, role-scoped-access) dilakukan pada
17 Okt 2026. Kesimpulan: **checkbox di plan lama sudah basi, pekerjaannya hampir
semua sudah ada.** Yang benar-benar belum ada jauh lebih sedikit dari yang
terlihat dari centang.

Ringkasan audit:

| Dokumen | Status |
| --- | --- |
| `2026-09-26-sparepart-status-handoff` | DONE |
| `2026-09-25-security-hardening` | 4 dari 5 task DONE; Task 3 partial, Task 5 tidak ada |
| `2026-09-27-whatsapp-notifikasi-servis` | Task 1-9 dan 12 DONE; Task 10 partial, Task 11 tanpa bukti |
| `2026-09-28-role-scoped-access-admin` | Terimplementasi |
| `2026-09-24-inventori-variant-design` | PARTIAL -- create + UI jadi, edit/arsip belum |
| `2026-09-25-branch-switcher-tenant-card` | MISSING -- slot `children` sudah, penyusunannya belum |

Jadi "hilang arah" itu bukan karena fiturnya banyak yang belum -- tapi karena
working set 89 file belum pernah di-commit dan plan lama tidak pernah ditutup.

---

# Fase 0 -- Gerbang verifikasi

JALAN DULU, di komputer lama. Pindah dengan test merah berarti debug di mesin
yang salah.

```powershell
npm run typecheck
npm test
npm run lint
```

Kalau merah: **perbaiki dulu, jangan commit yang merah.**

# Fase 1 -- Terapkan migrasi yang tertinggal

Remote Supabase sudah 2 migration lebih maju dari yang ter-commit:

- `service_completed_at` -- sudah apply sebagai `20260930102838`
- `lacak_appearance` -- sudah apply sebagai `20260930111011`
- `lacak_landing_page` -- **belum apply sama sekali**

File `.sql`-nya ketiganya masih untracked di repo. Langkah:

1. Terapkan `supabase/migrations/20260925360000_lacak_landing_page.sql` lewat
   MCP `apply_migration`, supaya nomornya mengikuti pola dua migration
   sebelumnya (dimulai `20260930...`, bukan `20260925...`).
2. Verifikasi lewat `execute_sql`: objek yang diharapkan benar-benar ada, bukan
   cuma "tidak error".
3. Kalau apply gagal: berhenti, jangan commit file migration yang tidak bisa
   di-apply.

# Fase 2 -- Enam commit

Gaya pesan mengikuti `git log`: conventional prefix, isi Bahasa Indonesia.
`package.json` di-stage per-hunk (`git add -p`) karena punya dua perubahan
yang tidak berkaitan.

### 1. `refactor(deps): ganti paket cn dengan clsx + tailwind-merge lokal`

```
package.json (hunk dependencies)  package-lock.json  components.json
src/lib/cn.ts (baru)  src/lib/utils.ts  src/lib/primitive.ts
src/components/ui/{calendar,chart,dialog,dropdown-menu,dropdown,keyboard,popover,sheet,skeleton,tabs}.tsx
src/components/reui/kanban.tsx
```

### 2. `chore(uji): pisahkan logika bisnis dari server action ke lib yang bisa dites`

```
src/lib/operational/{frontliner-dashboard,periode-bulan,technician-dashboard,laporan-shift,performa-teknisi}.ts + 5 .test.ts
src/lib/onboarding/{validation.ts,validation.test.ts}
src/lib/servis-technisi-label.ts
src/app/app/actions/{cash,technician-dashboard}.ts
src/app/app/laporan/performa/{actions.ts,laporan-performa-client.tsx}
src/app/app/cabang/actions.ts
src/app/app/pengaturan/layout.tsx + layout.test.ts (baru)
src/app/onboarding/actions.ts  src/components/onboarding/stepper.tsx
src/components/cabang/{branch-cards,cabang-drawer}.tsx
src/components/cabang/{branch-identity-guard,intensif-target-mode}.test.ts (baru)
src/components/layout/{app-shell,command-palette}.tsx
scripts/seed-demo-data.mjs  scripts/seed-technisi-guard.test.ts (baru)
supabase/migrations/20260925340000_service_completed_at.sql (baru)
```

### 3. `feat(tampilan): pengaturan tampilan Lacak + landing page publik`

```
src/lib/operational/lacak-appearance.ts + lacak-appearance.test.ts + lacak-appearance-css.test.ts
src/lib/public/{landing,testimonial}.ts + landing.test.ts + testimonial.test.ts
src/app/app/pengaturan/tampilan/{page.tsx,actions.ts,actions.test.ts,landing-actions.test.ts}
src/components/{settings-appearance.tsx,settings-appearance-landing.tsx}
src/components/public/{lacak-form,tenant-badge,lacak-shell,public-header,public-footer,testimonials-carousel}.tsx
src/components/public/public-landing-guard.test.ts (baru)
src/components/interior/{floating-label,inline-validation}.tsx (baru)
src/components/layout/{theme-toggle.tsx,settings-nav.tsx,tenant-logo.tsx (baru)}
src/components/originkit/hero-02-navbar.test.ts (baru)
src/app/{page.tsx,globals.css}
src/app/[slug]/lacak/page.tsx  src/app/[slug]/lacak/[code]/page.tsx
src/app/lacak/actions.ts
supabase/migrations/20260925350000_lacak_appearance.sql (baru)
supabase/migrations/20260925360000_lacak_landing_page.sql (baru)
```

### 4. `refactor(servis): kondisi awal jadi alur satu, bukan dialog terpisah`

```
src/components/servis/{servis-form.tsx,edit-servis-form.tsx}
src/components/servis/kondisi-awal-form.tsx (baru)
src/components/servis/{kondisi-awal-flow,servis-form-fields}.test.ts (baru)
src/components/servis/kondisi-awal-dialog.tsx (dihapus)
```

### 5. `feat(tenant): slot children di kartu tenant untuk branch switcher`

```
src/components/uitripled/multiple-accounts-shadcnui.tsx
```

### 6. `chore(trial): skrip verifikasi gerbang trial berakhir`

```
scripts/verify-trial-expiry.ts (baru)
package.json (hunk scripts)
```

Lalu `git push origin main`. Saat dokumen ini dibuat, `main` masih **ahead 1**
(`17c746c` belum push).

---

# Backlog -- lanjut di mesin baru

## Prioritas 1: `adjust_product_stock` punya overload yang lolos ledger

`supabase/migrations/20260925220000:172-228` membuat ulang fungsi 3-arg
`(uuid, integer, integer)` yang mengubah `cervise_products.stock_qty` inline
**tanpa** memanggil `apply_stock_delta`. Akibatnya tidak ada baris
`cervise_stock_movements` dan tidak ada validasi `reason` -- bertentangan dengan
invariant yang didokumentasikan di `20260925150000:108-110`. Fungsi ini
di-`grant execute` ke `authenticated`.

Langkah:

1. Migration baru: `revoke all on function public.adjust_product_stock(uuid, integer, integer) from authenticated, anon, public;`
   lalu `drop function if exists public.adjust_product_stock(uuid, integer, integer);`
2. `src/app/app/penjualan/actions.ts:340,376` -- pindah ke signature 6-arg. Baca
   nama parameter aktual dari `20260925150000` saat implementasi, lalu isi
   `p_branch_id`, `p_reason`, `p_expected_stock`.
3. `src/app/app/penjualan/actions.test.ts:189` -- update bentuk panggilan rpc.
4. Guard test yang menguji grant 3-arg ikut diperbarui:
   `src/lib/auth/rbac-migration.test.ts:164-165` dan
   `src/lib/auth/product-stock-migration.test.ts:37-38`.
5. Test penjaga baru di `src/lib/auth/` mengikuti pola yang sudah dipakai proyek:
   baca file SQL, lalu assert tidak ada lagi `create or replace function
   public.adjust_product_stock(` dengan 3 parameter.

## Prioritas 2: empat RPC fail-open untuk profil nonaktif / tenant diblokir

`caller_branch_role` (`20260925150000:218-231`) hanya mengecek
`employees.profile_id`, `branch_id`, dan `employees.is_active`. Ia **tidak**
memeriksa `profiles.is_active`, `organizations.status`, atau status subscription.
Empat RPC yang memakainya di-`grant execute` ke `authenticated` dan bisa dipanggil
langsung dengan anon key, sehingga melewati gate `getActiveTenant()`:
`set_service_status`, `consume_service_spareparts`, `return_service_spareparts`,
`mark_service_spareparts_kept`.

Langkah:

1. **Jangan tulis cek baru.** `can_access_tenant_branch`
   (`20260925122000:103-136`) sudah memeriksa ketiganya. Salin kondisi yang sudah
   ada ke dalam body `caller_branch_role`.
2. Migration baru: `create or replace` untuk `caller_branch_role` saja.
3. Guard test: assert `caller_branch_role` memuat `profiles.is_active` dan
   pengecekan status organisasi.
4. Smoke SQL: nonaktifkan `profiles`, panggil `set_service_status`, harus ditolak.

## Prioritas 3: endpoint lacak membocorkan data lintas tenant tanpa auth

`src/app/lacak/actions.ts:142-151` memfilter hanya `tracking_code`. Argumen
`slug` hanya dipakai untuk rate-limit (`:137-138`), tidak pernah untuk membatasi
query. Kode milik tenant B akan terbuka di halaman tenant A dan membocorkan
`branchName`, `teknisiName`, riwayat status dari `cervise_service_logs`, device,
dan garansi. Tidak butuh autentikasi; penghalang terakhir hanya entropi 40-bit
dan rate-limit yang bisa dilewati dengan mengganti `slug`.

Langkah:

1. `lookupServisByCode(slug, rawCode)` -- resolusikan tenant dari `slug` dulu.
   Helper slug-ke-organisasi **sudah ada di file yang sama** (~`:121`), pakai itu.
   Lalu tambahkan `.eq("organization_id", tenantId)`.
2. Kalau tenant tidak ditemukan, kembalikan `PUBLIC_LOOKUP_UNAVAILABLE_MESSAGE`
   yang sama supaya tidak bisa dipakai untuk enumerasi tenant.
3. Test dengan Supabase ter-mock: kode milik tenant B yang dicari di bawah slug
   tenant A harus hasilnya unavailable. Pola mock sudah ada di
   `src/app/app/penjualan/actions.test.ts`.

## Prioritas 4: `ADMIN` bisa reset password karyawan cabang lain

`src/app/app/karyawan/actions.ts:319-337`: guard-nya `requireManager` (menerima
`ADMIN`), lookup hanya memfilter `organization_id` (`:322`), lalu dipanggil
`supabase.auth.resetPasswordForEmail(email)` (`:333`). RLS branch-scoped di
`20260925220000:47-68` tidak menyentuh jalur auth ini. `getKaryawan()` (`:52`)
juga org-wide.

## Prioritas 5: `employees_select` tenant-wide, bukan branch-scoped

`20260925090000:345-347` mengizinkan setiap karyawan aktif membaca seluruh baris
`employees`. Spec §5 hanya mempersempit insert/update/delete, jadi admin cabang A
masih bisa membaca `profile_id`, `role`, dan `branch_id` karyawan cabang B.

## Minor (ditemukan saat audit, belum 계획을 rinci)

- Helper `security definer` di-grant ke `authenticated` (`20260925122000:4-9,
  98-101, 138-139, 213-216`) sehingga jadi oracle keanggotaan organisasi.
  `is_platform_admin(uuid)` adalah oracle platform-admin untuk UUID mana pun.
- `profiles` self-update bergantung sepenuhnya pada satu grant kolom
  (`20260925122000:35`). Grant `update`/`all` di masa depan membuka kembali
  setteran ulang `role`/`branch_id`.
- Baca-tulis `profiles` lewat service role di `karyawan/actions.ts:291-296,408`
  dan `master-admin-actions.ts:106`. Target binding-nya benar, tapi sekali
  `profileId` dari client masuk lagi, itu langsung menjadi account takeover
  lintas tenant tanpa sandar RLS.
- `security-hardening` Task 3: `isEmployeeTargetInOrganization` dipanggil
  **tanpa** argumen `branchId` (`karyawan/actions.ts:211,382`), jadi
  kesetaraan cabang tidak pernah ditegaskan di kode aplikasi.
- `security-hardening` Task 5: nol artefak verifikasi tercatat di repo.

## Fitur yang memang belum ada

- **Branch switcher di dalam kartu tenant** (plan 2026-09-25). Slot `children`
  sudah ada, penyusunannya belum: `src/components/layout/app-shell.tsx:48-64`,
  `:91-106`, dan blok `:207-209`. **Plan teksnya sudah salah** -- `BranchSwitcher`
  sekarang wajib prop `canSwitch`, dan sidebar memakai mode `bare` tanpa card
  chrome, jadi ada risiko overflow di header `h-16` dan popover tidak bisa
  menaikkan stacking context.
- **Inventori: edit & arsip produk.** Tidak ada `updateProduct`/`deleteProduct`
  di mana pun. Bekas yang terjual tidak di-`is_active=false`. Sort harga/stok dan
  sort BH belum ada (`INVENTORI_DEFAULTS` hanya punya `q`/`tipe`/`stok`).
- **Seed demo masih bisa mengirim WhatsApp sungguhan.**
  `scripts/seed-demo-data.mjs:388` menghapus baris outbox *sesudah* insert;
  RPC `cervise_set_notification_suppression` tidak pernah dipanggil. Ada race
  window yang diakui sendiri di komentar file.
- **Task 11 plan WhatsApp**: tidak ada bukti typecheck, build, ESLint terarah,
  atau census versi migration.

## Utangaside teknis

- Nama file migration lokal tidak sama dengan nomor versi yang ter-apply.
  Jangan `supabase db push` buta di mesin baru -- ia akan mencoba menerapkan
  ulang migration yang sudah jalan.
- README masih default `create-next-app`.
- Checkbox di `docs/superpowers/plans/2026-09-2*.md` sudah basi dan sebaiknya
  dicentang ulang atau ditandai usang.
