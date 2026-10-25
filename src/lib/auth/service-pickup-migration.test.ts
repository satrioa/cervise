import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261024120000_service_pickup_signature.sql"),
  "utf8",
);

function normalize(source: string) {
  return source.replace(/\s+/g, " ").toLowerCase();
}

const flat = normalize(sql);

describe("service pickup signature migration", () => {
  it("adds the signature and pickup time columns", () => {
    expect(flat).toContain("add column if not exists pickup_signature text");
    expect(flat).toContain("add column if not exists picked_up_at timestamptz");
  });

  it("delegates the status change to set_service_status", () => {
    // Satu sumber untuk role check, garansi, completed_at, dan log timeline.
    // Wrapper tidak menyalin badan fungsi, jadi perbaikan di set_service_status
    // otomatis ikut di sini.
    expect(flat).toMatch(
      /create or replace function public\.set_service_picked_up\(\s*p_servis_id uuid, p_signature text, p_note text default null\s*\)/,
    );
    expect(flat).toContain("perform public.set_service_status(p_servis_id, 'sudah diambil', p_note)");
  });

  it("refuses an empty or non-svg signature", () => {
    expect(flat).toContain("raise exception 'tanda tangan wajib'");
    expect(flat).toContain("raise exception 'tanda tangan tidak valid'");
    expect(flat).toContain("raise exception 'tanda tangan terlalu besar'");
    expect(flat).toContain("left(trim(p_signature), 5) <> '<svg '");
  });

  it("keeps the first pickup time when the signature is replaced", () => {
    expect(flat).toContain("picked_up_at = coalesce(v_service.picked_up_at, now())");
  });

  it("grants the rpc to authenticated and locks out anon", () => {
    const fn = "public.set_service_picked_up(uuid, text, text)";
    expect(flat).toContain(`grant execute on function ${fn} to authenticated`);
    expect(flat).toContain(`revoke all on function ${fn} from anon`);
    expect(flat).toContain(`revoke all on function ${fn} from public`);
  });
});
