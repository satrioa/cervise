# Sci‑Fi World Dithered Images — Design Spec

**Date:** 2026-11-16  
**Status:** Approved (design)  
**Scope:** In-app UI images when Sci‑Fi style world is active

## Goal
Render in-app images with a dithered, sci‑fi look **only in Sci‑Fi world**, using SmoothUI’s `DitherImage` component with the **Threshold (2-level)** preset, and colors aligned to the Sci‑Fi world primary palette.

## Decisions (confirmed)
- **Activation:** Only when style world is `scifi` (`data-ui-world="scifi"` / `useStyleWorld().world === "scifi"`). Other worlds render images normally.
- **Coverage:** All **in-app** React-rendered images (`next/image` and JSX `<img>`) are dithered in scifi world.
- **Print outputs excluded:** Images embedded in **print/receipt/thermal HTML string outputs** remain normal/undithered for print clarity (e.g. `src/components/print-templates.tsx`, `src/lib/sales/receipt.ts`, `src/components/cash/shift-thermal-print.tsx`).
- **Exception (crisp):** **QR/barcode** image surfaces must remain crisp/scannable in scifi world (explicit opt-out).
- **Approach:** Approach 1 — add SmoothUI `dither-image`, create an `AppImage` wrapper, and refactor in-app image callsites to use it.

## Architecture

### 1. Component installation
- Add via: `npx smoothui-cli add dither-image` (project already has `@smoothui` registry in `components.json`).
- Use the generated component (expected import path similar to `@/components/smoothui/components/dither-image`; confirm/adjust to actual generated path).

### 2. `AppImage` wrapper
Create a reusable wrapper (e.g. `src/components/ui/app-image.tsx`) used for in-app images.

**Behavior:**
- **Non-scifi world OR `crisp`/dither-disabled:** render the image normally, preserving existing behavior/props as closely as possible (`next/image` where needed, or `<img>`).
- **Sci‑Fi world AND dithering enabled:** render `DitherImage` with:
  - `algorithm="threshold"`
  - `levels={2}` (Threshold 2-level preset)
  - 2-stop palette aligned to scifi primary: `["#061108", "#4fdc68"]` (scifi canvas/background and `--scifi-primary` from `globals.css`)
  - sensible `pixelSize` (tuned during implementation for readable dithered look)
  - passthrough of `src`, `alt`, sizing (`width`/`height`/layout classes) as supported.

**QR/barcode exception:**
- Wrapper exposes an explicit opt-out prop (e.g. `crisp` or `disableDither`).
- QR/barcode-related renders are marked crisp so they are never dithered, even in scifi.

**Notes:**
- `DitherImage` is client/canvas-based; wrapper will be implemented accordingly (client component where required).
- For `next/image`-specific features not directly supported by `DitherImage`, map or fallback safely while keeping scifi dithering for standard cases.

### 3. Refactor scope
- Replace in-app JSX usages of `<Image>` (next/image) and `<img>` with `AppImage` across `src` UI surfaces (public, dashboard, inventori, identity/avatar, banners, etc.), keeping semantics.
- Mark QR/barcode usages with crisp opt-out.
- **Do not change** print/receipt/thermal HTML string builders; they continue emitting plain `<img>` in generated HTML for printing.

## Data/Theme flow
- `StyleWorldProvider` (`src/lib/style-world-context.tsx`) sets `data-ui-world` and exposes world via `useStyleWorld()`.
- `AppImage` reads world and conditionally applies dither + scifi palette when `scifi`.

## Error handling & edge cases
- If dithering/canvas fails for a specific image (e.g. CORS-tainted remote source), prefer a safe fallback to normal rendering for that instance rather than breaking UI.
- External URLs: supported when drawable by `DitherImage`; validate during implementation.
- Future in-app images should use `AppImage` to inherit behavior.

## Verification
- Run relevant checks after implementation: `npm run typecheck`, `npm run lint`, and affected tests.
- Manual/sanity: scifi world shows dithered in-app images (Threshold 2-level, scifi palette); other worlds normal; QR/barcodes crisp; print outputs undithered.

## Out of scope
- Dithering images inside generated print/receipt/thermal HTML.
- Global CSS-only dithering approximation (must use SmoothUI `DitherImage`).
- Redesign of non-image UI beyond what’s needed to apply the effect.
