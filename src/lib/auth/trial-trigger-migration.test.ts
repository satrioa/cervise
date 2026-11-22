import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261122110000_fix_trial_trigger_ambiguous_trial_days.sql",
  ),
  "utf8",
);

describe("migration trigger trial", () => {
  it("kolom trial_days di-qualify supaya tidak ambigu dengan variabel", () => {
    expect(source).toMatch(/coalesce\(p\.trial_days, 5\)/);
    expect(source).toMatch(/from public\.packages p/);
    expect(source).not.toMatch(/coalesce\(trial_days, 5\)/);
  });

  it("variabel lokal tidak lagi bernama trial_days", () => {
    expect(source).toMatch(/trial_length integer/);
    expect(source).toMatch(/make_interval\(days => trial_length\)/);
  });

  it("tetap membuat subscription trial untuk organization baru", () => {
    expect(source).toMatch(/insert into public\.tenant_subscriptions/);
    expect(source).toMatch(/new\.id/);
    expect(source).toMatch(/on conflict \(organization_id\) do nothing/);
  });
});
