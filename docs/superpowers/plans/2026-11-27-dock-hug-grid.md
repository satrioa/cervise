# Dock Hug-to-Content dan Ikon Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Item aktif dock compact mengikuti lebar isinya, dan tombol menu memakai ikon `LayoutGrid` empat kotak.

**Architecture:** Perubahan hanya dua kelas/komponen di `CompactDockNav` dan penyesuaian assertion di test sumber yang bersangkutan.

**Tech Stack:** React/TypeScript, Tailwind, lucide-react `LayoutGrid`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-dock-hug-grid-design.md`

## Global Constraints

- Item aktif tidak memakai `flex-1`; `px-4` tetap.
- `nav` pill tetap `flex-1`.
- Tombol menu tetap `aria-label="Buka menu"` dan `onClick={onOpenMenu}`.
- Ikon `LayoutGrid` dengan `className="size-5"`.

## Review Focus

- Item aktif tidak boleh lagi mengisi sisa pill — diuji Task 1.
- Tombol menu tidak boleh lagi memakai `PlusIcon` — diuji Task 1.
- Callback `onOpenMenu` dan aksesibilitas tombol tetap — diuji Task 1.

---

### Task 1: Dua baris perubahan pada dock

**Files:**
- Modify: `src/components/layout/compact-dock-nav.tsx` (import ~5, kelas aktif ~62, tombol ~80)
- Test: `src/components/layout/compact-dock-nav.test.ts`

**Interfaces:**
- Consumes: `LayoutGrid` dari `lucide-react`, `onOpenMenu`.
- Produces: kelas item aktif tanpa `flex-1`, tombol dengan `LayoutGrid`.

- [ ] **Step 1: Write the failing test**

Di `src/components/layout/compact-dock-nav.test.ts`, ubah assertion:

```ts
  it("dock berbentuk pill dengan item aktif berlabel", () => {
    expect(source).toContain("rounded-full bg-muted/80");
    expect(source).toContain("ring-border/60 backdrop-blur");
    expect(source).toContain("{item.label}");
    expect(source).toContain("justify-start gap-2 rounded-full bg-card px-4");
    expect(source).not.toContain("flex-1 justify-start");
    expect(source).toContain("size-11 shrink-0 rounded-full text-muted-foreground");
  });

  it("tombol grid membuka menu", () => {
    expect(source).toContain("onOpenMenu: () => void");
    expect(source).toContain('aria-label="Buka menu"');
    expect(source).toContain("onClick={onOpenMenu}");
    expect(source).toContain("<LayoutGrid");
    expect(source).not.toContain("PlusIcon");
    expect(source).toContain("bg-foreground text-background");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/compact-dock-nav.test.ts`
Expected: FAIL pada `not.toContain("flex-1 justify-start")` dan `<LayoutGrid`.

- [ ] **Step 3: Implement changes**

Di `src/components/layout/compact-dock-nav.tsx`:
- ganti `PlusIcon` dengan `LayoutGrid` pada impor `lucide-react`;
- kelas item aktif dari
  `flex-1 justify-start gap-2 rounded-full bg-card px-4 text-foreground shadow-sm dark:bg-neutral-800`
  menjadi
  `justify-start gap-2 rounded-full bg-card px-4 text-foreground shadow-sm dark:bg-neutral-800`;
- ganti `<PlusIcon className="size-5" />` dengan `<LayoutGrid className="size-5" />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/compact-dock-nav.test.ts`
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
git add src/components/layout/compact-dock-nav.tsx src/components/layout/compact-dock-nav.test.ts
git commit -m "fix(shell): dock aktif hug to content dan ikon grid"
```

Catatan: jangan stage file WIP milik sesi lain.
