# Owner Tenant Detail Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hilangkan duplikasi field paket/harga dan form status akses manual di halaman tenant detail owner, serta rapikan layout kartu Subscription menjadi versi ringkas.

**Architecture:** Tiga komponen client/server-existing diubah secara lokal tanpa mengubah server action atau RPC. `SubscriptionForm` tinggal satu form, `ExtendSubscription` mewarisi nilai subscription, halaman detail menyusun ulang kartu. Tidak ada state global, context, atau dependency baru.

**Tech Stack:** Next.js 16 App Router (Turbopack), React client components, shadcn/Base UI, TypeScript, Vitest (source-assertion tests mengikuti pola `src/components/layout/brand-logo.test.ts`).

**Spec:** `docs/superpowers/specs/2026-11-17-owner-tenant-detail-polish-design.md`

## Global Constraints

- Jangan mengubah `src/app/owner/actions.ts` atau RPC `platform_*` apa pun.
- Badge `DB: <status>` (logika `isMismatch` di halaman detail) **tetap tampil**.
- Tombol Perpanjang tetap disabled bila `packages.length === 0` atau `subscription == null`.
- `extendTenantSubscription` tetap menerima `{ organizationId, packageId, customPrice, months, referenceNote }` — klien mengirim `packageId`/`customPrice` dari subscription yang ada, bukan dari input baru.
- Teks UI berbahasa Indonesia seperti di spec: tombol “Simpan pengaturan”, judul form “Pengaturan langganan”.
- Worktree memuat perubahan konkuren; commit hanya file yang tercantum di task.

## Review Focus

- `subscription == null` → form pengaturan memakai paket pertama, grace 3, custom price kosong; Perpanjang disabled. Test: Task 1 & 2 (state inisial).
- Badge mismatch `DB:` harus tetap muncul saat status DB berbeda dengan `accessState` → Task 3 test badge.
- Custom price `null` / `""` harus diteruskan sebagai `null` ke `extendTenantSubscription`, bukan `0` → Task 2 test source.
- Grace days 0 harus tetap valid (bukan dianggap kosong) → Task 1 test source.
- Status manual tidak boleh lagi muncul di UI, tetapi server action `updateTenantSubscription` tidak dihapus → Task 1 test source.

---

### Task 1: Sederhanakan `SubscriptionForm`

**Files:**
- Modify: `src/components/owner/subscription-form.tsx`
- Test: `src/components/owner/tenant-detail-polish.test.ts` (dibuat di Task 1)

**Interfaces:**
- Consumes: `adjustTenantSubscription({ organizationId, packageId, customPrice, graceDays })` dari `@/app/owner/actions`.
- Produces: komponen `SubscriptionForm({ organizationId, subscription, packages })` dengan satu form saja; props tidak berubah.

- [ ] **Step 1: Tulis test gagal**

Buat `src/components/owner/tenant-detail-polish.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const form = read("src/components/owner/subscription-form.tsx");

describe("SubscriptionForm", () => {
  it("hanya satu form pengaturan, tanpa status akses manual", () => {
    expect(form.match(/<form/g) ?? []).toHaveLength(1);
    expect(form).toContain("Pengaturan langganan");
    expect(form).not.toContain("updateTenantSubscription");
    expect(form).not.toContain("LIFECYCLE_STATUSES");
    expect(form).not.toContain("Ubah status akses");
  });

  it("grace days 0 tetap diteruskan", () => {
    expect(form).toContain('value={graceDays}');
    expect(form).toContain("adjustTenantSubscription(");
  });

  it("tanpa subscription memakai paket pertama dan grace 3", () => {
    expect(form).toContain('subscription?.package_id ?? packages[0]?.id ?? ""');
    expect(form).toContain('String(subscription?.grace_days ?? 3)');
    expect(form).toContain('subscription?.custom_monthly_price === null || !subscription ? ""');
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/owner/tenant-detail-polish.test.ts`
Expected: FAIL (form masih punya 2 `<form>` dan `updateTenantSubscription`).

- [ ] **Step 3: Implementasi minimal**

Di `src/components/owner/subscription-form.tsx`:
- Hapus import `ShieldAlertIcon`, `updateTenantSubscription`, konstanta `LIFECYCLE_STATUSES`.
- Hapus state `status`, `saving` type `"status"`, fungsi `saveStatus`.
- Hapus `<form className="space-y-3 border-t pt-5" ...>` beserta isinya (baris 76–87).
- Ubah `saving` menjadi `useState(false)`; di `saveSettings` panggil `setSaving(true)` / `setSaving(false)`; `loading={saving}`.
- Ubah judul `<div className="text-sm font-medium">Paket, harga & grace</div>` menjadi `Pengaturan langganan`.
- Biarkan `packageId`, `customPrice`, `graceDays` dan state inisialnya apa adanya.

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/components/owner/tenant-detail-polish.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/owner/subscription-form.tsx src/components/owner/tenant-detail-polish.test.ts
git commit -m "refactor(owner): hapus form status akses manual tenant"
```

---

### Task 2: Perpanjang mewarisi paket & harga

**Files:**
- Modify: `src/components/owner/extend-subscription.tsx`
- Test: `src/components/owner/tenant-detail-polish.test.ts`

**Interfaces:**
- Consumes: prop `subscription` dengan `{ package_id, custom_monthly_price, current_period_end }`; `extendTenantSubscription({ organizationId, packageId, customPrice, months, referenceNote })`.
- Produces: komponen `ExtendSubscription({ organizationId, subscription, monthlyPrice })` — prop `packages` dihapus; `monthlyPrice` adalah harga efektif yang dihitung halaman (`custom_monthly_price ?? package.monthly_price ?? 0`). Semua pemanggil disesuaikan di Task 3.

- [ ] **Step 1: Tambah test gagal**

Tambahkan ke file test yang sama:

```ts
const extend = read("src/components/owner/extend-subscription.tsx");

describe("ExtendSubscription", () => {
  it("tidak punya pilihan paket/harga dan mengirim nilai dari subscription", () => {
    expect(extend).not.toContain('id="extend-package"');
    expect(extend).not.toContain('id="extend-price"');
    expect(extend).not.toContain("getEffectiveMonthlyPrice");
    expect(extend).toContain("packageId: subscription?.package_id ?? \"\"");
    expect(extend).toContain("customPrice: subscription?.custom_monthly_price ?? null");
  });

  it("tetap menampilkan durasi, catatan, dan preview", () => {
    expect(extend).toContain('id="extend-duration"');
    expect(extend).toContain('id="extend-note"');
    expect(extend).toContain("preview.endsAt");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/owner/tenant-detail-polish.test.ts`
Expected: FAIL (masih ada `extend-package` / `getEffectiveMonthlyPrice`).

- [ ] **Step 3: Implementasi minimal**

Di `src/components/owner/extend-subscription.tsx`:
- Hapus `useState` untuk `packageId` dan `customPrice`.
- Hapus prop `packages` dan type `PackageOption`; hapus import `getEffectiveMonthlyPrice`.
- Perluas type `Subscription` jadi:
  `{ package_id: string; custom_monthly_price: number | null; current_period_end: string | null } | null`.
- Tambah prop `monthlyPrice: number` ke signature komponen. Hapus `selectedPackage`; preview total memakai `monthlyPrice * months` (harga efektif dihitung halaman, bukan 0 saat custom price null).
- Di `submit()`, kirim:
  ```ts
  await extendTenantSubscription({
    organizationId,
    packageId: subscription?.package_id ?? "",
    customPrice: subscription?.custom_monthly_price ?? null,
    months,
    referenceNote,
  });
  ```
- Toast sukses: `Diperpanjang s/d ...` tanpa menyebut nama paket.
- Hapus blok `<div className="space-y-1.5">` untuk `extend-package` dan grid field `extend-price`.
- Biarkan `disabled={packages.length === 0}` di tombol diganti `disabled={!subscription}`.

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run src/components/owner/tenant-detail-polish.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/owner/extend-subscription.tsx src/components/owner/tenant-detail-polish.test.ts
git commit -m "refactor(owner): perpanjang mewarisi paket dan harga tenant"
```

---

### Task 3: Susun ulang kartu Subscription di halaman detail

**Files:**
- Modify: `src/app/owner/tenants/[id]/page.tsx`
- Test: `src/components/owner/tenant-detail-polish.test.ts`

**Interfaces:**
- Consumes: `ExtendSubscription({ organizationId, subscription, monthlyPrice })` (tanpa `packages`); `SubscriptionForm({ organizationId, subscription, packages })`.
- Produces: halaman detail dengan kartu Subscription ringkas; badge `DB:` tetap ada.

- [ ] **Step 1: Tambah test gagal**

```ts
const detail = read("src/app/owner/tenants/[id]/page.tsx");

describe("Tenant detail layout", () => {
  it("memakai ExtendSubscription tanpa prop packages", () => {
    const start = detail.indexOf("<ExtendSubscription");
    const body = detail.slice(start, start + 300);
    expect(body).toContain("organizationId={organization.id}");
    expect(body).toContain("subscription={subscription}");
    expect(body).toContain("monthlyPrice={");
    expect(body).not.toContain("packages=");
  });

  it("badge DB mismatch tetap tampil", () => {
    expect(detail).toContain("isMismatch");
    expect(detail).toContain("DB: {subscription?.status}");
  });

  it("tiga metrik utama dan detail sekunder hadir", () => {
    expect(detail).toContain("Harga / bulan");
    expect(detail).toContain("Akses s/d");
    expect(detail).toContain("Periode mulai");
    expect(detail).toContain("Grace berakhir");
    expect(detail).toContain("Grace days");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/components/owner/tenant-detail-polish.test.ts`
Expected: FAIL (masih ada `packages=...` di `<ExtendSubscription`).

- [ ] **Step 3: Implementasi minimal**

Di `src/app/owner/tenants/[id]/page.tsx`:
- Pada `<ExtendSubscription ... />`, hapus baris `packages={packages.map(...)}` dan tambahkan:
  ```tsx
  monthlyPrice={subscription?.custom_monthly_price ?? subscription?.package.monthly_price ?? 0}
  ```
- Biarkan `<SubscriptionForm ... packages={...} />` apa adanya.
- Susun ulang isi `<CardContent>` kartu Subscription:
  - Baris badge: `<Badge variant={statusVariant(accessState)}>Akses: {accessState}</Badge>` + badge `DB:` bila `isMismatch` + teks blocked — **tanpa perubahan logika**.
  - Grid 3 metrik: Paket, Harga / bulan, `Trial berakhir`/`Akses s/d`.
  - Baris sekunder dalam satu `<div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">` berisi tiga pasangan label–nilai: Periode mulai, Grace berakhir, Grace days (hapus 6-kotak `grid sm:grid-cols-3` lama).
  - `<SubscriptionForm>` tetap di bawah `border-t pt-5`.
- Pastikan `packages` tetap dipakai `<SubscriptionForm>` (variabel tidak unused).

- [ ] **Step 4: Verifikasi seluruh proyek**

Run: `npm run build`
Expected: PASS (kompilasi + type check). Jika type check gagal karena file konkuren di luar scope ini, laporkan tanpa mengubahnya.

Run: `npm test -- --run`
Expected: PASS, kecuali 2 kegagalan baseline yang sudah ada (`shell-chrome.test.ts` `col-start-3`, `pickup-signature-dialog.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/app/owner/tenants/[id]/page.tsx src/components/owner/tenant-detail-polish.test.ts
git commit -m "refactor(owner): rapikan layout detail tenant"
```
