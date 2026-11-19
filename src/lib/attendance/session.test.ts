import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

const SECRET = "rahasia-tes";
const payload = {
  employeeId: "emp-1", organizationId: "org-1", branchId: "b-1",
  name: "Budi", exp: Date.now() + 60_000,
};

describe("session", () => {
  it("mengembalikan payload untuk token yang sah", () => {
    expect(verifySession(signSession(payload, SECRET), SECRET)).toEqual(payload);
  });
  it("menolak token yang dimodifikasi", () => {
    const token = signSession(payload, SECRET);
    const [body, sig] = token.split(".");
    expect(verifySession(`${body}.${sig.slice(0, -1)}x`, SECRET)).toBeNull();
  });
  it("menolak token dengan secret lain", () => {
    expect(verifySession(signSession(payload, SECRET), "secret-lain")).toBeNull();
  });
  it("menolak token kedaluwarsa", () => {
    const expired = { ...payload, exp: Date.now() - 1 };
    expect(verifySession(signSession(expired, SECRET), SECRET)).toBeNull();
  });
  it("menolak token kosong", () => {
    expect(verifySession(undefined, SECRET)).toBeNull();
    expect(verifySession("tidak-ada-titik", SECRET)).toBeNull();
  });
});
