import { afterEach, describe, expect, it, vi } from "vitest";
import { isIosDevice, playSound } from "./sound";

function setNavigator(userAgent: string, maxTouchPoints = 0) {
  vi.stubGlobal("navigator", { userAgent, maxTouchPoints });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("iOS audio notification", () => {
  it("mendeteksi iPhone, iPad, dan iPod", () => {
    setNavigator("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(isIosDevice()).toBe(true);

    setNavigator("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)");
    expect(isIosDevice()).toBe(true);

    setNavigator("Mozilla/5.0 (iPod touch; CPU iPhone OS 17_0 like Mac OS X)");
    expect(isIosDevice()).toBe(true);
  });

  it("mendeteksi iPadOS yang menyamar sebagai Macintosh", () => {
    setNavigator("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5);
    expect(isIosDevice()).toBe(true);
  });

  it("tidak mendeteksi desktop biasa", () => {
    setNavigator("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0);
    expect(isIosDevice()).toBe(false);

    setNavigator("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0);
    expect(isIosDevice()).toBe(false);
  });

  it("tidak membuka AudioContext sama sekali di iOS", () => {
    setNavigator("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    const AudioContext = vi.fn();
    vi.stubGlobal("AudioContext", AudioContext);
    vi.stubGlobal("window", { AudioContext });

    expect(() => playSound("chime")).not.toThrow();
    expect(AudioContext).not.toHaveBeenCalled();
  });
});
