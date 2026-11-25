import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("nomor invoice detail servis", () => {
  const title = read("src/app/app/servis/[id]/page.tsx");
  const field = read("src/components/servis/servis-detail-view.tsx");

  it("judul dan field sama-sama memakai service_number yang tersimpan", () => {
    expect(title).toContain("data.service_number");
    expect(field).toContain("Nomor Servis: {serviceNumber}");
  });

  it("tidak ada formatter waktu yang dihitung ulang saat render", () => {
    expect(title).not.toContain("formatInvoiceNo");
    expect(field).not.toContain("formatInvoiceNo");
  });
});
