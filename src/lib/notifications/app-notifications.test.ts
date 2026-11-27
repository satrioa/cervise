import { describe, expect, it, vi } from "vitest";

const insert = vi.fn(
  async (): Promise<{ error: { message: string } | null }> => ({ error: null }),
);
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: () => ({ insert }) })),
}));

import { notifyRoles } from "./app-notifications";

describe("notifyRoles", () => {
  it("menulis notifikasi dengan audience role", async () => {
    await notifyRoles({
      organizationId: "org-1",
      branchId: "br-1",
      branchLabel: "Pusat",
      event: "servis_created",
      roles: ["TECHNICIAN", "FRONTLINER"],
      title: "Servis baru",
      body: "#SV-1",
      href: "/app/servis/1",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        branch_id: "br-1",
        audience_roles: ["TECHNICIAN", "FRONTLINER"],
        event: "servis_created",
      }),
    );
  });

  it("fail-soft saat insert gagal", async () => {
    insert.mockResolvedValueOnce({ error: { message: "RLS denied" } });
    await expect(
      notifyRoles({
        organizationId: "org-1",
        branchId: "br-1",
        branchLabel: "Pusat",
        event: "buka_toko",
        roles: ["MASTER_ADMIN"],
        title: "Buka toko",
        body: "Pusat",
      }),
    ).resolves.toBeUndefined();
  });
});
