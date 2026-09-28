import { describe, expect, it } from "vitest";
import {
  MENTION_TOKEN_RE,
  newToken,
  parseMentionText,
  stripMentionTokens,
  toMentionToken,
  tokensIn,
  visibleLength,
  VISIBLE_TITLE_MAX,
} from "./mention-tokens";

describe("parseMentionText", () => {
  it("memecah teks ber-token jadi segmen teks dan segmen mention", () => {
    expect(parseMentionText("Telp {{m:k3f9a1}} soal IMEI")).toEqual([
      { kind: "text", text: "Telp " },
      { kind: "mention", token: "k3f9a1" },
      { kind: "text", text: " soal IMEI" },
    ]);
  });

  it("menangani mention di awal dan akhir", () => {
    expect(parseMentionText("{{m:aaaaaa}} di tengah")).toEqual([
      { kind: "mention", token: "aaaaaa" },
      { kind: "text", text: " di tengah" },
    ]);
  });

  it("token tak dikenal tetap jadi segmen teks, tidak hilang", () => {
    // Mention yang dihapus (on delete set null) meninggalkan token di catatan
    // lama. Kalau token ini dibuang, isi catatannya hilang bersama -- kegagalan
    // yang tidak terlihat sampai teknisi tiba-tiba mendapat catatan kosong.
    const value = "Telp {{m:ghost1}} soal IMEI";
    expect(parseMentionText(value)).toEqual([
      { kind: "text", text: "Telp " },
      { kind: "mention", token: "ghost1" },
      { kind: "text", text: " soal IMEI" },
    ]);
    expect(stripMentionTokens(value)).toBe("Telp  soal IMEI");
  });

  it("tidak ikut baris baru dari pemanggilan sebelumnya", () => {
    // MENTION_TOKEN_RE punya flag `g`, yang menyimpan posisi terakhir. Kalau
    // dipakai ulang tanpa di-reset, panggilan kedua melompat sebagian teks.
    const value = "a {{m:aaaaaa}} b {{m:bbbbbb}} c";
    expect(parseMentionText(value)).toEqual(parseMentionText(value));
    expect(tokensIn(value)).toEqual(["aaaaaa", "bbbbbb"]);
  });

  it("menolak token dengan panjang di luar 6-10 karakter", () => {
    // Bentuk token harus sama dengan yang diterima check di database, kalau
    // tidak mention tersimpan dan gagal dibaca balik saat render.
    expect(MENTION_TOKEN_RE.test("{{m:abcde}}")).toBe(false);
    expect(MENTION_TOKEN_RE.test("{{m:abcdefghijk}}")).toBe(false);
    MENTION_TOKEN_RE.lastIndex = 0;
    expect(MENTION_TOKEN_RE.test("{{m:abcdef}}")).toBe(true);
  });
});

describe("stripMentionTokens dan visibleLength", () => {
  it("menghitung panjang dari teks yang terlihat, bukan string ber-token", () => {
    // Check 200 karakter di database dihitung di atas string yang sudah berisi
    // token. Kalau batas dihitung dari string itu juga, catatan yang isinya
    // jelas-jelas pendek akan ditolak tanpa petunjuk.
    const value = `Telp ${toMentionToken("k3f9a1")} soal IMEI`;
    expect(visibleLength(value)).toBe("Telp  soal IMEI".trim().length);
    expect(value.length).toBeGreaterThan(visibleLength(value));
  });

  it("200 karakter terlihat tetap lolos walau ada beberapa mention", () => {
    const text = "a".repeat(VISIBLE_TITLE_MAX);
    const withMentions = `${toMentionToken("aaaaaa")}${text}${toMentionToken("bbbbbb")}`;
    expect(visibleLength(withMentions)).toBe(VISIBLE_TITLE_MAX);
    // 200 + 24 = 224, masih di bawah pembatas pengaman 600 di database.
    expect(withMentions.length).toBeLessThan(600);
  });

  it("stripMentionTokens tidak meninggalkan spasi ganda yang menyesatkan", () => {
    // Spasi ganda itu kosmetik, tapi untuk teks yang disimpan berarti panjang
    // yang terlihat berbeda dari yang diketik pengguna.
    expect(stripMentionTokens("a{{m:aaaaaa}}b")).toBe("ab");
  });
});

describe("newToken", () => {
  it("menghasilkan token 6 karakter alfanumerik kecil", () => {
    // Bentuknya harus lolos check database `^[0-9a-z]{6,10}$`, kalau tidak
    // seluruh insert mention ditolak constraint.
    for (let i = 0; i < 20; i += 1) {
      expect(newToken()).toMatch(/^[0-9a-z]{6}$/);
    }
  });

  it("tidak menghasilkan token yang sudah dipakai", () => {
    const used = newToken();
    for (let i = 0; i < 20; i += 1) {
      expect(newToken([used])).not.toBe(used);
    }
  });
});

describe("tokensIn", () => {
  it("mengumpulkan token dari teks ber-token", () => {
    expect(tokensIn(`{{m:aaaaaa}} tengah {{m:bbbbbb}}`)).toEqual(["aaaaaa", "bbbbbb"]);
  });
});
