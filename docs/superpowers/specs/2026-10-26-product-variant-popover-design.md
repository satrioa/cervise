# Spec: Product Variant Popover — penjualan-product-grid

## Scope
`src/components/penjualan/penjualan-product-grid.tsx` — POS product card.

## Design B (approved)
- Group by `parent_key` (DB). 1 card per parent.
- Card shows parent key (`iPhone 14 Pro`), parent image (placeholder `PackageIcon` if none), price from cheapest variant, stock sum, chip `Warna` + `Storage`.
- Click opens popover overlay with parent title/image + selectable variant chips (`Warna`, `Storage`) + "Tambah ke keranjang" active only after selection.
- Existing components (`Dialog`/`Popover` from project) reused.

## Data flow
- Input `ProductRow[]` (has `parent_key`, `name`, `sku`, `price`, `stock_qty`, `storage`, `warna`, `variant_type`).
- Group: `Map<parent_key, ProductRow[]>`.
- Popover props: `parentRow` + `variants[]`. `onAdd(variantRow)`.

## Implementation plan
1. Read `penjualan-product-grid.tsx` + `pos-types.ts` + `penjualan-cart-dialog.tsx` for data shape.
2. Modify `penjualan-product-grid.tsx`: group by `parent_key`, card markup, popover wrapper (`shadcn/ui` or base dialog), chip selects, active-state button.
3. Keep `PackageIcon` as parent image placeholder; add parent image if field available.
4. Test: card renders grouped; popover opens; add-to-cart only after chip selection.

## Risk / shortcut
`parent_key` must exist in DB; if missing for some products, fall back to `name` grouping. `shortcut: fallback to name grouping if parent_key is empty.`
