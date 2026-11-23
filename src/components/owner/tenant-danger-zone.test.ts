import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const component = read("src/components/owner/tenant-danger-zone.tsx");
const actions = read("src/app/owner/actions.ts");
const page = read("src/app/owner/tenants/[id]/page.tsx").replace(/\r\n/g, "\n");

describe("archiveTenant", () => {
  const action = () => {
    const start = actions.indexOf("export async function archiveTenant");
    return actions.slice(start, start + 1600);
  };

  it("hanya platform admin dan pakai soft delete", () => {
    const body = action();
    expect(body).toContain("requirePlatformAdmin()");
    expect(body).toContain('.update({ status: "cancelled"');
    expect(body).not.toContain('.delete()');
  });

  it("guard: tenant sudah diarsip atau nama tidak cocok ditolak", () => {
    const body = action();
    expect(body).toContain('organization.status === "cancelled"');
    expect(body).toContain("input.confirmName.trim() !== organization.name.trim()");
  });

  it("mengarsipkan menutup akses lewat status organizations", () => {
    expect(action()).toContain('status: "cancelled"');
  });

  it("UPDATE lewat admin client (role authenticated tidak punya grant UPDATE)", () => {
    expect(action()).toMatch(
      /createAdminClient\(\)\s*\.from\("organizations"\)\s*\.update\(\{ status: "cancelled"/,
    );
  });
});

describe("TenantDangerZone", () => {
  it("kartu Danger Zone butuh ketik nama tenant dulu", () => {
    expect(component).toContain("Danger Zone");
    expect(component).toContain('id="confirm-tenant-name"');
    expect(component).toContain("confirmName.trim() === organizationName.trim()");
    expect(component).toMatch(/disabled=\{!matches \|\| saving\}/);
  });

  it("tombol destruktif memanggil archiveTenant dan refresh", () => {
    expect(component).toContain('variant="destructive"');
    expect(component).toContain("archiveTenant({ organizationId, confirmName })");
    expect(component).toContain("router.refresh()");
  });

  it("tenant yang sudah diarsip tidak bisa diarsip ulang", () => {
    expect(component).toContain('const archived = status === "cancelled"');
    expect(component).toContain("Tenant ini sudah diarsipkan.");
  });
});

describe("Halaman detail tenant", () => {
  it("memasang Danger Zone di bawah card Invoice", () => {
    expect(page).toContain('import { TenantDangerZone } from "@/components/owner/tenant-danger-zone"');
    const invoice = page.indexOf("<Card>\n        <CardHeader><CardTitle className=\"text-base\">Invoice");
    const danger = page.indexOf("<TenantDangerZone");
    expect(invoice).toBeGreaterThan(-1);
    expect(danger).toBeGreaterThan(invoice);
    expect(page).toContain("organizationName={organization.name}");
  });
});
