# Technician Target & Intensif Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the empty technician "Target saya" card with two configurable cards — Target Cabang and Intensif Saya — each independently shown/hidden by master admins in branch management.

**Architecture:** Four new nullable/defaulted columns on `public.branches` hold the monthly target config and two visibility switches. Pure helpers compute visibility, target progress and intensif estimate; master-admin branch drawer writes the columns via existing RLS-protected server actions; technician Home reads them with the rest of `getHomeData()` and renders up to two bento cards side by side.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Postgres + RLS, Vitest, shadcn/coss primitives already installed.

**Spec:** `docs/superpowers/specs/2026-11-17-technician-target-intensif-cards-design.md`

## Global Constraints

- Migration must use `add column if not exists` and defaults: `target_type = 'jumlah_servis'`, `show_target_to_teknisi = true`, `show_intensif_to_teknisi = true`.
- `target_type` allowed values: `penghasilan`, `jumlah_servis`.
- Existing flat bonus logic (`intensif_target_count`, `updateCabangIntensif`, `performa-teknisi` flat row) must not change behavior.
- Insentif off → both cards hidden. Mode `flat` → Intensif Saya hidden.
- When both cards are visible they are `BentoCard span={1}`; when only one is visible it is `span={2}`.
- All new pure logic lives in `src/lib/operational/technician-cards.ts` (no Supabase/React imports).
- Project uses npm (`package-lock.json`); run tests with `npx vitest run`.

## Review Focus

- **Insentif disabled but toggles on** → both cards must be hidden: pin in Task 1 `technicianCardFlags` test.
- **Mode `flat` with Intensif toggle on** → Intensif card must be hidden: pin in Task 1 `technicianCardFlags` test.
- **Target type `penghasilan`** → progress uses summed `price`, not service count: pin in Task 1 `targetProgress` test.
- **Target value missing/zero** → percent is 0, no division by zero: pin in Task 1 `targetProgress` test.
- **Admin toggles off** → respective card hidden even when mode is percent/fixed: pin in Task 1 `technicianCardFlags` test.

---

### Task 1: Migration and pure card logic

**Files:**
- Create: `supabase/migrations/20261117150000_technician_card_visibility.sql`
- Create: `src/lib/operational/technician-cards.ts`
- Create: `src/lib/operational/technician-cards.test.ts`
- Modify: `src/lib/operational/performa-teknisi.ts` (use shared estimate helper for percent/fixed)

**Interfaces:**
- Produces: `technicianCardFlags`, `targetProgress`, `insentifEstimate` used by Tasks 2 & 3.
- Produces: `CardFlags`, `CardTargetType` types.

- [ ] **Step 1: Write the migration**

```sql
alter table public.branches
  add column if not exists target_type text not null default 'jumlah_servis',
  add column if not exists target_value integer,
  add column if not exists show_target_to_teknisi boolean not null default true,
  add column if not exists show_intensif_to_teknisi boolean not null default true;

alter table public.branches
  drop constraint if exists branches_target_type_check;
alter table public.branches
  add constraint branches_target_type_check
  check (target_type in ('penghasilan', 'jumlah_servis'));
```

- [ ] **Step 2: Write failing tests for the pure helpers**

```ts
import { describe, expect, it } from "vitest";
import {
  insentifEstimate,
  targetProgress,
  technicianCardFlags,
} from "./technician-cards";

describe("technicianCardFlags", () => {
  const base = {
    insentifEnabled: true,
    intensifMode: "percent",
    showTarget: true,
    showIntensif: true,
  };

  it("hides both cards when branch insentif is off", () => {
    expect(technicianCardFlags({ ...base, insentifEnabled: false })).toEqual({
      showTarget: false,
      showIntensif: false,
    });
  });

  it("hides Intensif Saya in flat mode", () => {
    expect(technicianCardFlags({ ...base, intensifMode: "flat" })).toEqual({
      showTarget: true,
      showIntensif: false,
    });
  });

  it("honors each admin toggle independently", () => {
    expect(technicianCardFlags({ ...base, showTarget: false })).toEqual({
      showTarget: false,
      showIntensif: true,
    });
    expect(technicianCardFlags({ ...base, showIntensif: false })).toEqual({
      showTarget: true,
      showIntensif: false,
    });
  });
});

describe("targetProgress", () => {
  it("counts completed services for jumlah_servis", () => {
    expect(targetProgress({ type: "jumlah_servis", value: 10, selesai: 4, penghasilan: 999 })).toEqual({
      current: 4, target: 10, percent: 40,
    });
  });

  it("uses revenue for penghasilan", () => {
    expect(targetProgress({ type: "penghasilan", value: 1_000_000, selesai: 3, penghasilan: 250_000 })).toEqual({
      current: 250_000, target: 1_000_000, percent: 25,
    });
  });

  it("returns 0% without a target", () => {
    expect(targetProgress({ type: "penghasilan", value: null, selesai: 3, penghasilan: 250_000 }).percent).toBe(0);
    expect(targetProgress({ type: "jumlah_servis", value: 0, selesai: 3, penghasilan: 0 }).percent).toBe(0);
  });
});

describe("insentifEstimate", () => {
  it("computes percent of revenue and fixed per service", () => {
    expect(insentifEstimate({ mode: "percent", value: 5, selesai: 2, penghasilan: 1_000_000 })).toBe(50_000);
    expect(insentifEstimate({ mode: "fixed", value: 25_000, selesai: 3, penghasilan: 0 })).toBe(75_000);
    expect(insentifEstimate({ mode: "flat", value: 300_000, selesai: 10, penghasilan: 0 })).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to confirm failure**

Run: `npx vitest run src/lib/operational/technician-cards.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the pure helpers**

```ts
export type CardTargetType = "penghasilan" | "jumlah_servis";
export type CardFlags = { showTarget: boolean; showIntensif: boolean };

export function technicianCardFlags(input: {
  insentifEnabled: boolean;
  intensifMode: string;
  showTarget: boolean;
  showIntensif: boolean;
}): CardFlags {
  if (!input.insentifEnabled) return { showTarget: false, showIntensif: false };
  return {
    showTarget: input.showTarget,
    showIntensif: input.showIntensif && input.intensifMode !== "flat",
  };
}

export function targetProgress(input: {
  type: CardTargetType;
  value: number | null;
  selesai: number;
  penghasilan: number;
}): { current: number; target: number; percent: number } {
  const target = Math.max(0, Math.trunc(input.value ?? 0));
  const current =
    input.type === "penghasilan"
      ? Math.max(0, Math.round(input.penghasilan))
      : Math.max(0, Math.trunc(input.selesai));
  return {
    current,
    target,
    percent: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
  };
}

export function insentifEstimate(input: {
  mode: string;
  value: number;
  selesai: number;
  penghasilan: number;
}): number {
  if (input.mode === "fixed") return Math.max(0, input.selesai * input.value);
  if (input.mode === "percent") return Math.round((Math.max(0, input.penghasilan) * input.value) / 100);
  return 0;
}
```

- [ ] **Step 5: Reuse the estimate helper in `performa-teknisi.ts`**

Replace only the percent/fixed branches:

```ts
import { insentifEstimate } from "./technician-cards";

let insentif = 0;
if (enabled) {
  if (mode === "flat") insentif = hasTarget && counts.selesai >= (target as number) ? value : 0;
  else insentif = insentifEstimate({ mode, value, selesai: counts.selesai, penghasilan: counts.revenue });
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run src/lib/operational/technician-cards.test.ts src/lib/operational/performa-teknisi.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: PASS for touched files (other sessions may have unrelated errors).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261117150000_technician_card_visibility.sql src/lib/operational/technician-cards.ts src/lib/operational/technician-cards.test.ts src/lib/operational/performa-teknisi.ts
git commit -m "feat: add technician card visibility and estimate helpers"
```

---

### Task 2: Master admin branch management (target config + visibility toggles)

**Files:**
- Modify: `src/app/app/cabang/actions.ts` (select/map + 2 new actions)
- Modify: `src/components/cabang/cabang-drawer.tsx` (insentif toggle + new Target Cabang card)
- Modify: `src/app/app/cabang/cabang-client.tsx` (BranchItem type fields)
- Modify: `src/components/cabang/branch-cards.tsx` (BranchItem type fields)
- Test: `src/components/cabang/technician-card-settings.test.ts` (new)

**Interfaces:**
- Consumes: nothing from Task 1 at runtime (column names must match migration exactly).
- Produces: actions `updateCabangTarget(id, { type, value })` and
  `updateCabangCardVisibility(id, { showTarget, showIntensif })`.

- [ ] **Step 1: Write failing source-wiring test**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(join(process.cwd(), "src/app/app/cabang/actions.ts"), "utf8");
const drawer = readFileSync(join(process.cwd(), "src/components/cabang/cabang-drawer.tsx"), "utf8");

describe("cabang technician card settings", () => {
  it("reads and writes the four new branch columns", () => {
    for (const column of [
      "target_type",
      "target_value",
      "show_target_to_teknisi",
      "show_intensif_to_teknisi",
    ]) {
      expect(actions).toContain(column);
    }
    expect(actions).toContain("export async function updateCabangTarget");
    expect(actions).toContain("export async function updateCabangCardVisibility");
  });

  it("exposes both visibility toggles and the target card in the drawer", () => {
    expect(drawer).toContain("show_intensif_to_teknisi");
    expect(drawer).toContain("show_target_to_teknisi");
    expect(drawer).toContain("Target Cabang");
    expect(drawer).toContain("Penghasilan");
    expect(drawer).toContain("Jumlah Servis");
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `npx vitest run src/components/cabang/technician-card-settings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Extend `getCabangList` and add the two actions**

In `getCabangList`, append to the `.select(...)` string:
`,target_type,target_value,show_target_to_teknisi,show_intensif_to_teknisi`

In the returned object add:

```ts
target_type: b.target_type === "penghasilan" ? "penghasilan" : "jumlah_servis",
target_value: b.target_value ?? null,
show_target_to_teknisi: b.show_target_to_teknisi ?? true,
show_intensif_to_teknisi: b.show_intensif_to_teknisi ?? true,
```

Append:

```ts
export async function updateCabangTarget(
  id: string,
  data: { type: "penghasilan" | "jumlah_servis"; value: number | null },
) {
  const { supabase, orgId, role, permissions } = await getActiveTenant();
  requireCabangAccess({ role, permissions });
  if (data.type !== "penghasilan" && data.type !== "jumlah_servis") throw new Error("Tipe target invalid");
  if (data.value !== null && (!Number.isFinite(data.value) || data.value <= 0)) {
    throw new Error("Nilai target harus > 0");
  }
  const { error } = await supabase
    .from("branches")
    .update({ target_type: data.type, target_value: data.value })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}

export async function updateCabangCardVisibility(
  id: string,
  data: { showTarget: boolean; showIntensif: boolean },
) {
  const { supabase, orgId, role, permissions } = await getActiveTenant();
  requireCabangAccess({ role, permissions });
  const { error } = await supabase
    .from("branches")
    .update({
      show_target_to_teknisi: data.showTarget,
      show_intensif_to_teknisi: data.showIntensif,
    })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/cabang");
  return { ok: true };
}
```

- [ ] **Step 4: Extend client-side BranchItem types**

In both `src/app/app/cabang/cabang-client.tsx` and `src/components/cabang/branch-cards.tsx`, add to the branch item type:

```ts
target_type?: "penghasilan" | "jumlah_servis";
target_value?: number | null;
show_target_to_teknisi?: boolean;
show_intensif_to_teknisi?: boolean;
```

- [ ] **Step 5: Update the drawer**

In `src/components/cabang/cabang-drawer.tsx`:
- import `updateCabangTarget` and `updateCabangCardVisibility` next to `updateCabangIntensif`;
- add state initialized from props:
  `targetType`, `targetValue`, `showTarget`, `showIntensif` (same init pattern as `intensifEnabled` at lines ~106-109);
- in the existing **Insentif Teknisi** card header, add a `Switch` labeled “Tampilkan kartu Intensif ke teknisi” bound to `showIntensif`, saving via `updateCabangCardVisibility(id, { showTarget, showIntensif: next })`;
- add a new card directly after the insentif card:

```tsx
<div className="rounded-xl border bg-card p-4 shadow-xs/5">
  <div className="flex items-center justify-between gap-3">
    <div>
      <div className="font-heading text-sm font-semibold">Target Cabang</div>
      <p className="text-xs text-muted-foreground">Target bulanan teknisi — tampilan di Home, terpisah dari syarat bonus.</p>
    </div>
    <Switch checked={showTarget} disabled={savingTarget || !branch.is_active} onCheckedChange={(v) => void saveVisibility({ showTarget: v, showIntensif })} />
  </div>
  {branch.is_active ? (
    <div className="mt-4 space-y-3">
      <Select value={targetType} onValueChange={(v) => setTargetType(v as "penghasilan" | "jumlah_servis")}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="jumlah_servis">Jumlah Servis</SelectItem>
          <SelectItem value="penghasilan">Penghasilan</SelectItem>
        </SelectContent>
      </Select>
      <Input type="number" min={1} value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder={targetType === "penghasilan" ? "mis. 10000000" : "mis. 20"} />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => void saveTarget()} disabled={savingTarget}>Simpan target</Button>
      </div>
    </div>
  ) : null}
</div>
```

- Add state and init in the same `useEffect` that initializes the intensif state:

```tsx
const [targetType, setTargetType] = useState<"penghasilan" | "jumlah_servis">("jumlah_servis");
const [targetValue, setTargetValue] = useState<string>("");
const [showTarget, setShowTarget] = useState(true);
const [showIntensif, setShowIntensif] = useState(true);
const [savingTarget, setSavingTarget] = useState(false);

// inside the existing init effect:
setTargetType(branch.target_type === "penghasilan" ? "penghasilan" : "jumlah_servis");
setTargetValue(branch.target_value ? String(branch.target_value) : "");
setShowTarget(branch.show_target_to_teknisi ?? true);
setShowIntensif(branch.show_intensif_to_teknisi ?? true);
```

- Add these handlers next to `handleSaveIntensif`:

```tsx
const saveVisibility = async (next: { showTarget: boolean; showIntensif: boolean }) => {
  if (!branch) return;
  setSavingTarget(true);
  try {
    await updateCabangCardVisibility(branch.id, next);
    setShowTarget(next.showTarget);
    setShowIntensif(next.showIntensif);
    playPageTransition();
    router.refresh();
  } catch (e: any) {
    toast.error(e?.message ?? "Gagal mengubah tampilan kartu");
  } finally {
    setSavingTarget(false);
  }
};

const saveTarget = async () => {
  if (!branch) return;
  const raw = targetValue.trim();
  const value = raw === "" ? null : Number(raw);
  if (value !== null && (!Number.isFinite(value) || value <= 0)) {
    toast.error("Nilai target harus lebih dari 0");
    return;
  }
  setSavingTarget(true);
  try {
    await updateCabangTarget(branch.id, { type: targetType, value });
    playPageTransition();
    toast.success("Target cabang diperbarui");
    router.refresh();
  } catch (e: any) {
    toast.error(e?.message ?? "Gagal menyimpan target");
  } finally {
    setSavingTarget(false);
  }
};
```

- Wire the Insentif card switch to `onCheckedChange={(v) => void saveVisibility({ showTarget, showIntensif: v })}`.

- [ ] **Step 6: Run test and typecheck**

Run: `npx vitest run src/components/cabang/technician-card-settings.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: PASS for touched files.

- [ ] **Step 7: Commit**

```bash
git add src/app/app/cabang/actions.ts src/components/cabang/cabang-drawer.tsx src/app/app/cabang/cabang-client.tsx src/components/cabang/branch-cards.tsx src/components/cabang/technician-card-settings.test.ts
git commit -m "feat: configure technician target and card visibility per branch"
```

---

### Task 3: Technician Home data wiring and the two cards

**Files:**
- Modify: `src/lib/operational/technician-dashboard.ts` (add `penghasilanBulanIni` to KPI)
- Modify: `src/lib/home/types.ts` (add `cards` to `TechnicianHomeData`)
- Modify: `src/lib/home/home-data.ts` (select columns, build `cards`)
- Modify: `src/components/dashboard/technician-dashboard.tsx` (split TargetTile into two cards)
- Test: `src/components/dashboard/technician-cards-ui.test.ts` (new)
- Test: `src/lib/operational/technician-dashboard.test.ts` (existing)

**Interfaces:**
- Consumes: `technicianCardFlags`, `targetProgress`, `insentifEstimate` from Task 1; branch columns from Task 2.
- Produces: `TechnicianHomeData.cards` used by the UI.

- [ ] **Step 1: Write failing UI/source tests**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dash = readFileSync(join(process.cwd(), "src/components/dashboard/technician-dashboard.tsx"), "utf8");
const home = readFileSync(join(process.cwd(), "src/lib/home/home-data.ts"), "utf8");
const types = readFileSync(join(process.cwd(), "src/lib/home/types.ts"), "utf8");

describe("technician home cards", () => {
  it("renders two independent cards", () => {
    expect(dash).toContain("function TargetCabangTile");
    expect(dash).toContain("function IntensifTile");
    expect(dash).toContain("technicianCardFlags");
    expect(dash).not.toContain("Cabang ini memakai insentif per servis");
  });

  it("uses span 1 for two cards and span 2 for one", () => {
    expect(dash).toMatch(/showTarget && showIntensif[\s\S]*span=\{1\}/);
    expect(dash).toMatch(/span=\{2\}/);
  });

  it("loads the new branch columns into cards payload", () => {
    for (const c of ["target_type", "target_value", "show_target_to_teknisi", "show_intensif_to_teknisi"]) {
      expect(home).toContain(c);
    }
    expect(types).toContain("cards:");
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `npx vitest run src/components/dashboard/technician-cards-ui.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add revenue to the technician KPI**

In `src/lib/operational/technician-dashboard.ts`:
- add `penghasilanBulanIni: number` to `TechnicianKpi`;
- compute next to `selesai`:

```ts
const penghasilanBulanIni = teknisiId
  ? services
      .filter((s) => s.teknisi_id === teknisiId && DONE_STATUS.has(s.status) && dalamRentangBulan(s.completed_at, now))
      .reduce((sum, s) => sum + Number(s.price ?? 0), 0)
  : 0;
```

- include `penghasilanBulanIni` in the returned object.

- [ ] **Step 4: Add `cards` to `TechnicianHomeData`**

In `src/lib/home/types.ts`:

```ts
cards: {
  showTarget: boolean;
  showIntensif: boolean;
  targetType: "penghasilan" | "jumlah_servis";
  targetValue: number | null;
  intensifMode: "percent" | "fixed" | "flat";
  intensifValue: number;
};
```

- [ ] **Step 5: Build the `cards` payload in `home-data.ts`**

- extend the branches select in the technician query with the four new columns;
- read them into a local `TechnicianBranch` shaped value (fallbacks: `true`, `null`,
  `jumlah_servis`, `percent`, `0`);
- import `technicianCardFlags` from `@/lib/operational/technician-cards`;
- add to the returned object:

```ts
cards: {
  ...technicianCardFlags({
    insentifEnabled: branch?.is_intensif_enabled === true,
    intensifMode: mode,
    showTarget: branch?.show_target_to_teknisi ?? true,
    showIntensif: branch?.show_intensif_to_teknisi ?? true,
  }),
  targetType: branch?.target_type === "penghasilan" ? "penghasilan" : "jumlah_servis",
  targetValue: branch?.target_value ?? null,
  intensifMode: mode,
  intensifValue: Number(branch?.intensif_value ?? 0),
},
```

where `mode = branch?.intensif_mode === "fixed" || branch?.intensif_mode === "flat" ? branch.intensif_mode : "percent"`.

- [ ] **Step 6: Render the two cards in `technician-dashboard.tsx`**

- import `targetProgress`, `insentifEstimate` from `@/lib/operational/technician-cards`;
- replace `TargetTile` with `TargetCabangTile` and `IntensifTile`:

```tsx
function TargetCabangTile({ kpi, cards }: { kpi: TechnicianKpi; cards: TechnicianHomeData["cards"] }) {
  const progress = targetProgress({
    type: cards.targetType,
    value: cards.targetValue,
    selesai: kpi.selesai,
    penghasilan: kpi.penghasilanBulanIni,
  });
  return (
    <>
      <p className="text-[15px] font-medium">Target Cabang</p>
      <div className="mt-auto text-2xl font-medium tabular-nums">
        {cards.targetType === "penghasilan" ? formatCurrencyPlain(progress.current) : progress.current}
        <span className="text-sm text-muted-foreground"> / {cards.targetType === "penghasilan" ? formatCurrencyPlain(progress.target) : progress.target}</span>
      </div>
      <div role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.percent}%` }} />
      </div>
    </>
  );
}

function IntensifTile({ kpi, cards }: { kpi: TechnicianKpi; cards: TechnicianHomeData["cards"] }) {
  const estimate = insentifEstimate({
    mode: cards.intensifMode,
    value: cards.intensifValue,
    selesai: kpi.selesai,
    penghasilan: kpi.penghasilanBulanIni,
  });
  return (
    <>
      <p className="text-[15px] font-medium">Intensif Saya</p>
      <p className="font-heading mt-auto text-3xl font-normal tabular-nums">{formatCurrencyPlain(estimate)}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Estimasi bulan ini · {cards.intensifMode === "fixed" ? `${formatCurrencyPlain(cards.intensifValue)} per servis` : `${cards.intensifValue}% dari pendapatan`}
      </p>
    </>
  );
}
```

- in the grid, read `const { showTarget, showIntensif } = initialData.cards;` and replace the
  old single card with:

```tsx
{showTarget && showIntensif ? (
  <>
    <BentoCard span={1} className="max-sm:order-7 max-sm:col-span-2"><TargetCabangTile kpi={kpi} cards={initialData.cards} /></BentoCard>
    <BentoCard span={1} className="max-sm:order-7 max-sm:col-span-2"><IntensifTile kpi={kpi} cards={initialData.cards} /></BentoCard>
  </>
) : showTarget ? (
  <BentoCard span={2} className="max-sm:order-7 max-sm:col-span-2"><TargetCabangTile kpi={kpi} cards={initialData.cards} /></BentoCard>
) : showIntensif ? (
  <BentoCard span={2} className="max-sm:order-7 max-sm:col-span-2"><IntensifTile kpi={kpi} cards={initialData.cards} /></BentoCard>
) : null}
```

- use the existing `formatCurrencyPlain` import (already in this file if absent, add from
  `@/lib/format`).

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run src/components/dashboard/technician-cards-ui.test.ts src/lib/operational/technician-cards.test.ts src/lib/operational/technician-dashboard.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: PASS for touched files.

- [ ] **Step 8: Commit**

```bash
git add src/lib/operational/technician-dashboard.ts src/lib/home/types.ts src/lib/home/home-data.ts src/components/dashboard/technician-dashboard.tsx src/components/dashboard/technician-cards-ui.test.ts
git commit -m "feat: show target and intensif cards on technician home"
```

---

## Self-review notes

- Spec coverage: data model → Task 1; admin config → Task 2; technician UI/visibility → Task 3; tests in each task.
- No placeholders: every code step contains concrete code.
- Type consistency: `cards` fields, helper signatures and branch column names are identical across tasks.
- Review Focus: all five cases are pinned by Task 1 tests.
