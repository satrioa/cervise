import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const page = readSource("src/app/app/servis/page.tsx");
const dialog = readSource("src/components/servis/pickup-signature-dialog.tsx");
const detail = readSource("src/components/servis/servis-detail-view.tsx");
const actions = readSource("src/app/app/servis/actions.ts");

/**
 * Pickup wajib ditandatangani customer. Tiga jalur bisa memindahkan servis ke
 * "Sudah Diambil" — context menu, drag kanban, dan bulk status — dan ketiganya
 * harus berhenti di dialog tanda tangan, bukan memanggil updateServisStatus.
 */
describe("pickup servis wajib tanda tangan customer", () => {
  it("context menu dan tombol status berhenti di dialog", () => {
    const start = page.indexOf("const handleStatusChange");
    const end = page.indexOf("const openPickup");
    const body = page.slice(start, end);
    expect(body).toContain('if (next === "Sudah Diambil")');
    expect(body).toContain("openPickup([s])");
    // Jalur pickup tidak boleh langsung menulis status.
    expect(body).not.toMatch(/updateServisStatus\([^)]*"Sudah Diambil"/);
  });

  it("drag kanban ke Sudah Diambil membuka dialog sebelum state berubah", () => {
    const start = page.indexOf('if (moved && moved.to === "Sudah Diambil")');
    expect(start).toBeGreaterThan(-1);
    const body = page.slice(start, start + 400);
    expect(body).toContain("openPickup([moved.item])");
    expect(body).toContain("return");
  });

  it("bulk Sudah Diambil memakai satu tanda tangan untuk semua servis", () => {
    const start = page.indexOf("const handleBulkStatus");
    const body = page.slice(start, start + 400);
    expect(body).toContain('if (next === "Sudah Diambil")');
    expect(body).toContain("openPickup(selectedData");
    expect(body).toContain("setBulkStatusOpen(false)");
  });

  it("dialog memakai komponen signature-pad Kokonut", () => {
    expect(dialog).toContain('from "@/components/kokonutui/signature-pad"');
    expect(dialog).toContain("<SignaturePad");
  });

  it("tombol konfirmasi terkunci sampai ada SVG tanda tangan", () => {
    expect(dialog).toContain('signature!.startsWith("<svg")');
    expect(dialog).toContain("disabled={!ready || saving}");
    // Wajib: tidak ada tombol lewati.
    expect(dialog).not.toContain("Lewati");
  });

  it("satu tanda tangan dipakai untuk semua servis lewat onConfirm", () => {
    expect(dialog).toContain("await onConfirm(signature)");
    // Penyimpanan per servis ada di halaman supaya yang sudah berhasil tetap
    // pindah status walau servis lain gagal.
    expect(page).toContain("await confirmServisPickup(it.id, signature)");
    expect(page).toContain('applyLocalStatus(it, "Sudah Diambil")');
  });

  it("detail servis menampilkan tanda tangan sebagai gambar, bukan HTML mentah", () => {
    expect(detail).toContain("d.pickup_signature");
    expect(detail).toContain("data:image/svg+xml;charset=utf-8");
    expect(detail).toContain("d.picked_up_at");
    expect(detail).not.toContain("dangerouslySetInnerHTML");
  });

  it("detail mengambil kolom pickup dari database", () => {
    expect(actions).toContain("pickup_signature, picked_up_at");
  });

  it("detail tetap tampil walau kolom pickup belum dimigrasikan", () => {
    // Regresi: `pickup_signature`/`picked_up_at` dulu ikut di select utama.
    // Di database yang migrasinya belum diterapkan, satu kolom hilang membuat
    // SELURUH detail gagal dan dialog jatuh ke data list — kelengkapan,
    // password, garansi, kondisi awal, dan "diinput oleh" jadi kosong.
    const start = actions.indexOf("export async function getServisDetail");
    const body = actions.slice(start, actions.indexOf("export type ServisDetail"));
    const mainSelect = body.slice(0, body.indexOf(".single()"));

    expect(mainSelect).not.toContain("pickup_signature");
    expect(body).toContain('select("pickup_signature, picked_up_at")');
    expect(body).toContain("pickup_signature: pickup?.pickup_signature ?? null");
  });
});
