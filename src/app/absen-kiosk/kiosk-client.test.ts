import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/absen-kiosk/kiosk-client.tsx"), "utf8");

describe("sumber foto absen kiosk", () => {
  it("hanya mengambil gambar dari kamera, tanpa input galeri", () => {
    expect(source).toContain("capture()");
    expect(source).not.toMatch(/type="file"/);
    expect(source).not.toMatch(/galeri/i);
  });

  it("menolak absen bila frame kamera belum siap", () => {
    expect(source).toContain('toast.error("Selfie belum siap. Coba lagi.")');
  });
});
