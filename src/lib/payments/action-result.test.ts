import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { actionErrorMessage } from "./action-result";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("hasil aksi pembelian", () => {
  it("pesan error aman untuk toast", () => {
    expect(actionErrorMessage(new Error("Gateway menolak"), "fallback")).toBe("Gateway menolak");
    expect(actionErrorMessage({ message: "HTTP 401" }, "fallback")).toBe("HTTP 401");
    expect(actionErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("semua aksi pembelian mengembalikan ok:false, bukan throw", () => {
    for (const [file, actions] of [
      ["src/app/app/pengaturan/usage/actions.ts", ["createTopupOrderAction", "createCheckoutAction"]],
      ["src/app/app/pengaturan/subscription/actions.ts", ["requestPackage", "createSubscriptionCheckoutAction"]],
    ] as const) {
      const source = read(file);
      for (const action of actions) {
        expect(source, `${file}:${action}`).toContain(`${action}(`);
        expect(source, `${file}:${action}`).toContain("ok: false, error:");
      }
    }
  });

  it("client menampilkan error hasil aksi", () => {
    const topup = read("src/components/billing/topup-purchase-flow.tsx");
    const billing = read("src/components/billing/tenant-billing-view.tsx");
    expect(topup).toContain("toast.error(result.error)");
    expect(billing).toContain("toast.error(result.error)");
  });
});
