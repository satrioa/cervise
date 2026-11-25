import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("kuota WA tidak mengunci pesan selamanya", () => {
  it("reservasi rejected dihapus supaya bisa dicoba ulang", () => {
    const source = read("supabase/migrations/20261125140000_retry_rejected_wa_reservation.sql");
    expect(source).toContain("v_existing.quota_source <> 'none'");
    expect(source).toContain("delete from public.whatsapp_usage_logs");
  });

  it("wallet baru memakai kuota paket aktif", () => {
    const source = read("supabase/migrations/20261125130000_sync_wallet_quota_limit.sql");
    expect(source).toContain("select coalesce(p.whatsapp_quota, 0)");
    expect(source).toContain("included_limit = 0 and v_package_quota > 0");
  });
});
