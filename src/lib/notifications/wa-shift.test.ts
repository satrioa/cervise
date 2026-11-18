import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const migration = read("supabase/migrations/20261118120000_wa_shift_notifications.sql");
const cash = read("src/app/app/actions/cash.ts");
const dispatcher = read("src/lib/notifications/dispatcher.ts");

describe("notifikasi shift WA", () => {
  it("migration menambah event, to_kind owner, dan payload", () => {
    expect(migration).toContain("shift_opened");
    expect(migration).toContain("shift_closed");
    expect(migration).toContain("'owner'");
    expect(migration).toContain("payload jsonb");
  });

  it("server action kas mengantre saat buka dan tutup shift", () => {
    expect(cash).toContain("shift_opened");
    expect(cash).toContain("shift_closed");
    expect(cash).toContain("cervise_notification_outbox");
  });

  it("dispatcher memilih template shift dan nomor owner", () => {
    expect(dispatcher).toContain("shift_open");
    expect(dispatcher).toContain("shift_closed");
    expect(dispatcher).toContain("owner_phone");
    expect(dispatcher).toContain("contact_phone");
    expect(dispatcher).toContain("getWaTemplate");
    expect(dispatcher).toContain("template.language");
  });
});
