import { describe, expect, it } from "vitest";
import { normalizePhone62, phoneSearchDigits, phoneStoredForms, toFonnteTarget, validatePhone } from "./phone";

describe("phoneSearchDigits", () => {
  /**
   * Bug ditemukan lewat test end-to-end: customer "Rina Pembeli" ada di
   * database dengan phone 6281277770001, tapi kolom pencarian POS menulis
   * ilike "%081277770001%". Substring itu tidak pernah muncul di dalam
   * 6281277770001, jadi setiap orang yang mengetik nomor lokal 08... tidak
   * akan pernah menemukan customer yang sudah ada.
   *
   * Hasilnya sengaja BUKAN bentuk kanonik 62..., melainkan nomor tanpa awalan
   * negara: itulah satu-satunya substring yang muncul di baris lama "08..."
   * maupun baris baru "62..." sekaligus.
   */
  it("membuang awalan negara, bukan menyeragamkan ke 62...", () => {
    expect(phoneSearchDigits("081277770001")).toBe("81277770001");
    expect(phoneSearchDigits("6281277770001")).toBe("81277770001");
    expect(phoneSearchDigits("81277770001")).toBe("81277770001");
    expect(phoneSearchDigits("+62 812-7777-0001")).toBe("81277770001");
  });

  it("cocok dengan baris lama yang tersimpan 08... dan baris baru 62...", () => {
    const term = phoneSearchDigits("081277770001");
    for (const stored of ["081277770001", "6281277770001"]) {
      expect(stored.includes(term)).toBe(true);
    }
  });

  it("tetap berguna untuk pencarian sebagian, tidak menolak input pendek", () => {
    // Batas 10-15 digit milik normalizePhone62 tidak boleh ikut di sini:
    // "812" belum cukup untuk disimpan tapi sudah cukup untuk mencari.
    expect(phoneSearchDigits("0812")).toBe("812");
    expect(phoneSearchDigits("8")).toBe("8");
    expect(phoneSearchDigits("62")).toBe("");
  });

  it("membuang semua non-digit supaya spasi dan tanda hubung tidak memutus", () => {
    expect(phoneSearchDigits("0812 7777 0001")).toBe("81277770001");
    expect(phoneSearchDigits("(0812) 7777-0001")).toBe("81277770001");
  });

  it("mengembalikan string kosong untuk input tanpa digit", () => {
    expect(phoneSearchDigits("")).toBe("");
    expect(phoneSearchDigits("   ")).toBe("");
    expect(phoneSearchDigits("abc")).toBe("");
    expect(phoneSearchDigits(null)).toBe("");
  });

  it("menyamakan hasilnya dengan normalizePhone62 setelah awalan dibuang", () => {
    for (const raw of ["081234567890", "81234567890", "6281234567890", "+62 812-3456-7890"]) {
      expect(`62${phoneSearchDigits(raw)}`).toBe(normalizePhone62(raw));
    }
  });
});

describe("phoneStoredForms", () => {
  it("mengembalikan bentuk kanonik dan bentuk lama 08...", () => {
    expect(phoneStoredForms("081277770001")).toEqual(["6281277770001", "081277770001"]);
    expect(phoneStoredForms("6281277770001")).toEqual(["6281277770001", "081277770001"]);
    expect(phoneStoredForms("+62 812-7777-0001")).toEqual(["6281277770001", "081277770001"]);
  });

  it("kosong untuk nomor yang tidak masuk akal", () => {
    expect(phoneStoredForms("0812")).toEqual([]);
    expect(phoneStoredForms("+1 202 555 0147")).toEqual([]);
  });
});

describe("normalizePhone62", () => {
  it("menggabungkan awalan 0, 8, 62, dan +62 ke satu bentuk", () => {
    expect(normalizePhone62("081234567890")).toBe("6281234567890");
    expect(normalizePhone62("81234567890")).toBe("6281234567890");
    expect(normalizePhone62("6281234567890")).toBe("6281234567890");
    expect(normalizePhone62("+62 812-3456-7890")).toBe("6281234567890");
  });

  it("menolak nomor yang tidak masuk akal", () => {
    expect(normalizePhone62("0812")).toBeNull();
    expect(normalizePhone62("")).toBeNull();
    expect(normalizePhone62(null)).toBeNull();
    expect(normalizePhone62(undefined)).toBeNull();
    expect(normalizePhone62("+1 202 555 0147")).toBeNull();
  });
});

describe("validatePhone", () => {
  it("menganggap kosong sebagai tidak diisi, bukan error", () => {
    expect(validatePhone("")).toEqual({ ok: true, value: null });
    expect(validatePhone("   ")).toEqual({ ok: true, value: null });
    expect(validatePhone(null)).toEqual({ ok: true, value: null });
  });

  it("mengembalikan bentuk kanonik untuk nomor yang valid", () => {
    expect(validatePhone(" 0812 3456 7890 ")).toEqual({
      ok: true,
      value: "6281234567890",
    });
  });

  it("menolak karakter yang bukan bagian dari nomor", () => {
    const result = validatePhone("<script>x</script>");
    expect(result.ok).toBe(false);
  });

  it("menerima hanya karakter yang boleh ada di nomor", () => {
    // Hanya kelas karakter penuh yang mengizinkan tanda baca ini. Kalau
    // karakternya dipersempit jadi angka saja, test ini harus gagal.
    expect(validatePhone("+62 (812) 3456-7890")).toEqual({
      ok: true,
      value: "6281234567890",
    });
  });

  it("menolak nomor yang terlalu panjang", () => {
    expect(validatePhone("+62 812 3456 7890 1234 5678").ok).toBe(false);
  });

  it("menguji batas 24 karakter tepat di batasnya", () => {
    // Batas karakter harus diuji tepat di batasnya, dan nomornya harus lolos
    // SEMUA cek lain, supaya test ini benar-benar hanya menguji cap. Bungkus
    // " -----" di akhir itu wajib, bukan sisa: pada 24 karakter dengan maksimal
    // 15 digit, minimal 9 karakter harus tanda baca. Jangan dirapikan jadi
    // nomor yang terlihat natural.
    const at24 = "0812 3456 78 (012) -----";
    expect(at24).toHaveLength(24);
    expect(validatePhone(at24).ok).toBe(true);

    const at25 = `${at24}7`;
    expect(at25).toHaveLength(25);
    expect(validatePhone(at25)).toEqual({
      ok: false,
      error: "Nomor telepon terlalu panjang.",
    });
  });
});

describe("toFonnteTarget", () => {
  it("hanya menerima hasil yang diawali 62", () => {
    expect(toFonnteTarget("081234567890")).toBe("6281234567890");
    expect(toFonnteTarget("12025550147")).toBeNull();
    expect(toFonnteTarget(null)).toBeNull();
  });
});
