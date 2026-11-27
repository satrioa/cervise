# Tabel Servis: Waktu Masuk, Status Ringkas, dan Sort Tanggal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kolom Tanggal Masuk menampilkan tanggal+jam WIB dan bisa di-sort; kolom Status menampilkan satu ikon+label serta keterangan update terakhir, menggantikan stepper dan badge "HP Diambil".

**Architecture:** Data timestamp ditambahkan di `getServisList` dan `mapServisListRows`. Helper `formatWibStamp` di `src/lib/format.ts` menjadi satu-satunya formatter WIB. Halaman `servis/page.tsx` merender komponen `ServisStatus` yang menggantikan `StageTrack` di tabel dan kartu, serta menambah state `dateSort` mengikuti pola `priceSort`.

**Tech Stack:** Next.js App Router, React/TypeScript, Tailwind, lucide-react, `Intl.DateTimeFormat`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-servis-table-status-sort-design.md`

## Global Constraints

- Format persis `27/11/2026 | 14:32`, timezone `Asia/Jakarta`, jam 24 jam; dipakai untuk Tanggal Masuk dan `Terakhir update …`.
- Label status memakai nilai persis status DB (`Sudah Diambil`), bukan `Diambil` / `HP Diambil`.
- Badge "HP Diambil" harus hilang; status diwakili ikon status.
- Urutan sort `none → asc → desc → none` pada timestamp penuh, diterapkan sebelum sort harga.
- `ServisListRow.date` tetap `created_at.slice(0, 10)` untuk filter tanggal.
- Tidak ada perubahan DB/RLS/pricing/alur status.

## Review Focus

- `updated_at` null pada baris lama → `updatedAt` jatuh ke `created_at`, bukan kosong — diuji Task 1.
- Timestamp UTC `07:32` harus tampil `14:32` WIB — diuji Task 1.
- Nilai tanggal invalid harus menampilkan `—`, bukan `Invalid Date` — diuji Task 1.
- Badge lama tidak boleh tersisa di tabel maupun kartu — diuji Task 2.
- Sort tanggal mengurutkan timestamp penuh, bukan string tanggal yang sudah dipotong — diuji Task 2 lewat source guard.

---

### Task 1: Timestamp lengkap dan formatter WIB

**Files:**
- Modify: `src/app/app/servis/actions.ts` (select ~60, tipe `serviceRows` ~67)
- Modify: `src/lib/operational/servis-list.ts` (tipe ~23-54, mapper ~83-98)
- Modify: `src/lib/format.ts` (tambah helper setelah `formatCurrencyPlain`)
- Create: `src/lib/format.test.ts`
- Test: `src/lib/operational/servis-list.test.ts`

**Interfaces:**
- Consumes: `created_at`, `updated_at` dari `cervise_services`.
- Produces: `formatWibStamp(value: string | null | undefined): string`; `ServisListRow.createdAt: string`; `ServisListRow.updatedAt: string`.

- [ ] **Step 1: Write the failing tests**

Buat `src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatWibStamp } from "./format";

describe("formatWibStamp", () => {
  it("memakai WIB dengan format dd/MM/yyyy | HH:mm", () => {
    expect(formatWibStamp("2026-11-27T07:32:00.000Z")).toBe("27/11/2026 | 14:32");
  });

  it("menampilkan — untuk nilai kosong atau tidak valid", () => {
    expect(formatWibStamp(null)).toBe("—");
    expect(formatWibStamp("bukan tanggal")).toBe("—");
  });
});
```

Tambah test di `describe("mapServisListRows", ...)` pada `src/lib/operational/servis-list.test.ts`:

```ts
  it("menyimpan timestamp penuh dan memakai updated_at bila ada", () => {
    const [row] = mapServisListRows({
      services: [{
        id: "service-3",
        service_number: "SRV-2026-0003",
        tracking_code: null,
        device: "iPhone 12",
        complaint: null,
        status: "Masuk",
        price: 0,
        customer_id: null,
        teknisi_id: null,
        created_at: "2026-11-27T07:32:00.000Z",
        updated_at: "2026-11-27T09:00:00.000Z",
      }],
      customers: [],
      profiles: [],
      finance: [],
    });

    expect(row.createdAt).toBe("2026-11-27T07:32:00.000Z");
    expect(row.updatedAt).toBe("2026-11-27T09:00:00.000Z");
    expect(row.date).toBe("2026-11-27");
  });
```

Tambahkan `updated_at: null` pada dua objek `services` yang sudah ada di file tes itu (baris ~53 dan ~86), karena tipe input berubah.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/format.test.ts src/lib/operational/servis-list.test.ts`
Expected: FAIL — `formatWibStamp` belum ada dan `updatedAt` belum ada di row.

- [ ] **Step 3: Implement formatter and row fields**

Di `src/lib/format.ts`, setelah `formatCurrencyPlain`:

```ts
/** Cap WIB untuk tabel: dd/MM/yyyy | HH:mm (24 jam). */
export function formatWibStamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} | ${part("hour")}:${part("minute")}`;
}
```

Di `src/lib/operational/servis-list.ts`:
- `ServisServiceInput`: tambah `updated_at: string | null;`
- `ServisListRow`: tambah `createdAt: string;` dan `updatedAt: string;`
- di objek hasil mapper: `createdAt: service.created_at,` dan `updatedAt: service.updated_at || service.created_at,`

Di `src/app/app/servis/actions.ts`:
- `select(...)` tambah `, updated_at` setelah `created_at`;
- tipe `serviceRows` tambah `updated_at: string | null;`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/format.test.ts src/lib/operational/servis-list.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts src/lib/operational/servis-list.ts src/lib/operational/servis-list.test.ts src/app/app/servis/actions.ts
git commit -m "feat(servis): timestamp lengkap dan formatter WIB untuk tabel"
```

---

### Task 2: Status ringkas, waktu di tabel, dan sort tanggal

**Files:**
- Modify: `src/app/app/servis/page.tsx` (tipe ~60, state ~224, `filteredTable` ~371, `PickedUpBadge` ~105, header ~1019, sel tanggal/status ~1023-1026, kartu ~1063-1070)
- Test: `src/lib/ui-regressions.test.ts` (test badge lama ~70)

**Interfaces:**
- Consumes: `formatWibStamp` dari Task 1; `ServisListRow.createdAt`/`.updatedAt` dari Task 1; `STAGES` dari `@/lib/operational/stage-track`.
- Produces: `ServisStatus({ stage: Stage; updatedAt: string })`, state `dateSort: "none" | "asc" | "desc"`.

- [ ] **Step 1: Replace the obsolete failing test**

Di `src/lib/ui-regressions.test.ts`, ganti test lama `tabel dan kartu servis menandai HP yang sudah diambil` dengan:

```ts
  it("tabel servis memakai status ringkas dan sort tanggal masuk", () => {
    const page = read("src/app/app/servis/page.tsx");
    expect(page).not.toContain("PickedUpBadge");
    expect(page.match(/<ServisStatus stage=\{r\.status\}/g) ?? []).toHaveLength(2);
    expect(page).toContain("Terakhir update {formatWibStamp(updatedAt)}");
    expect(page).toContain("formatWibStamp(r.createdAt ?? r.date)");
    expect(page).toContain('aria-label="Urutkan tanggal masuk"');
    expect(page).toContain("const [dateSort,");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ui-regressions.test.ts`
Expected: FAIL pada `not.toContain("PickedUpBadge")`.

- [ ] **Step 3: Implement UI and sorting**

Di `src/app/app/servis/page.tsx`:
- import `formatWibStamp` dari `@/lib/format`;
- `ServisItem`: tambah `createdAt?: string; updatedAt?: string;`;
- state: setelah `priceSort`, tambah `const [dateSort, setDateSort] = useState<"none" | "asc" | "desc">("none");`;
- ganti `filteredTable`:

```tsx
  const filteredTable = useMemo(() => {
    const rows = filter === "Semua" ? filteredByAll : filteredByAll.filter((d) => d.status === filter);
    const sorted = dateSort === "none"
      ? rows
      : [...rows].sort((a, b) => {
          const delta = new Date(a.createdAt ?? a.date).getTime() - new Date(b.createdAt ?? b.date).getTime();
          return dateSort === "asc" ? delta : -delta;
        });
    if (priceSort === "none") return sorted;
    return [...sorted].sort((a, b) => (priceSort === "asc" ? a.price - b.price : b.price - a.price));
  }, [filteredByAll, filter, dateSort, priceSort]);
```

- hapus fungsi `PickedUpBadge`, ganti dengan:

```tsx
function ServisStatus({ stage, updatedAt }: { stage: Stage; updatedAt: string }) {
  const entry = STAGES.find((s) => s.key === stage) ?? STAGES[0];
  const Icon = entry.icon;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
        <Icon className="size-3.5 shrink-0" />
        {stage}
      </span>
      <span className="text-[11px] text-muted-foreground">
        Terakhir update {formatWibStamp(updatedAt)}
      </span>
    </div>
  );
}
```

- header: ganti `<TableHead>Tanggal Masuk</TableHead>` dengan:

```tsx
<TableHead>
  <button type="button" onClick={() => setDateSort((prev) => prev === "none" ? "asc" : prev === "asc" ? "desc" : "none")} className="inline-flex items-center gap-1 font-medium hover:text-foreground" aria-label="Urutkan tanggal masuk">
    Tanggal Masuk{dateSort === "asc" ? <ArrowUpIcon className="size-3" /> : dateSort === "desc" ? <ArrowDownIcon className="size-3" /> : <ArrowUpDownIcon className="size-3 opacity-40" />}
  </button>
</TableHead>
```

- sel tanggal tabel: `{formatWibStamp(r.createdAt ?? r.date)}`
- sel status tabel: `<ServisStatus stage={r.status} updatedAt={r.updatedAt ?? r.createdAt ?? r.date} />`
- kartu mobile: `{r.customer} · {formatWibStamp(r.createdAt ?? r.date)}` dan `<ServisStatus stage={r.status} updatedAt={r.updatedAt ?? r.createdAt ?? r.date} />` menggantikan `StageTrack`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ui-regressions.test.ts`
Expected: PASS (test count kembali ke jumlah semula).

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
git add src/app/app/servis/page.tsx src/lib/ui-regressions.test.ts
git commit -m "feat(servis): status ringkas dan sort tanggal masuk di tabel"
```

Catatan: jangan stage file milik sesi lain yang sedang dimodifikasi.
