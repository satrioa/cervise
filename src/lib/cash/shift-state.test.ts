import { describe, expect, it } from "vitest";
import { shouldPromptOpeningBalance, type ClosedTodaySession } from "./shift-state";

const closedToday: ClosedTodaySession = {
  id: "session-1",
  closedAt: "2026-11-17T10:30:00.000Z",
  closingBalance: 450_000,
};

describe("shouldPromptOpeningBalance", () => {
  it("tidak menyuruh isi saldo ulang setelah shift hari ini ditutup", () => {
    expect(shouldPromptOpeningBalance(false, closedToday)).toBe(false);
  });

  it("mengarahkan ke dialog bila belum ada sesi dan belum pernah ditutup hari ini", () => {
    expect(shouldPromptOpeningBalance(false, null)).toBe(true);
  });

  it("tidak mengganggu bila masih ada sesi terbuka", () => {
    expect(shouldPromptOpeningBalance(true, null)).toBe(false);
    expect(shouldPromptOpeningBalance(true, closedToday)).toBe(false);
  });
});
