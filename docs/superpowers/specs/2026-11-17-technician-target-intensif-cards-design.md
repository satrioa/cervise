# Technician Target & Intensif Cards — Design

## Problem
The technician Home has one `Target saya` card (`BentoCard span={2}`, `TargetTile` in
`src/components/dashboard/technician-dashboard.tsx`). When the branch uses a non-flat
insentif mode (`percent` / `fixed`), there is no monthly target, so the card only shows an
explanatory sentence and looks empty. Master admins also have no way to hide the card, and
there is no technician-facing view of the insentif they are earning.

## Decisions (confirmed with user)
- Two independent cards on technician Home: **Target Cabang** and **Intensif Saya**.
- **Intensif Saya** shows the **estimated Rupiah amount earned this month**.
- Two independent visibility toggles in master admin branch management; default **on**.
- Cards hide automatically when:
  - branch insentif is disabled → both hidden;
  - mode is `flat` → Intensif Saya hidden (Target Cabang may still show).
- When both cards are visible, they sit side by side as `span={1}` bento cards. When only
  one is visible it keeps `span={2}`.
- "Target Cabang" is **independent** from the flat-mode bonus gate
  (`branches.intensif_target_count`). It is a display/KPI target with a configurable type:
  **Penghasilan** (revenue) or **Jumlah Servis** (service count).
- Approach: add columns to `public.branches` (follows existing insentif fields and RLS).

## Data model
New migration adding to `public.branches`:

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| `target_type` | text | `jumlah_servis` | check constraint: `penghasilan` / `jumlah_servis` |
| `target_value` | integer | null | Rupiah for `penghasilan`, count for `jumlah_servis`; positive when set |
| `show_target_to_teknisi` | boolean | true | controls Target Cabang visibility |
| `show_intensif_to_teknisi` | boolean | true | controls Intensif Saya visibility |

No change to `is_intensif_enabled`, `intensif_mode`, `intensif_value`,
`intensif_target_count` semantics.

## Server / pure logic
- `src/app/app/cabang/actions.ts`: extend branch select/type with the four columns; add
  `updateCabangTarget(id, { type, value })` and
  `updateCabangCardVisibility(id, { showTarget, showIntensif })`. Existing RLS
  (`branches_update`, master admin only) remains the authorization boundary.
- `src/lib/home/home-data.ts`: select the four new columns for technician home and forward
  them in `TechnicianHomeData` (e.g. `cardVisibility`, `branchTarget`).
- Pure helpers (no Supabase/React), extending `src/lib/operational/technician-dashboard.ts`
  or a small dedicated module:
  - target progress: `jumlah_servis` → count of completed services this month; `penghasilan`
    → sum of `price` of completed services this month; percent capped at 100.
  - intensif estimate: reuse the formula in `src/lib/operational/performa-teknisi.ts`
    (`percent`: revenue × value / 100; `fixed`: completed count × value). Extract a small
    shared helper rather than duplicating the formula.
  - visibility rule: disabled insentif → both hidden; flat → intensif hidden; per-card toggle
    → hides its card.

## UI — master admin
- `src/components/cabang/cabang-drawer.tsx`:
  - existing **Insentif Teknisi** card gets a "Tampilkan kartu Intensif ke teknisi" switch;
  - new **Target Cabang** card directly below it: visibility switch, target type select
    (Penghasilan / Jumlah Servis), numeric target input, save button.
- `src/app/app/cabang/cabang-client.tsx` and `src/components/cabang/branch-cards.tsx`:
  extend `BranchItem` type with the four columns so values survive `router.refresh()`;
  optional badge showing target type is fine but not required.

## UI — technician Home
- Split `TargetTile` into:
  - `TargetCabangTile` — title "Target Cabang", shows `selesai/target` or
    `Rp…/Rp…` with progress bar;
  - `IntensifTile` — title "Intensif Saya", shows estimated Rupiah this month + short
    mode label (e.g. "5% dari pendapatan" / "Rp10.000 per servis").
- In `src/components/dashboard/technician-dashboard.tsx`, replace the single `span={2}`
  Target bento card with up to two `span={1}` cards side by side (one card keeps `span={2}`
  when the other is hidden).
- Remove the old empty-state sentence "Cabang ini memakai insentif per servis…".

## Testing
- Pure helper tests: target count vs revenue, intensif percent vs fixed, grouping months,
  zero/no-target cases.
- Visibility tests: insentif off hides both; flat hides Intensif; toggles hide each card.
- Static/wiring tests for cabang actions + drawer and technician dashboard card composition.
- Run `tsc --noEmit` and the relevant vitest files.

## Out of scope
- Changing flat bonus payment logic / the `post_stock_opname` RPC or `performa-teknisi`
  result semantics.
- Adding a third target type or per-technician individual targets.
- Mobile card layout changes beyond the bento card count (existing mobile grid still works).

## Risks
- Migration must be applied to Supabase before the UI can save the new fields.
- Concurrent edits in the working tree (other sessions) may touch cabang/home files; keep the
  change scoped and re-run typecheck at the end.
