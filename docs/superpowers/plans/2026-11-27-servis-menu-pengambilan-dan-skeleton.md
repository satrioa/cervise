# Menu Pengambilan Servis dan Skeleton Dialog Bayar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menu konteks dan swipe servis menawarkan "Diambil" setelah lunas, "Bayar" sebelum lunas, dan skeleton dialog bayar menyerupai layout konten akhir.

**Architecture:** `ServisContextMenu` memakai `servis.payment` + `servis.status`; `page.tsx` memakai `getPaymentStatus(s)` + `s.status`. Keduanya memanggil jalur `onStatusChange(..., "Sudah Diambil")` yang sudah mewajibkan tanda tangan. Dialog bayar memakai komponen skeleton lokal dengan grid yang sama dengan konten siap.

**Tech Stack:** Next.js App Router, React/TypeScript, Tailwind, lucide-react `TruckIcon`, Base UI Dialog, Vitest (source-text tests).

**Spec:** `docs/superpowers/specs/2026-11-27-servis-menu-pengambilan-dan-skeleton-design.md`

## Global Constraints

- Pembayaran wajib lunas sebelum pengambilan; status `Sudah Diambil` tidak boleh menawarkan Bayar maupun Diambil.
- Aksi Diambil harus lewat `onStatusChange(..., "Sudah Diambil")` / `handleStatusChange(s, "Sudah Diambil")`, bukan server action baru.
- Swipe Diambil memakai `keepRow: true`.
- Skeleton memakai grid `md:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]`, sama dengan konten siap.
- Tidak ada perubahan DB, RLS, pricing, atau alur status.

## Review Focus

- Servis lunas & status `Masuk`/`Selesai` harus muncul Diambil, bukan Bayar — diuji Task 1.
- Servis belum lunas harus tetap muncul Bayar di menu dan swipe — diuji Task 1.
- Servis status `Sudah Diambil` harus tidak punya menu/swipe Bayar atau Diambil — diuji Task 1.
- Aksi Diambil di desktop, sheet, dan swipe harus memanggil status change ke `Sudah Diambil` — diuji Task 1.
- Skeleton tidak boleh lagi berupa satu blok `h-40` dan harus mengikuti grid dua kolom — diuji Task 2.

---

### Task 1: Menu dan swipe Diambil/Bayar

**Files:**
- Modify: `src/components/servis-context-menu.tsx` (import ~5-15, `isPaidStage` ~173, blok desktop ~248-260, blok sheet ~373-382)
- Modify: `src/app/app/servis/page.tsx` (import ~5, `leadingActions` ~642-654)
- Modify: `src/app/app/servis/page-swipe-actions.test.ts`
- Create: `src/components/servis-menu.test.ts`

**Interfaces:**
- Consumes: `servis.payment` (`ServisPaymentStatus`), `servis.status` (`Stage`), `getPaymentStatus(s)` dari `page.tsx`, callback `onStatusChange`.
- Produces: kondisi `isPaid && !isPickedUp` untuk aksi Diambil; `!isPaid` untuk aksi Bayar.

- [ ] **Step 1: Write the failing tests**

Tambah test ke `src/app/app/servis/page-swipe-actions.test.ts`:

```ts
  it("swipe kanan mengganti Bayar dengan Diambil saat lunas", () => {
    expect(source).toContain('label: "Diambil"');
    expect(source).toContain('<TruckIcon className="size-5" />');
    expect(source).toContain('onSelect: () => handleStatusChange(s, "Sudah Diambil")');
    expect(source).toMatch(/if \(s\.status === "Sudah Diambil"\) return \[\];/);
  });
```

Buat `src/components/servis-menu.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const menu = readFileSync(
  join(process.cwd(), "src/components/servis-context-menu.tsx"),
  "utf8",
);

describe("menu aksi servis", () => {
  it("memilih Diambil hanya saat lunas dan belum diambil", () => {
    expect(menu).not.toContain("isPaidStage");
    expect(menu).toContain('const isPaid = servis.payment === "Lunas"');
    expect(menu).toContain('const isPickedUp = servis.status === "Sudah Diambil"');
    expect(menu).toContain("isPaid && !isPickedUp");
  });

  it("desktop dan sheet mengirim status Sudah Diambil lewat tanda tangan", () => {
    expect(menu.match(/Diambil/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(menu.match(/onStatusChange\?\.\(servis, "Sudah Diambil"\)/g) ?? []).toHaveLength(2);
    expect(menu).toContain("TruckIcon");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/app/servis/page-swipe-actions.test.ts src/components/servis-menu.test.ts`
Expected: FAIL pada `label: "Diambil"` dan `isPaidStage`.

- [ ] **Step 3: Implement menu and swipe conditions**

Di `src/components/servis-context-menu.tsx`:
- tambah `TruckIcon` ke import `lucide-react`;
- ganti `const isPaidStage = servis.status === "Selesai" || servis.status === "Sudah Diambil";` dengan:

```ts
  const isPaid = servis.payment === "Lunas";
  const isPickedUp = servis.status === "Sudah Diambil";
```

- ganti blok desktop `{isPaidStage && (...Bayar sekarang...)}` dengan:

```tsx
            {isPaid && !isPickedUp ? (
              <button
                role="menuitem"
                onClick={() => {
                  onStatusChange?.(servis, "Sudah Diambil");
                  closeAll();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <TruckIcon className="size-4 opacity-70" />
                Diambil
              </button>
            ) : !isPaid ? (
              <button
                role="menuitem"
                onClick={() => {
                  onBayar?.(servis);
                  closeAll();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <WalletIcon className="size-4 opacity-70" />
                Bayar sekarang
              </button>
            ) : null}
```

- ganti blok sheet `{isPaidStage && (...SheetAction Bayar...)}` dengan:

```tsx
            {isPaid && !isPickedUp ? (
              <SheetAction
                icon={<TruckIcon className="size-4 opacity-70" />}
                label="Diambil"
                onClick={() => {
                  onStatusChange?.(servis, "Sudah Diambil");
                  closeAll();
                }}
              />
            ) : !isPaid ? (
              <SheetAction
                icon={<WalletIcon className="size-4 opacity-70" />}
                label="Bayar sekarang"
                onClick={() => {
                  onBayar?.(servis);
                  closeAll();
                }}
              />
            ) : null}
```

Di `src/app/app/servis/page.tsx`:
- tambah `TruckIcon` ke import `lucide-react`;
- ganti `leadingActions` dengan:

```tsx
  const leadingActions = (s: ServisItem): SwipeAction[] => {
    if (getPaymentStatus(s) !== "Lunas") {
      return [
        {
          label: "Bayar",
          icon: <WalletIcon className="size-5" />,
          tone: "accent",
          keepRow: true,
          onSelect: () => handleBayar(s),
        },
      ];
    }
    if (s.status === "Sudah Diambil") return [];
    return [
      {
        label: "Diambil",
        icon: <TruckIcon className="size-5" />,
        tone: "accent",
        keepRow: true,
        onSelect: () => handleStatusChange(s, "Sudah Diambil"),
      },
    ];
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/app/servis/page-swipe-actions.test.ts src/components/servis-menu.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/servis-context-menu.tsx src/app/app/servis/page.tsx src/app/app/servis/page-swipe-actions.test.ts src/components/servis-menu.test.ts
git commit -m "feat(servis): menu Diambil setelah lunas di konteks dan swipe"
```

---

### Task 2: Skeleton dialog bayar mengikuti konten

**Files:**
- Modify: `src/components/servis/servis-payment-dialog.tsx` (komponen baru dekat `RincianServis`, pemakaian ~121)
- Test: `src/components/servis-menu.test.ts` (tambah describe baru)

**Interfaces:**
- Consumes: `Skeleton` dari `@/components/ui/skeleton` (sudah diimpor).
- Produces: `PaymentDialogSkeleton(): JSX.Element`, dipakai hanya di `!ready`.

- [ ] **Step 1: Write the failing test**

Tambah ke `src/components/servis-menu.test.ts`:

```ts
const dialog = readFileSync(
  join(process.cwd(), "src/components/servis/servis-payment-dialog.tsx"),
  "utf8",
);

describe("skeleton dialog bayar servis", () => {
  it("mengikuti layout dua kolom konten akhir", () => {
    expect(dialog).not.toContain('<Skeleton className="h-40 w-full" />');
    expect(dialog).toContain("function PaymentDialogSkeleton()");
    expect(dialog).toContain("md:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]");
    expect(dialog).toContain("<PaymentDialogSkeleton />");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/servis-menu.test.ts`
Expected: FAIL pada `h-40` / `PaymentDialogSkeleton`.

- [ ] **Step 3: Implement skeleton**

Tambah komponen setelah `RincianServis`:

```tsx
function PaymentDialogSkeleton() {
  return (
    <div className="grid gap-4 md:h-full md:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]">
      <div className="self-start space-y-3 rounded-lg border bg-muted/30 p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}
```

Ganti `{!ready ? (<Skeleton className="h-40 w-full" />) : ...}` menjadi `{!ready ? <PaymentDialogSkeleton /> : ...}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/servis-menu.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify full suite and build**

Run:
```
npx tsc --noEmit
npm test -- --run
npm run build
```
Expected: `tsc` exit 0, seluruh tes lulus, build sukses.

- [ ] **Step 6: Commit**

```bash
git add src/components/servis/servis-payment-dialog.tsx src/components/servis-menu.test.ts
git commit -m "fix(servis): skeleton dialog bayar menyerupai layout konten"
```
