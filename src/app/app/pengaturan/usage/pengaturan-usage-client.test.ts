import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/app/pengaturan/usage/pengaturan-usage-client.tsx"),
  "utf8",
);

describe("halaman usage & billing", () => {
  it("memakai BillingOverview, bukan kartu 'dari N kuota' yang ambigu", () => {
    expect(source).toContain("BillingOverview");
    expect(source).not.toContain("dari {quota} kuota");
    expect(source).not.toContain("Sisa kuota");
  });

  it("setiap kuota diberi label dan penjelasan apa yang dihitung", () => {
    for (const label of ["Tiket servis", "Pesan WhatsApp included", "Pesan WhatsApp top-up"]) {
      expect(source, `${label} tidak punya label`).toContain(`label: "${label}"`);
    }
    expect(source).toContain("Tiket servis tanpa batas");
    expect(source).toContain("Kuota bulanan shared untuk seluruh cabang");
    expect(source).toContain("Pesan tambahan yang dibeli dari platform owner");
    expect(source).toContain("WaTopupPanel");
  });

  it("status invoice DB dipetakan ke status tampilan", () => {
    expect(source).toContain('if (status === "approved") return "paid"');
    expect(source).toContain('if (status === "pending") return "open"');
    expect(source).toContain('if (status === "rejected") return "failed"');
  });
});
