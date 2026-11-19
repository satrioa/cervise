import { describe, expect, it } from "vitest";
import { isAbsenHost } from "./host";

describe("isAbsenHost", () => {
  it("hanya mengenali host absen", () => {
    expect(isAbsenHost("absen.kaggo.app")).toBe(true);
    expect(isAbsenHost("ABSEN.KAGGO.APP")).toBe(true);
    expect(isAbsenHost("kaggo.app")).toBe(false);
    expect(isAbsenHost("cervise.vercel.app")).toBe(false);
    expect(isAbsenHost("absen.kaggo.app.evil.com")).toBe(false);
  });
});
