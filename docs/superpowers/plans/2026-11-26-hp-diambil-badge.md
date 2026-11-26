# Badge HP Diambil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menampilkan badge "HP Diambil" di tabel dan kartu daftar servis hanya untuk status `Sudah Diambil`.

**Architecture:** Komponen pembungkus kecil di dalam `src/app/app/servis/page.tsx` memakai `Badge` yang sudah diimpor halaman itu. pembungkus dipanggil di dua tempat yang sudah merender `StageTrack`. Tidak ada perubahan data, query, atau schema.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, `Badge` dari `@/components/ui/badge`, Vitest untuk tes regresi teks.

**Spec:** `docs/superpowers/specs/2026-11-26-hp-diambil-badge-design.md`

## Global Constraints

- Badge hanya untuk `status === "Sudah Diambil"`; status `"Selesai"` tidak berbadge.
- Sumber data tetap `r.status` dari `ServisListRow`; dilarang menambah kolom tabel, query, migrasi, atau RLS baru.
- `StageTrack` tetap dirender; badge ditempatkan di sampingnya, bukan menggantikannya.
- Teks badge persis `HP Diambil`.
- Tidak mengubah pricing, alur status, atau file di luar dua file yang disebut di bawah.

## Review Focus

- Status `"Selesai"` phải tetap tanpa badge — dicegah oleh cabang `status !== "Sudah Diambil"` di task 1.
- Status `"Sudah Diambil"` di tabel desktop harus menampilkan badge — dicegah oleh pemakaian pertama di task 1.
- Status `"Sudah Diambil"` di kartu mobile harus menampilkan badge — dicegah oleh pemakaian kedua di task 1.
- Badge tidak boleh menggeser harga di kartu mobile — dibungkus `div flex flex-wrap items-center gap-1` di task 1.
- Tidak boleh ada perubahan schema/query — dicegah oleh tes regresi yang hanya menyentuh dua file di task 1.

---

### Task 1: Badge HP Diambil di tabel dan kartu servis

**Files:**
- Modify: `src/app/app/servis/page.tsx` (dekat `PaymentBadge` ~91; sel Status ~1026; kartu mobile ~1066)
- Test: `src/lib/ui-regressions.test.ts`

**Interfaces:**
- Consumes: `Stage` dari `@/lib/operational/stage-track`, `Badge` dari `@/components/ui/badge`, `r.status` dari `ServisListRow`.
- Produces: `PickedUpBadge({ status }: { status: Stage }): JSX.Element | null`, dipakai dua kali dalam file yang sama.

- [ ] **Step 1: Write the failing test**

Tambahkan tes ini di dalam `describe("regresi UI", ...)` pada `src/lib/ui-regressions.test.ts`:

```ts
  it("tabel dan kartu servis menandai HP yang sudah diambil", () => {
    const page = read("src/app/app/servis/page.tsx");
    expect(page).toContain('status !== "Sudah Diambil"');
    expect(page.match(/HP Diambil/g) ?? []).toHaveLength(1);
    expect(page.match(/<PickedUpBadge status=\{r\.status\} \/>/g) ?? []).toHaveLength(2);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ui-regressions.test.ts`
Expected: FAIL pada `toContain('status !== "Sudah Diambil"')`.

- [ ] **Step 3: Write minimal implementation**

Tambah pembungkus di dekat `PaymentBadge` pada `src/app/app/servis/page.tsx`:

```tsx
function PickedUpBadge({ status }: { status: Stage }) {
  if (status !== "Sudah Diambil") return null;
  return (
    <Badge variant="secondary" size="sm" className="shrink-0 font-medium">
      HP Diambil
    </Badge>
  );
}
```

Ganti sel Status tabel desktop:

```tsx
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <StageTrack stage={r.status} />
                        <PickedUpBadge status={r.status} />
                      </div>
                    </TableCell>
```

Ganti baris `StageTrack` pada kartu mobile:

```tsx
                        <div className="flex flex-wrap items-center gap-1">
                          <StageTrack stage={r.status} />
                          <PickedUpBadge status={r.status} />
                        </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ui-regressions.test.ts`
Expected: PASS (13 tes).

- [ ] **Step 5: Verify build and full suite**

Run:
```
npx tsc --noEmit
npm test -- --run
npm run build
```
Expected: `tsc` exit 0, seluruh tes lulus (jumlah sebelumnya 2099 + 1), build sukses.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/servis/page.tsx src/lib/ui-regressions.test.ts
git commit -m "feat(servis): badge HP Diambil di tabel dan kartu"
```

Catatan: file karyawan yang sedang dimodifikasi sesi lain tidak boleh ikut di-stage.
