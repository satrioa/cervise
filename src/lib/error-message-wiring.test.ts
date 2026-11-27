import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("wiring pesan error", () => {
  it("sonner memasang jembatan error", () => {
    expect(read("src/components/ui/sonner.tsx")).toContain("installToastSoundBridge()");
  });

  it("jembatan menyaring toast.error lewat helper", () => {
    const sound = read("src/lib/sound.ts");
    expect(sound).toContain("friendlyErrorMessage");
    expect(sound).toContain("api.error = (message, data)");
  });

  it("jembatan menyaring callback error toast.promise", () => {
    expect(read("src/lib/sound.ts")).toContain("callbacks.error = (value: unknown)");
  });
});
