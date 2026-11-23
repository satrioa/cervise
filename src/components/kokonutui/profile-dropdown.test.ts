import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/kokonutui/profile-dropdown.tsx"),
  "utf8",
);

describe("ProfileDropdown membuka sesuai posisi pill", () => {
  it("memilih arah dari posisi trigger di viewport saat dibuka", () => {
    expect(source).toMatch(/const \[placement, setPlacement\]/);
    expect(source).toMatch(/triggerRef\.current\?\.getBoundingClientRect\(\)/);
    expect(source).toMatch(/rect\.top \+ rect\.height \/ 2 > window\.innerHeight \/ 2/);
  });

  it("panel di bawah membuka ke atas, di atas ke bawah", () => {
    expect(source).toMatch(/placement === "up" \? "bottom-0" : "top-0"/);
  });

  it("jangkar animasi klip ikut berubah saat membuka ke atas", () => {
    expect(source).toMatch(/inset\(calc\(100% - \$\{h\}px\) 0px 0px/);
    expect(source).toMatch(/placement === "up" \? outerClipUp : outerClipDown/);
  });
});

describe("HoldSignOut memberi haptic saat tahan selesai", () => {
  it("haptic dipanggil sebelum onComplete di timer hold", () => {
    expect(source).toContain('import { haptic } from "@/lib/haptic"');
    const start = source.indexOf("timer.current = window.setTimeout");
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("onComplete(via)", start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toContain("haptic()");
  });
});

describe("Avatar ProfileDropdown memakai foto profil", () => {
  it("Account menerima avatarUrl dan avatar merender gambar", () => {
    expect(source).toMatch(/avatarUrl\?: string \| null;/);
    expect(source).toMatch(/src=\{photo\}/);
    expect(source).toMatch(/object-cover/);
  });

  it("gambar rusak jatuh ke inisial", () => {
    expect(source).toMatch(/onError=\{\(\) => setBrokenUrl\(photo\)\}/);
    expect(source).toMatch(/\) : \(\s*initialsOf\(account\)/);
  });
});
