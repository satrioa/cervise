import { describe, expect, it } from "vitest";
import { friendlyErrorMessage } from "./error-message";

describe("friendlyErrorMessage", () => {
  it("meneruskan pesan yang sudah ramah", () => {
    expect(friendlyErrorMessage(new Error("Nama cabang wajib"))).toBe("Nama cabang wajib");
  });

  it("memetakan duplicate key", () => {
    expect(friendlyErrorMessage(new Error('duplicate key value violates unique constraint "x"')))
      .toBe("Data sudah terdaftar. Periksa kembali.");
  });

  it("memetakan foreign key", () => {
    expect(friendlyErrorMessage(new Error("violates foreign key constraint")))
      .toBe("Data masih dipakai di transaksi lain.");
  });

  it("memetakan permission denied", () => {
    expect(friendlyErrorMessage(new Error("permission denied for table servis")))
      .toBe("Akses ditolak. Periksa hak akses Anda.");
  });

  it("memetakan error auth", () => {
    expect(friendlyErrorMessage(new Error("Invalid login credentials")))
      .toBe("Email atau password salah.");
    expect(friendlyErrorMessage(new Error("Email not confirmed")))
      .toBe("Email belum terverifikasi. Cek kotak masuk Anda.");
  });

  it("memetakan jaringan", () => {
    expect(friendlyErrorMessage(new Error("Failed to fetch")))
      .toBe("Koneksi terputus. Periksa internet lalu coba lagi.");
  });

  it("memetakan chunk error Next", () => {
    expect(friendlyErrorMessage(new Error("ChunkLoadError: Loading chunk 42 failed")))
      .toBe("Halaman perlu dimuat ulang.");
  });

  it("fallback untuk nilai tidak bermakna", () => {
    expect(friendlyErrorMessage(undefined)).toBe("Terjadi masalah. Coba lagi.");
    expect(friendlyErrorMessage("[object Object]")).toBe("Terjadi masalah. Coba lagi.");
    expect(friendlyErrorMessage(new Error(""))).toBe("Terjadi masalah. Coba lagi.");
  });

  it("membuang newline dan membatasi panjang", () => {
    const out = friendlyErrorMessage(new Error("x".repeat(300)));
    expect(out).not.toContain("\n");
    expect(out.length).toBeLessThanOrEqual(140);
  });

  it("memakai fallback kustom", () => {
    expect(friendlyErrorMessage(undefined, "Gagal menyimpan")).toBe("Gagal menyimpan");
  });
});
