# Plan — Dashboard Tenant Slug (`/dashboard/tenant/{namaTenant}`) — No Encrypt

**Date:** 2026-09-24  
**Status:** Approved — user Setuju slug polos tanpa encrypt, shareable untuk employee, mudah diingat.  
**Context:** Landing `Dashboard` sebelumnya `href="/app"` langsung ke operasional. User klarifikasi: klik Dashboard → `/owner/dashboard/tenant` (kelola tenant), klik tenant → `/owner/dashboard/tenant/{namaTenant}` → dari sini akses dashboard operasional yang sudah ada (employee login dari sini). Final: `/dashboard/tenant/{encrypted}` adalah route dashboard operasional, tapi user pilih **nama tenant aja tanpa Base64** (`Base64Url id:slug` ditolak karena tidak memorable untuk dibagikan).

## Decision

- **Route canonical:** `/dashboard/tenant/{slug}` dimana `slug = slugify(name)` lower, hyphen, `a-z0-9-`. Contoh `Cervise Pusat` → `cervise-pusat`.
- **No encrypt.** Lookup `organizations where slug = param and id IN (select organization_id from employees where profile_id=auth.uid() and is_active)`. Jika 0 → 404/redirect `/owner?error=unauthorized`.
- **Masuk ke dashboard** link = URL yang sama (`/dashboard/tenant/cervise-pusat`) — dipakai owner & employee (shareable). Tidak perlu `id:slug` di URL, tapi tetap simpan `id` di cookie `cervise_org` setelah decrypt-lookup.
- **Stability:** Slug **lock saat create**, rename tenant tidak ubah slug (atau simpan old_slugs untuk redirect 308). Unique per `created_by` + slug (suffix `-2` jika duplikat).

## Architecture

```
User Daftar → Login → middleware: employees count 0 → redirect /owner
  ↓
/owner/dashboard/tenant (daftar tenant user) — getTenants() filter created_by OR employees
  ↓ klik tenant
/dashboard/tenant/cervise-pusat — decrypt slug? No, lookup slug → validate employees → set cookie cervise_org=id → render operasional dashboard (reuse AppShell + TenantProvider activeOrgId=id) — isActive check + paket trial
  ↓ Masuk ke dashboard (same URL, shareable)
Employee (sudah di-invite via karyawan/actions) klik link yang dibagikan → middleware auth → if employees has org → langsung dashboard, else redirect /owner
```

**Vercel mental model preserved:** `Tenant = Organization`, `Branch = Project` (cabang). Tenant switcher di `app-shell` tetap baca `organizations` milik user.

## Data Model

- **Migration:** `organizations add column slug text` + `unique index (created_by, slug)` + `check slug ~ ^[a-z0-9-]+$`, backfill `update organizations set slug = lower(regexp_replace(name,'[^a-z0-9]+','-','g')) where slug is null`, trigger on insert to generate slug + suffix `-2` jika collision per `created_by`.
- **Existing:** `organizations(id, name, paket, trial_ends_at, created_by)`, `branches(organization_id)`, `employees(organization_id, branch_id, profile_id, role, is_active)` — tidak ubah, hanya tambah slug.

## Routes & Files

**Baru:**
- `src/lib/tenant-slug.ts` — `slugify(name)` reuse `cabang/create-cabang-dialog:10` + `deslug` helper (lower).
- `src/app/dashboard/tenant/page.tsx` — redirect ke `/owner/dashboard/tenant` (alias) atau daftar tenant (pilih salah satu, usulan redirect).
- `src/app/dashboard/tenant/[tenant]/page.tsx` — server `params.tenant` slug → lookup org → validate `employees` → `cookies().set("cervise_org", id)` → render operasional dashboard (import `DashboardOverview` dari `src/app/app/page.tsx` atau `AppShell` children).
- `src/app/owner/dashboard/tenant/page.tsx` — pindah logic daftar dari `owner/page.tsx:8` ke sini (opsional, bisa keep `owner/page.tsx` sebagai redirect).

**Edit:**
- `src/app/owner/actions.ts:1` — `createTenant` generate `slug` + cek duplikat per `created_by` → suffix, insert `organizations {name, slug, paket, trial_ends_at, created_by}` + `branches` + `employees MASTER_ADMIN`.
- `src/app/owner/page.tsx` — jadi `redirect("/dashboard/tenant")` atau keep daftar tapi link `href="/dashboard/tenant/${org.slug}"` bukan `?org=id`.
- `src/components/originkit/hero-02.tsx:96` & `src/app/page.tsx:58` — `Dashboard href` → `/dashboard/tenant` (bukan `/app`), unauthenticated → `/login?next=/dashboard/tenant`.
- `middleware.ts:1` — guard `/dashboard/tenant/*` sama seperti `/app/*` (`auth` + `employees` check), set `cervise_org` cookie dari slug param jika valid.
- `src/lib/tenant-context.tsx:1` — prioritas `params.tenant` slug (dari URL) > `cookie cervise_org` > first tenant.
- `src/lib/supabase/actor.ts:1` — `getActiveTenant` baca slug dari URL jika ada, fallback cookie, validate `is_active`.

## UI

- **Owner dashboard tenant list** (`/dashboard/tenant`): `Card` daftar tenant `name` + `paket` badge + `cabangCount` + `Trial Ends` → `Button Masuk ke dashboard` → `href="/dashboard/tenant/${org.slug}"` (shareable, mudah ingat).
- **Tenant dashboard** (`/dashboard/tenant/[tenant]`): header `Tenant: Cervise Pusat · Paket Pro` + `BranchSwitcher` (Project) + `DashboardOverview` (servis/penjualan) + `Masuk ke dashboard` link yang sama dipakai employee (tidak perlu login ulang, sudah `employees` row).
- **Share:** owner copy URL `https://.../dashboard/tenant/cervise-pusat` → employee klik → jika belum login → `/login?next=...` → login → `getActiveTenant` → dashboard.

## Verification

- Unauthenticated `Dashboard` → `/login`, login tanpa tenant → `/owner` (buat tenant).
- Buat tenant `Cervise Pusat` + `Cervise Pusat` lagi → slug `cervise-pusat` & `cervise-pusat-2` (unique per user).
- Klik tenant → URL `cervise-pusat` → decrypt (lookup) → cookie `cervise_org` set → `AppShell` menampilkan cabang tenant itu.
- Share `cervise-pusat` ke employee (sudah `employees` insert) → employee buka → langsung dashboard tanpa 404.
- Rename tenant tidak ubah URL (slug lock) → old slug redirect 308 ke new slug (opsional future).

## Risks

- Nama duplikat global (2 user buat `Cervise Pusat`) → tidak tabrakan karena unique per `created_by`, tapi slug `cervise-pusat` bisa sama antar user — lookup harus `where slug AND organization_id IN (employees orgs)` jadi aman.
- Slug collision race → handle `23505` → retry suffix `-2`.
- Rename → bookmark lama 404 → mitigasi lock slug.

---
Approved: 2026-09-24 — next: Build Mode execution (migration + 3 new files + 5 edits).
