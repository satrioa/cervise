import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const layout = read("src/app/layout.tsx");
const layer = read("src/components/layout/sound-layer.tsx");
const button = read("src/components/ui/button.tsx");
const menu = read("src/components/ui/menu.tsx");
const select = read("src/components/ui/select.tsx");
const popover = read("src/components/ui/popover.tsx");
const command = read("src/components/ui/command.tsx");
const compactShell = read("src/components/layout/compact-shell.tsx");
const appShell = read("src/components/layout/app-shell.tsx");
const sound = read("src/lib/sound.ts");
const soundToggle = read("src/components/layout/sound-toggle.tsx");

/**
 * Penjaga regresi sistem suara. Tes ini membaca sumber (bukan merender DOM)
 * karena tujuan yang dijaga adalah *wiring*: kalau SoundLayer dilepas dari
 * layout atau primitif kehilangan hook suaranya, interaksi diam-diam jadi
 * hening tanpa ada error runtime.
 */
describe("sound wiring", () => {
  it("memasang SoundLayer sekali di root layout", () => {
    expect(layout.match(/<SoundLayer \/>/g) ?? []).toHaveLength(1);
  });

  it("SoundLayer mengenali interaksi umum dan berjalan di fase capture", () => {
    for (const selector of [
      '[role="menuitem"]',
      '[role="option"]',
      '[role="tab"]',
      '[role="checkbox"]',
      '[aria-pressed]',
      "[aria-expanded]",
      "a[href]",
    ]) {
      expect(layer).toContain(selector);
    }
    expect(layer).toContain('addEventListener("click", onClick, true)');
    expect(layer).toContain("data-sfx-silent");
    expect(layer).toContain("data-sfx-managed");
  });

  it("Button menandai event-nya agar tidak dobel dengan SoundLayer", () => {
    expect(button).toContain("data-sfx-managed");
    expect(button).toContain("__cerviseSfx");
  });

  it("overlayer memakai playedRecently agar satu klik satu suara", () => {
    for (const source of [menu, select, popover, command]) {
      expect(source).toContain("playedRecently");
      expect(source).toContain("sfx.");
    }
  });

  it("kontrol mute ada di sidebar, bukan di top nav", () => {
    // Top nav sengaja bersih: kontrol suara pindah ke footer sidebar
    // (`AppShell`) dan section "Sound System" di drawer (`MenuSound`).
    expect(appShell).toContain("SoundToggle");
    expect(compactShell).not.toContain("SoundToggle");
  });

  it("store suara memakai key kanonik dan memigrasikan key lama", () => {
    expect(sound).toContain('"cervise-sound"');
    expect(sound).toContain('"cervise_sound"');
    expect(sound).toContain("export function writeSoundSettings");
    expect(sound).toContain("export function getSoundSnapshot");
    expect(sound).toContain("export function subscribeSoundStore");
    expect(sound).toContain("export function useSoundSettings");
  });

  it("playCue kompatibel dengan shell baru dan menghormati volume", () => {
    expect(sound).toContain(
      'export type CueName = "tap" | "success" | "error" | "notify"',
    );
    expect(sound).toContain("export function playCue");
    expect(sound).toContain("settings.volume / 100");
  });

  it("kontrol suara memakai store yang sama", () => {
    expect(soundToggle).toContain("useSoundSettings");
    expect(soundToggle).toContain("writeSoundSettings");
  });
});
