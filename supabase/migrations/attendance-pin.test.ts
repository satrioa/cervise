import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(new URL("./20261119120000_attendance_pin.sql", import.meta.url)),
  "utf8",
);

describe("migrasi PIN absen", () => {
  it("menyimpan hash bcrypt, bukan PIN plaintext", () => {
    expect(sql).toContain("gen_salt('bf')");
    expect(sql).toContain("crypt(p_pin, e.pin_hash)");
  });
  it("mengunci 5 kegagalan selama 15 menit dengan pesan generik", () => {
    expect(sql).toContain("Email atau PIN salah");
    expect(sql).toContain(">= 5");
    expect(sql).toContain("interval '15 minutes'");
  });
  it("hanya service_role yang bisa memanggil RPC", () => {
    expect(sql).toContain("grant execute on function public.verify_employee_pin");
    expect(sql).toContain("to service_role");
  });
});
