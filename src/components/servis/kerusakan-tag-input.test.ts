import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * KerusakanTagInput punya animasi dari @smoothui/animated-tags, tapi BUKAN
 * komponen itu. Versi smoothui hanya bisa diklik dari daftar tag yang sudah
 * ditentukan di awal - tidak ada input teks sama sekali, tidak ada navigasi
 * keyboard, tidak ada batas jumlah, tidak ada saran dari database.
 *
 * Mengganti komponen ini dengan animated-tags akan menghapus kemampuan
 * mengetik kerusakan yang belum pernah tercatat - dan itu kondisi yang
 * paling sering terjadi di lapangan. Test di bawah menjaga kemampuan itu
 * tidak hilang diam-diam kalau suatu saat komponennya diganti.
 */

function readCode(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !(/(?<!:)\/\//.test(line) || line.trimStart().startsWith("//")))
    .join("\n");
}

const source = readCode("src/components/servis/kerusakan-tag-input.tsx");

describe("input kerusakan tetap bisa mengetik, bukan hanya klik", () => {
  it("memakai animated-tags sebagai gaya, bukan komponen", () => {
    // Kalau file ini mengimpor AnimatedTags dan merender tag statis dari
    // initialTags, kemampuan mengetik sudah hilang.
    expect(source).not.toMatch(/from "@smoothui/);
    expect(source).not.toMatch(/initialTags/);
  });

  it("memiliki input teks yang menyimpan nilai", () => {
    expect(source).toMatch(/<input[\s\S]*value=\{input\}/);
    expect(source).toMatch(/onChange=\{\(e\) => setInput\(e\.target\.value\)\}/);
  });

  it("saran diambil dari database, bukan daftar hardcoded", () => {
    expect(source).toContain("searchTags");
    // searchTags membaca cervise_service_tags di DB, diurutkan usage_count.
    expect(source).not.toMatch(/const tags = \["/);
  });

  it("tetap punya navigasi keyboard", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Tab", "Enter", "Escape", "Backspace"]) {
      expect(source).toContain(key);
    }
  });

  it("membatasi jumlah tag dan menolak duplikat", () => {
    // Batas 5 dan dedup ikut ditegakkan server di createServis
    // (actions.ts), jadi keduanya harus sinkron.
    expect(source).toMatch(/value\.length >= 5/);
    expect(source).toMatch(/toLowerCase\(\)\)\.includes\(t\)/);
  });
});

describe("animasi memakai motion dan menghormati reduced motion", () => {
  it("membungkus chip dengan AnimatePresence + motion", () => {
    expect(source).toMatch(/import \{[^}]*AnimatePresence[^}]*\} from "motion\/react"/);
    expect(source).toContain("<AnimatePresence initial={false}>");
    expect(source).toContain("<motion.div");
  });

  it("menghormati preferensi reduced motion", () => {
    expect(source).toContain("useReducedMotion");
    expect(source).toMatch(/reduceMotion \? INSTANT : SPRING/);
  });

  it("chip yang sudah ada tidak ikut Flying in saat render pertama", () => {
    // Tanpa initial={false}, seluruh daftar tag akan berkedip dari bawah
    // setiap kali form dibuka - excruciating kalau form ini sering dibuka.
    const presenceCount = (source.match(/<AnimatePresence initial=\{false\}>/g) ?? []).length;
    expect(presenceCount).toBeGreaterThanOrEqual(2);
  });

  it("tetap memakai layout agar chip lain bergeser halus saat dihapus", () => {
    expect(source).toContain("layout");
  });
});
