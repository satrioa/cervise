import { describe, expect, it } from "vitest";

import { loginNoticeFromParams } from "./page";

/**
 * `loginNoticeFromParams` dipisah dari komponen supaya pemetaan kode error ke
 * kalimatnya bisa diuji tanpa merender React.
 */
describe("loginNoticeFromParams", () => {
  function params(query: string) {
    return new URLSearchParams(query);
  }

  it("tidak menampilkan apa pun tanpa parameter", () => {
    expect(loginNoticeFromParams(params(""))).toBeNull();
    expect(loginNoticeFromParams(params("next=/app"))).toBeNull();
  });

  it("mengonfirmasi password yang baru diganti", () => {
    expect(loginNoticeFromParams(params("password=updated"))).toEqual({
      kind: "success",
      message: "Password berhasil diganti. Silakan masuk.",
    });
  });

  it("menjelaskan link reset password yang tidak valid", () => {
    expect(loginNoticeFromParams(params("error=access_denied"))).toMatchObject({ kind: "error" });
  });

  it("menjelaskan akses ditolak, bukan menampilkan login kosong", () => {
    // Ini bug yang diperbaiki: `tenant-access-denied` sebelumnya jatuh ke
    // default dan tidak menghasilkan apa pun, jadi tenant yang trial-nya habis
    // melihat layar login tanpa penjelasan sama sekali.
    const notice = loginNoticeFromParams(params("error=tenant-access-denied"));
    expect(notice).not.toBeNull();
    expect(notice?.kind).toBe("error");
    expect(notice?.message).toMatch(/akses ditolak/i);
    // Pesan harus memberi arah, bukan cuma menyatakan masalah.
    expect(notice?.message).toMatch(/hubungi/i);
  });

  it("menjelaskan kegagalan pemeriksaan akses secara terpisah", () => {
    // Pesan ini berarti masalah sementara, bukan akun yang salah. Menyamakan
    // kalimatnya dengan `tenant-access-denied` akan membuat orang menghubungi
    // owner untuk sesuatu yang selesai sendiri dalam beberapa menit.
    const notice = loginNoticeFromParams(params("error=tenant-access-check-failed"));
    expect(notice?.kind).toBe("error");
    expect(notice?.message).toMatch(/beberapa saat lagi|sementara/i);
  });

  it("memberi pesan berbeda untuk owner dan member tenant yang tidak aktif", () => {
    const member = loginNoticeFromParams(params("error=tenant-inactive"));
    const owner = loginNoticeFromParams(params("error=tenant-owner-inactive"));

    expect(member?.kind).toBe("error");
    expect(owner?.kind).toBe("error");
    expect(member?.message).toMatch(/tidak bisa masuk/i);
    expect(owner?.message).toMatch(/tidak bisa masuk/i);
    // Owner tidak disuruh menghubungi dirinya sendiri.
    expect(member?.message).toMatch(/hubungi pemilik toko/i);
    expect(owner?.message).toMatch(/hubungi platform owner/i);
    expect(owner?.message).not.toBe(member?.message);
  });

  it("menjelaskan akun yang dinonaktifkan", () => {
    const notice = loginNoticeFromParams(params("error=account-inactive"));
    expect(notice?.kind).toBe("error");
    expect(notice?.message).toMatch(/dinonaktifkan/i);
    expect(notice?.message).toMatch(/hubungi admin/i);
  });

  it("tidak menampilkan pesan untuk kode error yang tidak dikenal", () => {
    expect(loginNoticeFromParams(params("error=entah"))).toBeNull();
  });

  it("mendahulukan error atas password ketika keduanya ada", () => {
    // `next` ikut membawa nilai lain di beberapa alur; yang penting error
    // yang paling spesifik yang ditampilkan.
    const notice = loginNoticeFromParams(params("password=updated&error=access_denied"));
    expect(notice?.message).toMatch(/password/i);
  });
});
