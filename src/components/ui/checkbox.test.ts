import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { keepHiddenInputInPlace } from "./checkbox";

/**
 * Bug yang dijaga di sini: mencentang kelengkapan di form servis baru membuat
 * dialog melompat kembali ke atas.
 *
 * Penyebabnya bukan state form, tapi posisi input tersembunyi milik Base UI.
 * Input itu dirender `position: fixed; top: 0; left: 0`; karena checkbox selalu
 * dibungkus `<label>`, mengklik label membuat browser memfokuskan input itu,
 * dan memfokuskan elemen fixed di pojok kiri atas menggulir container yang
 * scrollable ke awal.
 */
describe("input tersembunyi checkbox", () => {
  it("dipindah ke posisi statisnya sendiri, bukan fixed di (0,0)", () => {
    const style = { position: "fixed", top: "0px", left: "0px" };

    keepHiddenInputInPlace({ style } as unknown as HTMLInputElement);

    // `absolute` + offset `auto` = tetap di tempat aslinya (di sebelah kotak
    // centang), jadi memfokuskannya tidak menggulir apa pun.
    expect(style).toEqual({ position: "absolute", top: "auto", left: "auto" });
  });

  it("tidak melempar error saat Base UI melepas elemennya", () => {
    expect(() => keepHiddenInputInPlace(null)).not.toThrow();
  });

  it("benar-benar dipasang ke input, bukan hanya diekspor", () => {
    // Tanpa `inputRef`, perbaikan di atas tidak pernah jalan dan bug-nya balik.
    const source = readFileSync(
      join(process.cwd(), "src", "components", "ui", "checkbox.tsx"),
      "utf8",
    );
    expect(source).toContain("inputRef={mergedInputRef}");
    expect(source).toContain("keepHiddenInputInPlace(element)");
  });
});
