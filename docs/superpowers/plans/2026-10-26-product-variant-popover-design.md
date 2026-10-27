# Product Variant Popover (penjualan-product-grid) Implementation Plan

**For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development` (recommended) or `executing-plans`. Steps use checkbox syntax.

**Goal:** Group POS product cards by DB `parent_key`; show parent key on card; click opens overlay popover with parent image/title + chip-select for `warna` and `storage`; "Add to cart" active only after selection.

**Architecture:** Modify `penjualan-product-grid.tsx` to group by `parent_key`, render one card per group, and use an existing overlay component (`Dialog`/`Popover`) for variant selection. No new DB columns.

**Tech Stack:** React + `lucide-react` + existing `Dialog`/`Popover` primitives in `src/components/ui/`.

**Spec:** `docs/superpowers/specs/2026-10-26-product-variant-popover-design.md`

---

## Global Constraints
- Component: `src/components/penjualan/penjualan-product-grid.tsx`
- Data: `ProductRow[]` from `pos-types.ts`; `parent_key` is grouping key (DB field). Fallback to `name` grouping if `parent_key` empty. `shortcut: fallback to name grouping if parent_key is empty.`
- Popover: reuse existing `Dialog` or `Popover` (do not invent new overlay primitive).
- Add-to-cart (`onAdd`) called only when a variant is selected; card itself does not call `onAdd` directly.
- No dependency additions.

## Review Focus
- Grouping: product without `parent_key` must not split into isolated cards; must fall back.
- Overlay: must not block the whole page; must be dismissable.
- Selection: button disabled when no `warna`/`storage` chip selected; must call `onAdd(variantRow)` with selected variant.
- Hydration: no `Date.now()` or client-only initial state in the overlay.

---

## File Map
- Modify: `src/components/penjualan/penjualan-product-grid.tsx`
- Modify (types): `src/app/app/penjualan/actions.ts` (if `parent_key` missing from `ProductRow`)
- Modify: `src/app/app/pos-types.ts` (if `parent_key` missing)
- Read reference: `src/components/inventori/product-variant-dialog.tsx`
- Read reference: `src/components/penjualan/penjualan-cart-dialog.tsx`
- Spec: `docs/superpowers/specs/2026-10-26-product-variant-popover-design.md`

---

### Task 1: Confirm `parent_key` in types
- [ ] Read `pos-types.ts` and `penjualan/actions.ts` to verify `parent_key` exists on `ProductRow`. If not, add it (`string | null`).
- [ ] Read `penjualan-product-grid.tsx` fully (lines 1-3742) to note current `onAdd` call site and `ProductRow` usage.
- Commit.

### Task 2: Build grouping logic
- [ ] In `penjualan-product-grid.tsx`, replace the `.map` loop with grouping: `groupByParentKey(products)`. Function returns `Group[]` with `{ parent: ProductRow, variants: ProductRow[], key: string }`. Fallback: if `parent_key` null/empty, group by `name`.
- [ ] Write test: `groupByParentKey` produces 1 group for same `parent_key`, separate groups for different keys.
- [ ] Run test; pass.
- Commit.

### Task 3: Card markup (grouped)
- [ ] Replace card content: title = parent `name` (truncate); subtitle = `SKU` (parent SKU); price = cheapest variant price or `formatCurrencyPlain(min(price))`; stock = sum of `stock_qty`.
- [ ] Keep `PackageIcon` as image placeholder (existing). If `parent_key` has an image field, show it; else keep icon.
- [ ] Card `onClick` opens overlay (not `onAdd`). Card `disabled` when total stock = 0.
- [ ] Commit.

### Task 4: Overlay popover with chip selects
- [ ] Import existing `Dialog` or `Popover`. Use `Dialog` if full-screen-like; `Popover` if small. Based on spec and image (chip row + button), use `Dialog` with `DialogContent` sized to `max-w-sm`.
- [ ] Overlay props from parent: `open`, `onOpenChange`, `parent`, `variants`, `selectedVariant`, set function.
- [ ] Inside overlay: parent title (`parent.name`), image (`PackageIcon` or parent image if available).
- [ ] Two chip rows: `Warna` (`variants.map(v => v.warna)`) and `Storage` (`variants.map(v => v.storage)`). Chip selected = active. Multiple selection disabled (single per row, or multi if data requires; default single per row for simplicity).
- [ ] "Tambah ke keranjang" button: `disabled={!selectedWarna || !selectedStorage}`. `onClick` finds matching `ProductRow` (filter variants by selected values) and calls `onAdd(variantRow)`.
- [ ] `shortcut: if no storage/warna fields on variant, disable those chip rows.`
- [ ] Commit.

### Task 5: Wire group render + overlay
- [ ] Replace `.map` over products with `.map` over groups. Each group renders 1 card (`group.parent`) + overlay state per group (use `useState` per group or lift state to parent; simplest: `selectedVariantId` state in parent, overlay receives it).
- [ ] Ensure `key={group.key}` uses group identifier (parent_key or name).
- [ ] Verify `disabled` logic: card disabled when all variants `stock_qty === 0`.
- [ ] Run full component render (no build errors).
- Commit.

### Task 6: Final checks
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes on modified file.
- [ ] Build succeeds (`npm run build`).
- [ ] Spec file `docs/superpowers/specs/2026-10-26-product-variant-popover-design.md` exists.
- Commit.
