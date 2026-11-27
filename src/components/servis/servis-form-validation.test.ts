import { describe, expect, it } from "vitest";
import { firstFieldError, validateServisForm } from "./servis-form-validation";

describe("validateServisForm", () => {
  it("menandai field yang kosong", () => {
    const errors = validateServisForm({
      teknisiId: "",
      merk: "",
      tipe: "",
      custName: "",
      custPhone: "",
    });
    expect(errors).toEqual({
      teknisiId: "Teknisi wajib diisi",
      merk: "Merk wajib",
      tipe: "Tipe wajib",
      kerusakan: "Kerusakan minimal 1 tag",
      custName: "Nama customer wajib",
      custPhone: "Kontak WA wajib",
    });
  });

  it("tidak mengembalikan error saat semua terisi", () => {
    expect(
      validateServisForm({
        teknisiId: "t1",
        merk: "Samsung",
        tipe: "S25",
        custName: "Adib",
        custPhone: "08951234567",
        kerusakan: ["Matot"],
      }),
    ).toEqual({});
  });

  it("menandai format WA yang salah", () => {
    const errors = validateServisForm({
      teknisiId: "t1",
      merk: "Samsung",
      tipe: "S25",
      custName: "Adib",
      custPhone: "abc",
      kerusakan: ["Matot"],
    });
    expect(errors.custPhone).toBe("Format WA tidak valid (08xxx)");
  });
});

describe("firstFieldError", () => {
  it("mengembalikan null saat tidak ada error", () => {
    expect(firstFieldError({})).toBeNull();
  });

  it("mengembalikan pesan pertama", () => {
    expect(firstFieldError({ merk: "Merk wajib", tipe: "Tipe wajib" })).toBe("Merk wajib");
  });
});
