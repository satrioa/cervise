# Dock Compact Pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dock mobile Teknisi/Frontliner berbentuk pill dengan label pada item aktif, dan tombol `+` di dock menggantikan trigger menu di header.

**Architecture:** `CompactDockNav` menerima `onOpenMenu` dan merender pill + tombol `+`; `CompactBottomBar` kehilangan tombol grid; `CompactShellInner` mengalihkan callback ke dock. Tidak ada perubahan data/rute.

**Tech Stack:** Next.js App Router, React/TypeScript, Tailwind, lucide-react `PlusIcon`, `Button` dengan `render`, Vitest source-text tests.

**Spec:** `docs/superpowers/specs/2026-11-27-compact-dock-pill-design.md`

## Global Constraints

- Tiga item tetap: Home, Servis, Sparepart (Teknisi) / Penjualan (Frontliner).
- Label hanya untuk item aktif.
- Tombol `+` memanggil `onOpenMenu`; tombol grid header dihapus.
- Warna memakai token aplikasi dan dark mode, bukan hitam/putih absolut.
- Tidak ada perubahan schema, server action, atau rute.

## Review Focus

- Item aktif `/app` harus menampilkan label Home dan latar berbeda — diuji Task 1.
- Item nonaktif tetap ikon saja dan tetap memakai `MainNavLink` — diuji Task 1.
- Tombol `+` harus punya `aria-label` dan memanggil `onOpenMenu` — diuji Task 1.
- Header mobile tidak boleh lagi punya tombol grid/onClick menu — diuji Task 1.
- Dock tersembunyi (`hidden`) harus tetap menyembunyikan tombol `+` — diuji Task 1.

---

### Task 1: Dock pill dan pemindahan trigger menu

**Files:**
- Modify: `src/components/layout/compact-dock-nav.tsx` (props ~18, blok render ~33-78, import ~5)
- Modify: `src/components/layout/compact-bottom-bar.tsx` (import ~4, komentar ~16-19, props ~21-33, tombol ~84-92)
- Modify: `src/components/layout/compact-shell.tsx` (pemanggilan ~325-333)
- Test: `src/components/layout/compact-dock-nav.test.ts`
- Test: `src/components/layout/compact-mobile-header.test.ts`
- Test: `src/components/layout/shell-chrome.test.ts`

**Interfaces:**
- Consumes: `items` (Home/Servis/role-aware), `isActive`, `MainNavLink`, `onOpenMenu` dari `CompactShellInner`.
- Produces: `CompactDockNav({ role, hidden, onOpenMenu })`.

- [ ] **Step 1: Write the failing tests**

Di `src/components/layout/compact-dock-nav.test.ts`, ganti assertion lama yang mengunci candy/kotak/no-label dengan:

```ts
  it("dock berbentuk pill dengan item aktif berlabel", () => {
    expect(source).toContain("rounded-full bg-muted/80");
    expect(source).toContain("ring-border/60 backdrop-blur");
    expect(source).toContain("{item.label}");
    expect(source).toContain("flex-1 justify-start gap-2 rounded-full bg-card px-4");
    expect(source).toContain("size-11 shrink-0 rounded-full text-muted-foreground");
  });

  it("tombol plus membuka menu", () => {
    expect(source).toContain("onOpenMenu: () => void");
    expect(source).toContain('aria-label="Buka menu"');
    expect(source).toContain("onClick={onOpenMenu}");
    expect(source).toContain("<PlusIcon");
    expect(source).toContain("bg-foreground text-background");
  });
```

Di `src/components/layout/compact-mobile-header.test.ts`, ganti dua baris lama:

```ts
    expect(bottomBar).not.toMatch(/<LayoutGrid fill="currentColor"/);
    expect(bottomBar).not.toMatch(/onClick=\{onOpenMenu\}/);
```

Di `src/components/layout/shell-chrome.test.ts`, ganti baris:

```ts
    expect(compactDockNav).toMatch(/onOpenMenu/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/layout/compact-dock-nav.test.ts src/components/layout/compact-mobile-header.test.ts src/components/layout/shell-chrome.test.ts`
Expected: FAIL pada pill/label/`onOpenMenu`.

- [ ] **Step 3: Implement dock and header changes**

Di `src/components/layout/compact-dock-nav.tsx`:
- import `PlusIcon` dari `lucide-react`;
- tanda tangan:

```tsx
export function CompactDockNav({
  role,
  hidden = false,
  onOpenMenu,
}: {
  role: string;
  hidden?: boolean;
  onOpenMenu: () => void;
}) {
```

- ganti seluruh blok `<div className="pointer-events-auto relative ...">` sampai `</div>` sebelum penutup wrapper dengan:

```tsx
      <div className="pointer-events-auto relative flex items-center gap-2 px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black/40 via-black/20 to-transparent"
        />
        <nav
          aria-label="Navigasi utama"
          className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-muted/80 p-1.5 ring-1 ring-border/60 backdrop-blur"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Button
                key={item.href}
                variant="ghost"
                size="icon-lg"
                aria-label={item.label}
                className={cn(
                  active
                    ? "flex-1 justify-start gap-2 rounded-full bg-card px-4 text-foreground shadow-sm dark:bg-neutral-800"
                    : "size-11 shrink-0 rounded-full text-muted-foreground",
                )}
                render={
                  <MainNavLink href={item.href} aria-current={active ? "page" : undefined}>
                    {null}
                  </MainNavLink>
                }
              >
                <Icon className="size-[18px] shrink-0" fill={active ? "currentColor" : "none"} />
                {active ? <span className="truncate text-sm font-medium">{item.label}</span> : null}
              </Button>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Buka menu"
          className="pointer-events-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-lg"
        >
          <PlusIcon className="size-5" />
        </button>
      </div>
```

Di `src/components/layout/compact-bottom-bar.tsx`:
- hapus `LayoutGrid` dari import `lucide-react`;
- ubah komentar "tombol grid berisi di kanan yang membuka drawer menu" menjadi "judul halaman di tengah";
- hapus `onOpenMenu` dari parameter dan tipe props;
- hapus blok `<button ... onClick={onOpenMenu}>...<LayoutGrid .../></button>` dalam bagian mobile.

Di `src/components/layout/compact-shell.tsx`:
- `<CompactDockNav role={actor.role} hidden={dockHidden} onOpenMenu={() => setMenuOpen(true)} />`;
- pada `<CompactBottomBar>` hapus baris `onOpenMenu={() => setMenuOpen(true)}`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/layout/compact-dock-nav.test.ts src/components/layout/compact-mobile-header.test.ts src/components/layout/shell-chrome.test.ts`
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
git add src/components/layout/compact-dock-nav.tsx src/components/layout/compact-bottom-bar.tsx src/components/layout/compact-shell.tsx src/components/layout/compact-dock-nav.test.ts src/components/layout/compact-mobile-header.test.ts src/components/layout/shell-chrome.test.ts
git commit -m "feat(shell): dock compact pill dengan trigger menu di tombol plus"
```

Catatan: jangan stage file WIP milik sesi lain.
