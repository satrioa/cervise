# Branch Switcher di Dalam Kartu Tenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pindahkan `BranchSwitcher` ke dalam section kartu `TenantSwitcher`, tepat di bawah tombol tenant aktif.

**Architecture:** Tambahkan slot `children` opsional pada `MultipleAccounts`, teruskan `<BranchSwitcher />` dari `TenantSwitcher`, lalu hapus pemanggilan `BranchSwitcher` yang terpisah dari `SidebarContent`.

**Tech Stack:** Next.js, React 19, TypeScript, Tailwind CSS, Base UI Popover, Framer Motion.

**Spec:** `docs/superpowers/specs/2026-09-25-branch-switcher-di-dalam-kartu-tenant-design.md`

## Global Constraints

- Jangan memindahkan `TenantProvider` atau `BranchProvider`.
- Jangan mengubah format tenant, branch, cookie, localStorage, atau event lintas tab.
- Jangan memindahkan branch ke dalam dropdown/list tenant.
- Perubahan harus berlaku untuk sidebar desktop dan drawer mobile melalui `SidebarContent` yang sama.
- Verifikasi akhir memakai `npm run typecheck`, `npm run lint`, dan `npm test`.

## Review Focus

- Tenant sedang loading lalu branch tidak dapat diakses: branch tetap terlihat di bawah pesan loading.
- Daftar tenant kosong lalu branch tidak dapat diakses: branch tetap terlihat di bawah pesan tenant kosong.
- Popover branch terpotong oleh kartu tenant: buka tenant dan branch, pastikan popover branch tampil penuh.
- Drawer mobile tidak ikut berubah: buka drawer mobile dan pastikan branch berada di dalam kartu tenant.
- Urutan fokus keyboard membingungkan: tekan `Tab` dari tombol tenant ke tombol branch dan pastikan urutannya masuk akal.

---

## File Structure

- Modify: `src/components/uitripled/multiple-accounts-shadcnui.tsx`
  - Bertanggung jawab menyediakan slot `children` di dalam section kartu tenant.
- Modify: `src/components/layout/app-shell.tsx`
  - Bertanggung jawab menyusun `BranchSwitcher` di dalam `TenantSwitcher` dan menghapus pemanggilan terpisah di `SidebarContent`.

Repository ini belum memiliki infrastruktur testing DOM, sehingga tidak ada file Vitest baru untuk komposisi JSX. Verifikasi memakai typecheck, lint, test yang ada, dan pemeriksaan manual yang eksplisit.

---

### Task 1: Tambahkan slot branch di dalam kartu tenant

**Files:**
- Modify: `src/components/uitripled/multiple-accounts-shadcnui.tsx:17-24`
- Modify: `src/components/uitripled/multiple-accounts-shadcnui.tsx:55-62`
- Modify: `src/components/uitripled/multiple-accounts-shadcnui.tsx:83-108`

**Interfaces:**
- Consumes: `ReactNode` dari `react`.
- Produces: prop baru `MultipleAccountsProps.children?: ReactNode` yang dirender di dalam `motion.section`.

- [ ] **Step 1: Tambahkan `ReactNode` dan prop `children`**

```tsx
import { useId, useState, type ReactNode } from "react";
```

```tsx
type MultipleAccountsProps = {
  accounts: AccountOption[];
  value: string | null;
  onValueChange: (id: string) => void;
  onManage?: () => void;
  className?: string;
  manageLabel?: string;
  children?: ReactNode;
};
```

- [ ] **Step 2: Terima `children` dalam signature komponen**

```tsx
export function MultipleAccounts({
  accounts,
  value,
  onValueChange,
  onManage,
  className,
  manageLabel = "Kelola tenant",
  children,
}: MultipleAccountsProps) {
```

- [ ] **Step 3: Render slot branch di dalam section kartu**

Sisipkan blok berikut setelah tombol tenant utama ditutup pada baris 106 dan sebelum `<AnimatePresence>` pada baris 108:

```tsx
{children ? (
  <div className="mt-2 border-t border-border/60 pt-2">
    {children}
  </div>
) : null}
```

- [ ] **Step 4: Jalankan typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/uitripled/multiple-accounts-shadcnui.tsx
git commit -m "feat: add tenant card slot for branch switcher"
```

---

### Task 2: Susun branch di dalam tenant dan hapus pemanggilan terpisah

**Files:**
- Modify: `src/components/layout/app-shell.tsx:157-183`
- Modify: `src/components/layout/app-shell.tsx:244-254`

**Interfaces:**
- Consumes: slot `children` dari Task 1 dan fungsi `BranchSwitcher` yang sudah ada di file yang sama.
- Produces: `TenantSwitcher` sebagai satu-satunya switcher yang dirender oleh `SidebarContent`.

- [ ] **Step 1: Pertahankan akses branch saat tenant loading**

Ganti early return loading berikut:

```tsx
if (loading) return <div className="px-3.5 py-3 text-xs text-muted-foreground">Memuat tenant...</div>;
```

dengan:

```tsx
if (loading) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Memuat tenant...
      </div>
      <BranchSwitcher />
    </div>
  );
}
```

- [ ] **Step 2: Pertahankan akses branch saat daftar tenant kosong**

Ganti early return tenant kosong berikut:

```tsx
if (!tenants.length) return (
  <div className="border-b border-border/60 px-3.5 py-3">
    <div className="text-sm font-medium">Belum ada Tenant</div>
    <div className="text-xs text-muted-foreground">Buat tenant di /owner</div>
  </div>
);
```

dengan:

```tsx
if (!tenants.length) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
        <div className="text-sm font-medium">Belum ada Tenant</div>
        <div className="text-xs text-muted-foreground">Buat tenant di /owner</div>
      </div>
      <BranchSwitcher />
    </div>
  );
}
```

- [ ] **Step 3: Teruskan branch ke dalam kartu tenant normal**

Ganti return normal berikut:

```tsx
return (
  <MultipleAccounts
    accounts={accounts}
    value={activeOrgId}
    onValueChange={setActiveOrg}
    onManage={() => router.push("/owner/new")}
    manageLabel="Buat Tenant Baru"
    className="rounded-xl p-2"
  />
);
```

dengan:

```tsx
return (
  <MultipleAccounts
    accounts={accounts}
    value={activeOrgId}
    onValueChange={setActiveOrg}
    onManage={() => router.push("/owner/new")}
    manageLabel="Buat Tenant Baru"
    className="rounded-xl p-2"
  >
    <BranchSwitcher />
  </MultipleAccounts>
);
```

- [ ] **Step 4: Hapus pemanggilan branch terpisah dari sidebar**

Ganti blok berikut:

```tsx
<div className="space-y-2 border-b border-border/60 px-2 py-2">
  <TenantSwitcher />
  <BranchSwitcher />
</div>
```

dengan:

```tsx
<div className="border-b border-border/60 px-2 py-2">
  <TenantSwitcher />
</div>
```

- [ ] **Step 5: Jalankan pemeriksaan regresi**

Run:

```bash
npm run typecheck
```

Expected: PASS.

Run:

```bash
npm run lint
```

Expected: PASS tanpa error baru.

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Verifikasi manual desktop**

1. Jalankan aplikasi dan buka `/app` pada viewport desktop.
2. Pastikan branch tampil di dalam kartu tenant, di bawah tombol tenant aktif.
3. Buka dropdown tenant, lalu buka popover branch.
4. Pastikan popover branch tidak terpotong oleh kartu tenant.
5. Ganti branch dan pastikan konten sesuai branch aktif.

Expected: semua perilaku di atas benar.

- [ ] **Step 7: Verifikasi manual mobile dan kondisi tenant**

1. Buka drawer navigasi mobile.
2. Pastikan branch berada di dalam kartu tenant.
3. Muat ulang `/app` dan amati status loading tenant; pastikan branch tetap dapat diakses.
4. Untuk tenant kosong, gunakan akun tanpa organisasi dan tanpa employee aktif bila tersedia.
5. Jika akun tersebut tidak tersedia, lewati verifikasi tenant kosong dan catat sebagai belum terverifikasi.
6. Tekan `Tab` dari tombol tenant ke tombol branch dan pastikan urutan fokus masuk akal.

Expected: semua perilaku di atas benar.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/app-shell.tsx
git commit -m "feat: nest branch switcher inside tenant card"
```
