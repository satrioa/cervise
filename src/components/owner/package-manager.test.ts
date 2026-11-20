import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const manager = read("src/components/owner/package-manager.tsx");
const actions = read("src/app/owner/actions.ts");

describe("Owner Packages", () => {
  it("kartu paket memakai grid 3 kolom", () => {
    expect(manager).toMatch(/sm:grid-cols-2 lg:grid-cols-3/);
  });

  it("tiap kartu punya tombol hapus", () => {
    expect(manager).toContain("deletePackage(item.id)");
    expect(manager).toContain("aria-label={`Hapus ${item.name}`}");
  });
});

describe("deletePackage guard", () => {
  it("platform admin only dan menolak paket yang masih dipakai", () => {
    const start = actions.indexOf("export async function deletePackage");
    const body = actions.slice(start, start + 1200);
    expect(body).toContain("requirePlatformAdmin()");
    expect(body).toContain('from("tenant_subscriptions")');
    expect(body).toContain('from("invoices")');
    expect(body).toContain('from("manual_subscription_payments")');
    expect(body).toContain('from("packages").delete()');
    expect(body).toMatch(/used > 0\) \{[\s\S]*Paket masih digunakan/);
  });
});

describe("form Pay as You Grow terpisah", () => {
  it("kartu custom membuka mode custom, paket lain mode standard", () => {
    expect(manager).toContain('item.code === "custom"');
    expect(manager).toContain("Atur Pay as You Grow");
    expect(manager).toContain('setMode("custom")');
    expect(manager).toContain('setMode("standard")');
  });

  it("blok tarif tambahan hanya tampil di form custom", () => {
    expect(manager).toMatch(/\{isCustomForm \? \(\s*<div className="rounded-md border p-3">/);
    expect(manager).toContain('code: isCustomForm ? "custom" : form.code');
  });

  it("form standard punya field kode, harga tahunan, dan durasi trial", () => {
    expect(manager).toMatch(/\{!isCustomForm \? \(/);
    expect(manager).toContain('id="package-code"');
    expect(manager).toContain('id="package-annual"');
    expect(manager).toContain('id="package-trial"');
  });
});
