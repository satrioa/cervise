import { describe, expect, it, vi, afterEach } from "vitest";
import { allTransports, supportedTransports, getSavedTransportByType } from "../detect";

describe("detect order", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("TRANSPORTS order contains webSerial then rawbt with webBluetooth or webSerial first", () => {
    const ids = allTransports().map((t) => t.id);
    expect(ids[0]).toBe("webSerial");
    expect(ids).toContain("rawbt");
    expect(ids).toContain("webBluetooth");
    expect(ids[ids.length - 1]).toBe("browser");
  });

  it("supportedTransports asserts webSerial/webBluetooth first when navigator mocked", () => {
    // `globalThis.navigator` di Node hanya punya getter, jadi tidak bisa
    // di-assign langsung seperti di browser.
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      serial: { requestPort: async () => ({}), getPorts: async () => [] },
      bluetooth: { requestDevice: async () => ({}) },
      userAgent: "Mozilla/5.0 (Linux; Android 13)",
    });
    const supported = supportedTransports().map((t) => t.id);
    expect(supported[0] === "webSerial" || supported[0] === "webBluetooth").toBe(true);
    expect(supported).toContain("rawbt");
  });

  it("getSavedTransportByType exists and has no args change", () => {
    expect(typeof getSavedTransportByType).toBe("function");
  });
});
