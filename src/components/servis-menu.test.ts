import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const menu = readFileSync(
  join(process.cwd(), "src/components/servis-context-menu.tsx"),
  "utf8",
);

describe("menu aksi servis", () => {
  it("memilih Diambil hanya saat lunas dan belum diambil", () => {
    expect(menu).not.toContain("isPaidStage");
    expect(menu).toContain('const isPaid = servis.payment === "Lunas"');
    expect(menu).toContain('const isPickedUp = servis.status === "Sudah Diambil"');
    expect(menu).toContain("isPaid && !isPickedUp");
  });

  it("desktop dan sheet mengirim status Sudah Diambil lewat tanda tangan", () => {
    expect(menu.match(/Diambil/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(menu.match(/onStatusChange\?\.\(servis, "Sudah Diambil"\)/g) ?? []).toHaveLength(2);
    expect(menu).toContain("TruckIcon");
  });
});

const dialog = readFileSync(
  join(process.cwd(), "src/components/servis/servis-payment-dialog.tsx"),
  "utf8",
);

describe("skeleton dialog bayar servis", () => {
  it("mengikuti layout dua kolom konten akhir", () => {
    expect(dialog).not.toContain('<Skeleton className="h-40 w-full" />');
    expect(dialog).toContain("function PaymentDialogSkeleton()");
    expect(dialog).toContain("md:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]");
    expect(dialog).toContain("<PaymentDialogSkeleton />");
  });
});
