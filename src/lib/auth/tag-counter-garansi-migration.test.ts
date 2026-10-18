import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  "supabase/migrations/20261018092000_tag_counter_garansi_pickup.sql",
  "utf8",
);

function functionBody(name: string): string {
  const start = SQL.indexOf(`create or replace function public.${name}(`);
  expect(start, `${name} harus ada di migration`).toBeGreaterThanOrEqual(0);
  const end = SQL.indexOf("\n$$;", start);
  return SQL.slice(start, end === -1 ? undefined : end);
}

describe("bump_service_tag_usage", () => {
  it("adalah security definer dengan search_path terkunci", () => {
    const body = functionBody("bump_service_tag_usage");
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = public");
  });

  it("menambah counter sebagai operasi database, bukan baca-sulis", () => {
    //-IN-A-RI: tanpa `on conflict`, dua pemanggil bersamaan membuat dua baris
    // dan statisticanya salah. Tanpa `greatest`, delta negatif bisa membuat
    // counter negatif, yang tidak punya arti.
    expect(SQL).toContain("on conflict (branch_id, lower(name)) do update");
    expect(SQL).toContain("usage_count = greatest(public.cervise_service_tags.usage_count + p_delta, 0)");
  });

  it("hanya boleh dipanggil untuk branch yang diizinkan", () => {
    expect(SQL).toContain("public.can_access_tenant_branch(p_branch_id)");
    expect(SQL).toContain("grant execute on function public.bump_service_tag_usage(uuid, text, integer) to authenticated");
    expect(SQL).toContain("revoke all on function public.bump_service_tag_usage(uuid, text, integer) from public, anon");
  });

  // INI: nama tag sudah punya UNIQUE (branch_id, name) yang case-SENSITIVE.
  // Tanpa index lower(), `on conflict (branch_id, lower(name))` tidak punya
  // index yang cocok dan Postgres menolaknya.
  it("index unik untuk pencocokan nama yang tidak membedakan huruf besar-kecil", () => {
    expect(SQL).toContain("create unique index if not exists cervise_service_tags_branch_name_lower_key");
    expect(SQL).toContain("on public.cervise_service_tags (branch_id, lower(name))");
  });
});

describe("set_service_status", () => {
  it("mengisi garansi_until dari garansi_value saat diambil", () => {
    const body = functionBody("set_service_status");
    expect(body).toContain("garansi_until");
    expect(body).toContain("garansi_value");
    expect(body).toContain("garansi_unit");
  });

  it("hanya menghitung ulang saat statusnya Sudah Diambil", () => {
    //-IN-A-RI: perubahan status lain (Dikerjakan, Selesai) tidak boleh
    // menggeser garansi yang sudah dihitung.
    const body = functionBody("set_service_status");
    expect(body).toContain("when p_status <> 'Sudah Diambil' then v_service.garansi_until");
  });

  it("memakai satuan yang ada di baris, bukan angka tetap", () => {
    const body = functionBody("set_service_status");
    expect(body).toContain("when 'tahun'");
    expect(body).toContain("when 'bulan'");
    expect(body).toContain("make_interval");
  });

  it("mempertahankan semua pemeriksaan role dan sparepart yang sudah ada", () => {
    const body = functionBody("set_service_status");
    expect(body).toContain("public.caller_branch_role(v_service.branch_id)");
    expect(body).toContain("role tidak diizinkan mengubah status");
    expect(body).toContain("status tidak dikenal");
    expect(body).toContain("servis masih punya sparepart terpakai");
  });

  it("tetap punya grant dan revoke yang sama seperti sebelumnya", () => {
    expect(SQL).toContain("grant execute on function public.set_service_status(uuid, text, text) to authenticated");
    expect(SQL).toContain("revoke all on function public.set_service_status(uuid, text, text) from public, anon");
  });
});

describe("search_service_tags", () => {
  it("mencocokkan pola secara literal, bukan wildcard dari user", () => {
    // INI: dengan `.ilike('%' || term || '%')` tanpa ESCAPE, mengetik `%`
    // menarik seluruh katalog tag cabang.
    expect(SQL).toContain("escape '\\'");
    expect(SQL).toContain("replace(replace(replace(trim(p_term), '\\', '\\\\'), '%', '\\%'), '_', '\\_')");
  });

  it("dibatasi cabang dan jumlah baris", () => {
    expect(SQL).toContain("public.can_access_tenant_branch(t.branch_id)");
    expect(SQL).toContain("limit least(greatest(coalesce(p_limit, 10), 1), 50)");
  });

  it("hanya untuk authenticated", () => {
    expect(SQL).toContain("grant execute on function public.search_service_tags(uuid, text, integer) to authenticated");
    expect(SQL).toContain("revoke all on function public.search_service_tags(uuid, text, integer) from public, anon");
  });
});