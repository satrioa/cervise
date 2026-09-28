import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src", "app", "app", "karyawan", "actions.ts"),
  "utf8",
);

describe("validasi nomor karyawan", () => {
  it("memakai helper bersama, bukan aturan sendiri", () => {
    expect(source).toContain("validatePhone");
  });

  it("menyimpan nomor dalam bentuk kanonik", () => {
    // expression lama menyimpan input apa adanya: phone: input.phone?.trim() || null
    expect(source).not.toContain("phone: input.phone?.trim() || null");
  });

  it("menuntut nomor saat role teknisi", () => {
    // Nama role di kode adalah TECHNICIAN. Huruf "TEKNI" tidak pernah muncul
    // di file ini, jadi assertion itu hanya bisa hijau bila teknisi ditulis
    // dengan ejaan lain; yang dijaga betulkan ada di describe createKaryawan
    // dan updateKaryawan di bawah.
    expect(source).toContain("TECHNICIAN");
  });
});

/*
 * Bagian di bawah menguji hal yang sama per Jalur, bukan per file. Server
 * action di sini memanggil supabase.auth.admin dan tidak bisa dijalankan di
 * unit test, jadi yang dijaga adalah sumbernya: apakah tiap jalur menulis
 * nilai yang sudah divalidasi, dan apakah nomor teknisi diwajibkan sebelum
 * ada tulisan ke database.
 */

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

function sliceFunction(sourceText: string, name: string): string {
  const start = sourceText.indexOf(`export async function ${name}`);
  expect(start, `fungsi ${name} tidak ditemukan`).toBeGreaterThan(-1);
  const rest = sourceText.slice(start + 1);
  const next = rest.search(/\nexport (async )?function /);
  return next === -1 ? sourceText.slice(start) : sourceText.slice(start, start + 1 + next);
}

const karyawanSource = readSource("src/app/app/karyawan/actions.ts");

describe("createKaryawan", () => {
  const body = sliceFunction(karyawanSource, "createKaryawan");

  it("menulis nilai hasil validasi, bukan input mentah", () => {
    expect(body).toContain("phone: phoneCheck.value");
    expect(body).not.toMatch(/phone:\s*input\.phone/);
  });

  it("memeriksa nomor sebelum membuat user auth", () => {
    // Kalau validasi baru jalan setelah createUser, nomor rusak akan
    // meninggalkan akun auth yatim lalu error constraint terlempar ke user.
    const check = body.indexOf("validatePhone(input.phone)");
    const createUser = body.indexOf("auth.admin.createUser");
    expect(check).toBeGreaterThan(-1);
    expect(createUser).toBeGreaterThan(-1);
    expect(check).toBeLessThan(createUser);
  });

  it("menolak nomor yang tidak valid dengan pesan dari helper", () => {
    expect(body).toContain("if (!phoneCheck.ok) throw new Error(phoneCheck.error)");
  });

  it("mewajibkan nomor hanya untuk teknisi", () => {
    expect(body).toContain('if (targetRole === "TECHNICIAN" && !phoneCheck.value)');
    expect(body).toContain("Nomor WhatsApp wajib diisi untuk teknisi.");
    // Syaratnya harus menyebut role-nya. Tanpa itu, teknisi tanpa nomor
    // lolos begitu saja dan semua orang tanpa nomor ikut ditolak.
    expect(body).not.toMatch(/if \(!phoneCheck\.value\)/);
  });
});

describe("updateKaryawan", () => {
  const body = sliceFunction(karyawanSource, "updateKaryawan");

  it("menulis nilai hasil validasi, termasuk di rollback", () => {
    expect(body).toContain("phone: phoneCheck.value");
    // restoreProfile menulis phone: previousProfile.phone, yaitu nilai yang
    // dibaca kembali dari database, jadi tidak perlu divalidasi ulang.
    // Yang tidak boleh ada di fungsi ini adalah penulisan dari input mentah.
    expect(body).not.toMatch(/phone:\s*input\.phone/);
  });

  it("memeriksa nomor sebelum menyentuh tabel apa pun", () => {
    const check = body.indexOf("validatePhone(input.phone)");
    const employeeWrite = body.indexOf('from("employees")');
    expect(check).toBeGreaterThan(-1);
    expect(employeeWrite).toBeGreaterThan(-1);
    expect(check).toBeLessThan(employeeWrite);
  });

  it("mewajibkan nomor hanya untuk teknisi", () => {
    expect(body).toContain('if (targetRole === "TECHNICIAN" && !phoneCheck.value)');
    expect(body).toContain("Nomor WhatsApp wajib diisi untuk teknisi.");
    expect(body).not.toMatch(/if \(!phoneCheck\.value\)/);
  });
});

describe("updateProfile", () => {
  const body = sliceFunction(readSource("src/app/app/pengaturan/profil/actions.ts"), "updateProfile");

  it("memakai helper yang sama untuk menyimpan bentuk kanonik", () => {
    expect(body).toContain("validatePhone(data.phone)");
    expect(body).toContain("const phone = phoneCheck.value");
    expect(body).not.toContain("data.phone.trim() || null");
  });

  it("tetap membiarkan karyawan mengganti nomornya sendiri tanpa nomor", () => {
    // Jalur ini milik karyawan sendiri lewat column grant, jadi tidak boleh
    // ikut menuntut nomor hanya karena perannya teknisi.
    expect(body).not.toContain("TECHNICIAN");
  });
});

describe("form karyawan", () => {
  const source = readSource("src/components/karyawan/karyawan-form-dialog.tsx");
  const submit = source.slice(
    source.indexOf("const submit = async () => {"),
    source.indexOf("  };", source.indexOf("const submit = async () => {")),
  );

  it("menolak lebih dulu di sisi client kalau teknisi tidak punya nomor", () => {
    // Server yang berwenang enforcing, tapi cek di client membuat admin tahu
    // sebelum satu putaran request.
    expect(submit).toContain('if (role === "TECHNICIAN")');
    expect(submit).toContain("validatePhone(phone)");
    expect(submit).toContain("Nomor WhatsApp wajib untuk teknisi");
  });

  it("menandai nomor sebagai wajib hanya untuk teknisi", () => {
    expect(source).toContain('Label>Telepon{role === "TECHNICIAN" ? " *" : ""}<');
    expect(source).toContain('placeholder={role === "TECHNICIAN" ? "0812xxxx (wajib)" : "0812xxxx (opsional)"}');
  });
});

describe("daftar karyawan", () => {
  const list = readSource("src/components/karyawan/karyawan-list.tsx");

  it("tidak menyembunyikan nomor di balik email", () => {
    // Email selalu ada karena createKaryawan mewajibkannya, jadi fallback
    // lama membuat nomor teknisi tidak pernah terlihat sama sekali.
    expect(list).not.toContain("m.email ?? m.phone");
    expect(list).toContain('{m.email ?? "—"}');
  });

  it("menandai teknisi yang belum punya nomor", () => {
    expect(list).toContain("belum ada nomor");
    expect(list).toContain('m.role === "TECHNICIAN"');
  });
});

describe("export karyawan", () => {
  const csv = readSource("src/components/karyawan/export-karyawan-csv.tsx");
  const page = readSource("src/app/app/karyawan/page.tsx");
  const toolbar = readSource("src/components/karyawan/karyawan-toolbar.tsx");

  it("menambah kolom Telepon", () => {
    expect(csv).toMatch(/phone:\s*string/);
    expect(csv).toContain('"Telepon"');
    expect(csv).toContain("r.phone, r.cabang");
  });

  it("mengisi kolom itu dari profiles.phone", () => {
    expect(page).toMatch(/phone:\s*k\.phone\s*\?\?\s*"—"/);
    // Email tidak lagi memakai nomor sebagai pengganti, karena nomor punya
    // kolomnya sendiri sekarang.
    expect(page).not.toMatch(/email:\s*k\.email\s*\?\?\s*k\.phone/);
  });

  it("menampilkan kolom itu di dialog export yang benar dipakai halaman", () => {
    // KaryawanExportButton tidak memakai export-karyawan-csv.tsx; ia
    // membangun CSV dari daftar field-nya sendiri.
    expect(toolbar).toMatch(/id:\s*"phone"/);
    expect(toolbar).toMatch(/label:\s*"Telepon"/);
  });
});
