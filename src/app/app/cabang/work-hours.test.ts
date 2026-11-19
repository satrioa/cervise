import { describe, expect, it } from "vitest";
import { validWorkHours } from "./work-hours";

describe("validWorkHours", () => {
  it("menerima jam HH:MM yang valid", () => {
    expect(validWorkHours("08:00", "17:00")).toBe(true);
    expect(validWorkHours("07:30", "16:45")).toBe(true);
  });
  it("menolak jam pulang sebelum/sama dengan jam masuk", () => {
    expect(validWorkHours("17:00", "08:00")).toBe(false);
    expect(validWorkHours("08:00", "08:00")).toBe(false);
  });
  it("menolak format selain HH:MM", () => {
    expect(validWorkHours("8", "17:00")).toBe(false);
    expect(validWorkHours("08:00", "17:60")).toBe(false);
  });
});
