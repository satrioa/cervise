import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const hero = readFileSync(
  join(process.cwd(), "src/components/originkit/hero-02.tsx"),
  "utf8",
);
const css = readFileSync(
  join(process.cwd(), "src/components/originkit/hero-02.css"),
  "utf8",
);

describe("hero mockup layered scene", () => {
  it("mengimpor keempat layer PNG dari src/lib/mockup", () => {
    for (const file of [
      "[PS] iPhone Pro Free Scene.png",
      "[PS] iPhone Pro Free Scene-shadow.png",
      "[PS] iPad Pro Free Scene.png",
      "[PS] iPad Pro Free Scene-shadow.png",
    ]) {
      expect(hero).toContain(file);
    }
  });

  it("urutan z-index: iPhone scene > iPad scene > iPhone shadow > iPad shadow", () => {
    const scene = hero.slice(hero.indexOf("const MockupScene"));
    const block = (name: string) => {
      const match = scene.match(new RegExp(`<img[\\s\\S]*?src=\\{\\s*${name}\\.src\\s*\\}[\\s\\S]*?/>`));
      expect(match).not.toBeNull();
      return match?.[0] ?? "";
    };
    const ipadShadowBlock = block("ipadShadow");
    const iphoneShadowBlock = block("iphoneShadow");
    const ipadSceneBlock = block("ipadScene");
    const iphoneSceneBlock = block("iphoneScene");

    expect(ipadShadowBlock).not.toMatch(/z-\d+/);
    expect(iphoneShadowBlock).toContain("z-10");
    expect(ipadSceneBlock).toContain("z-20");
    expect(iphoneSceneBlock).toContain("z-30");
    expect(scene.indexOf("ipadShadow.src")).toBeLessThan(scene.indexOf("iphoneShadow.src"));
    expect(scene.indexOf("iphoneShadow.src")).toBeLessThan(scene.indexOf("ipadScene.src"));
    expect(scene.indexOf("ipadScene.src")).toBeLessThan(scene.indexOf("iphoneScene.src"));
  });

  it("shadow dan device memakai animasi yang sama supaya geraknya linked", () => {
    expect(hero.match(/animate-mockup-ipad/g) ?? []).toHaveLength(2);
    expect(hero.match(/animate-mockup-iphone/g) ?? []).toHaveLength(2);
    expect(hero.match(/animation-delay:-1\.2s/g) ?? []).toHaveLength(2);
    expect(hero.match(/animation-delay:-0\.6s/g) ?? []).toHaveLength(2);
  });

  it("keyframes wiggle ada dan dimatikan saat reduced motion", () => {
    expect(css).toContain("@keyframes mockup-wiggle-ipad");
    expect(css).toContain("@keyframes mockup-wiggle-iphone");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("hero desktop dua kolom: teks kiri, mockup kanan", () => {
    expect(hero).toContain("lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]");
    expect(hero).toContain("<MockupScene />");
    expect(hero).not.toMatch(/<PhoneShowcase \/>/);
  });
});
