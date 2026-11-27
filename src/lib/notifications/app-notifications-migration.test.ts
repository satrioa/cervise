import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127120000_app_notifications.sql"),
  "utf8",
);

describe("migrasi notifikasi in-app", () => {
  it("membuat dua tabel dengan RLS", () => {
    expect(sql).toContain("create table if not exists public.cervise_app_notifications");
    expect(sql).toContain("create table if not exists public.cervise_app_notification_reads");
    expect(sql).toContain("alter table public.cervise_app_notifications enable row level security");
    expect(sql).toContain("alter table public.cervise_app_notification_reads enable row level security");
  });

  it("mengikat reads ke auth.uid() dan tidak memasang trigger servis", () => {
    expect(sql).toContain("user_id = auth.uid()");
    expect(sql).not.toMatch(/create trigger[\s\S]*on public\.cervise_services/i);
  });
});
