import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127120000_central_inventory_schema.sql"),
  "utf8",
);
const flat = sql.replace(/\s+/g, " ").toLowerCase();

const migrate = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127130000_central_inventory_migrate_stock.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

const rpc = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127140000_central_inventory_rpc.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

const flows = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127150000_central_inventory_flows.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

const extend = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127160000_extend_create_central_item.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

const active = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127170000_central_item_active.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

const serialized = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127180000_serialized_branch_unique.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("central inventory schema migration", () => {
  it("membuat tabel master pusat dan antrean request", () => {
    expect(flat).toContain("create table if not exists public.cervise_central_items");
    expect(flat).toContain("create table if not exists public.cervise_stock_requests");
  });

  it("memuat kolom kunci master pusat", () => {
    expect(flat).toContain(
      "organization_id uuid not null references public.organizations(id) on delete cascade",
    );
    expect(flat).toContain("kind text not null check (kind in ('sparepart','product'))");
    expect(flat).toContain("stock_qty integer not null default 0 check (stock_qty >= 0)");
    expect(flat).toContain("imei text");
    expect(flat).toContain("parent_key text");
    for (const column of [
      "id uuid primary key",
      "sku text not null",
      "name text not null",
      "category text not null",
      "cost integer not null default 0",
      "price integer not null default 0",
      "is_active boolean not null default true",
      "is_serialized boolean not null default false",
      "barcode text",
      "variant_type text not null default 'baru'",
      "storage text",
      "warna text",
      "bh_percent integer",
      "kondisi_notes text",
      "garansi_days integer",
      "created_at timestamptz not null default now()",
      "updated_at timestamptz not null default now()",
    ]) {
      expect(flat).toContain(column);
    }
  });

  it("menjaga keunikan sku dan imei master pusat", () => {
    expect(flat).toContain("cervise_central_items_sku_key");
    expect(flat).toContain("(organization_id, kind, sku) where not is_serialized");
    expect(flat).toContain("cervise_central_items_imei_key");
    expect(flat).toContain("(organization_id, imei) where is_serialized and imei is not null");
  });

  it("mewajibkan imei pada barang serialized", () => {
    expect(flat).toContain("where is_serialized and imei is not null");
    expect(flat).toContain(
      "cervise_central_items_serialized_imei_check check (not is_serialized or imei is not null)",
    );
  });

  it("mengamankan master pusat dengan rls select", () => {
    expect(flat).toContain("array['master_admin','admin','frontliner','technician']");
    expect(flat).toContain("grant select on public.cervise_central_items to authenticated");
    expect(flat).not.toContain("grant all on public.cervise_central_items to authenticated");
    for (const write of ["insert", "update", "delete"]) {
      expect(flat).not.toContain(`grant ${write} on public.cervise_central_items to authenticated`);
    }
  });

  it("memuat kolom dan rls antrean request", () => {
    expect(flat).toContain("decided_qty integer check (decided_qty is null or decided_qty > 0)");
    expect(flat).toContain(
      "status text not null default 'pending' check (status in ('pending','approved','rejected'))",
    );
    expect(flat).toContain("rejection_reason text");
    expect(flat).toContain("array['admin','frontliner']");
    expect(flat).toContain("array['master_admin']");
    expect(flat).toContain(
      "grant select, insert, update on public.cervise_stock_requests to authenticated",
    );
  });

  it("menautkan baris cabang dan ledger ke item pusat", () => {
    expect(flat.match(/add column if not exists central_item_id uuid/g)).toHaveLength(3);
    expect(flat).toContain("is_central_side boolean not null default false");
    expect(flat).toContain(
      "request_id uuid references public.cervise_stock_requests(id) on delete set null",
    );
  });

  it("mengizinkan alasan ledger baru", () => {
    for (const reason of ["central_purchase", "distribute", "request_in", "return_to_central"]) {
      expect(flat).toContain(`'${reason}'`);
    }
  });
});

describe("central inventory stock migration", () => {
  it("mengizinkan ledger sisi-pusat tanpa produk atau sparepart", () => {
    expect(migrate).toContain("sparepart_id is not null or central_item_id is not null");
  });

  it("memindahkan stok dengan ledger, bukan update diam-diam", () => {
    expect(migrate).toContain("insert into public.cervise_central_items");
    expect(migrate).toContain("'return_to_central'");
    expect(migrate).toContain("update public.cervise_spareparts set stock_qty = 0");
    expect(migrate).toContain("update public.cervise_products set stock_qty = 0");
  });

  it("mengunci migrasi dalam satu transaksi", () => {
    expect(migrate).toContain("begin;");
    expect(migrate).toContain("commit;");
  });

  it("menolak migrasi ulang pada tabel pusat yang tidak kosong", () => {
    expect(migrate).toContain("migrasi gudang pusat hanya bisa dijalankan sekali");
  });

  it("menautkan semua unit serialized dan membatasi qty ledger", () => {
    expect(migrate).toContain("least(stock_qty, 1)");
    expect(migrate).toContain("least(p.stock_qty, 1)");
    expect(migrate).toContain("is_serialized, imei, barcode");
    expect(migrate).toContain("order by stock_qty desc on conflict");
  });
});

describe("central inventory rpc inti", () => {
  it("hanya master admin yang bisa membuat item dan membeli stok", () => {
    expect(rpc).toContain("array['master_admin'::text]");
    expect(rpc).toContain("create or replace function public.create_central_item");
    expect(rpc).toContain("create or replace function public.purchase_central_stock");
    expect(rpc).toContain(
      "public.has_tenant_role(p_organization_id, array['master_admin'::text])",
    );
    expect(
      rpc.match(
        /public\.has_tenant_role\(v_item\.organization_id, array\['master_admin'::text\]\)/g,
      ),
    ).toHaveLength(2);
  });

  it("mengamankan RPC dari anon dan memberi execute ke authenticated", () => {
    const createSig =
      "public.create_central_item(uuid, text, text, text, text, integer, integer, integer, boolean, text, text)";
    expect(rpc).toContain(`revoke all on function ${createSig} from public, anon`);
    expect(rpc).toContain(`grant execute on function ${createSig} to authenticated`);
    const updateSig = "public.update_central_item(uuid, text, text, integer, integer)";
    expect(rpc).toContain(`revoke all on function ${updateSig} from public, anon`);
    expect(rpc).toContain(`grant execute on function ${updateSig} to authenticated`);
    const purchaseSig = "public.purchase_central_stock(uuid, integer, integer, integer)";
    expect(rpc).toContain(`revoke all on function ${purchaseSig} from public, anon`);
    expect(rpc).toContain(`grant execute on function ${purchaseSig} to authenticated`);
  });

  it("memperluas whitelist alasan di kedua helper stok yang disalin", () => {
    expect(rpc).toContain("create or replace function public.apply_stock_delta(");
    expect(rpc).toContain(
      "create or replace function public.apply_sparepart_stock_delta( p_sparepart_id uuid, p_delta integer, p_expected_stock integer default null, p_reason text default 'stock_adjust', p_servis_id uuid default null, p_notes text default null )",
    );
    expect(rpc).toContain(
      "'service_use','service_return','sale','sale_return','stock_adjust'," +
        "'purchase','transfer_in','transfer_out','central_purchase','distribute'," +
        "'request_in','return_to_central'",
    );
    expect(rpc.match(/p_reason not in \('service_use'/g)).toHaveLength(2);
    expect(rpc).toContain(
      "shortcut: batas delta ±1000 per transaksi diwariskan dari helper lama",
    );
  });

  it("tidak membuat overload 5 argumen apply_sparepart_stock_delta", () => {
    expect(
      rpc.match(/create or replace function public\.apply_sparepart_stock_delta\(/g),
    ).toHaveLength(1);
    expect(rpc).not.toContain("p_servis_id uuid default null)");
    expect(rpc).toContain(
      "grant execute on function public.apply_sparepart_stock_delta(uuid, integer, integer, text, uuid, text) to authenticated",
    );
  });

  it("membatasi stok unit serialized ke satu", () => {
    expect(rpc).toContain(
      "if p_is_serialized and p_stock_qty > 1 then raise exception 'unit serialized hanya boleh satu stok'; end if;",
    );
    expect(rpc).toContain(
      "if v_item.is_serialized and v_item.stock_qty + p_qty > 1 then raise exception 'unit serialized hanya boleh satu stok'; end if;",
    );
    expect(rpc.match(/unit serialized hanya boleh satu stok/g)).toHaveLength(2);
  });

  it("menolak stok awal negatif dan cabang ledger yang tidak ada", () => {
    expect(rpc).toContain(
      "if p_stock_qty < 0 then raise exception 'stok awal tidak boleh negatif'; end if;",
    );
    expect(rpc).toContain("order by created_at, id limit 1");
    expect(rpc).toContain(
      "if v_branch is null then raise exception 'cabang tenant tidak ditemukan untuk ledger pusat'; end if;",
    );
  });
});

describe("central inventory flows rpc", () => {
  it("menolak stok pusat tidak cukup dan request ganda", () => {
    expect(flows).toContain("stok pusat tidak cukup");
    expect(flows).toContain("request sudah menunggu persetujuan");
    expect(flows).toContain("p_decided_qty, p_expected_stock, v_item.imei");
    expect(flows).toContain("cervise_stock_requests_pending_unique");
    expect(flows).toContain(
      "select organization_id into v_org from public.branches where id = p_branch_id for update",
    );
  });

  it("memilih unit IMEI saat approve serialized", () => {
    expect(flows).toContain("v_item.is_serialized");
    expect(flows).toContain("v_item.imei <> p_imei");
  });

  it("mencatat qty keputusan dan alasan penolakan", () => {
    expect(flows).toContain("decided_qty");
    expect(flows).toContain("rejection_reason");
  });
});

describe("central inventory flows acl", () => {
  it("mengamankan kelima rpc alur stok dari anon", () => {
    for (const [name, signature] of [
      ["distribute_central_stock", "uuid, uuid, integer, integer, text"],
      ["request_stock", "uuid, text, integer"],
      ["approve_stock_request", "uuid, integer, uuid, integer"],
      ["reject_stock_request", "uuid, text"],
      ["return_stock_to_central", "uuid, integer"],
    ]) {
      expect(flows).toContain(`create or replace function public.${name}`);
      expect(flows).toContain(
        `revoke all on function public.${name}(${signature}) from public, anon`,
      );
      expect(flows).toContain(
        `grant execute on function public.${name}(${signature}) to authenticated`,
      );
    }
  });

  it("mengecek role di dalam rpc", () => {
    expect(flows).toContain(
      "public.has_tenant_role(v_item.organization_id, array['master_admin'::text])",
    );
    expect(flows).toContain(
      "public.has_tenant_branch_role(v_org, p_branch_id, array['admin','frontliner']::text[])",
    );
    expect(flows).toContain(
      "public.has_tenant_role(v_req.organization_id, array['master_admin'::text])",
    );
    expect(flows).toContain("public.has_tenant_role(v_org, array['master_admin'::text])");
  });

  it("tidak mendefinisikan overload 5 argumen helper stok", () => {
    expect(flows).not.toContain("create or replace function public.apply_sparepart_stock_delta");
  });

  it("memiliki rpc tarik kembali ke pusat", () => {
    expect(flows).toContain("create or replace function public.return_stock_to_central");
  });
});

describe("extension atribut varian create_central_item", () => {
  it("menghapus overload lama dan hanya menyisakan satu definisi", () => {
    expect(extend).toContain(
      "drop function if exists public.create_central_item(uuid, text, text, text, text, integer, integer, integer, boolean, text, text)",
    );
    expect(
      extend.match(/create or replace function public\.create_central_item\(/g),
    ).toHaveLength(1);
  });

  it("menerima tujuh atribut varian sebagai parameter opsional", () => {
    for (const param of [
      "p_barcode text default null",
      "p_variant_type text default 'baru'",
      "p_storage text default null",
      "p_warna text default null",
      "p_bh_percent integer default null",
      "p_kondisi_notes text default null",
      "p_garansi_days integer default null",
    ]) {
      expect(extend).toContain(param);
    }
    expect(extend).toContain("p_variant_type not in ('baru','bekas')");
  });

  it("menyimpan atribut varian ke kolom master yang sudah ada", () => {
    expect(extend).toContain(
      "barcode, variant_type, storage, warna, bh_percent, kondisi_notes, garansi_days",
    );
    expect(extend).toContain(
      "p_barcode, p_variant_type, p_storage, p_warna, p_bh_percent, p_kondisi_notes, p_garansi_days",
    );
    expect(extend).toContain("'central_purchase'");
    expect(extend).toContain("public.apply_central_stock_delta");
  });

  it("mempertahankan acl untuk signature baru", () => {
    const signature =
      "public.create_central_item(uuid, text, text, text, text, integer, integer, integer, boolean, text, text, text, text, text, text, integer, text, integer)";
    expect(extend).toContain(`revoke all on function ${signature} from public, anon`);
    expect(extend).toContain(`grant execute on function ${signature} to authenticated`);
  });
});

describe("status aktif item pusat", () => {
  it("mendefinisikan rpc status dengan kunci master dan hak master admin", () => {
    expect(active).toContain("create or replace function public.set_central_item_active(");
    expect(active).toContain("p_central_item_id uuid, p_is_active boolean");
    expect(active).toContain(
      "select * into v_item from public.cervise_central_items where id = p_central_item_id for update",
    );
    expect(active).toContain("if not found then raise exception 'item pusat tidak ditemukan'; end if;");
    expect(active).toContain(
      "public.has_tenant_role(v_item.organization_id, array['master_admin'::text])",
    );
    expect(active).toContain(
      "update public.cervise_central_items set is_active = p_is_active, updated_at = now() where id = v_item.id",
    );
  });

  it("menyebarkan status ke baris stok cabang yang tertaut", () => {
    expect(active).toContain(
      "update public.cervise_spareparts set is_active = p_is_active, updated_at = now() where central_item_id = v_item.id",
    );
    expect(active).toContain(
      "update public.cervise_products set is_active = p_is_active, updated_at = now() where central_item_id = v_item.id",
    );
  });

  it("mengamankan rpc dari anon", () => {
    const signature = "public.set_central_item_active(uuid, boolean)";
    expect(active).toContain(`revoke all on function ${signature} from public, anon`);
    expect(active).toContain(`grant execute on function ${signature} to authenticated`);
  });
});

describe("unit serialized unik per cabang dan sinkron master", () => {
  it("menghapus constraint sku lama secara idempoten", () => {
    expect(serialized).toContain("conname = 'cervise_products_branch_id_sku_key'");
    expect(serialized).toContain(
      "and conrelid = 'public.cervise_products'::regclass",
    );
    expect(serialized).toContain(
      "alter table public.cervise_products drop constraint cervise_products_branch_id_sku_key",
    );
  });

  it("menggantinya dengan indeks parsial sku dan imei", () => {
    expect(serialized).toContain(
      "create unique index if not exists cervise_products_branch_sku_non_serial_idx on public.cervise_products(branch_id, sku) where not is_serialized",
    );
    expect(serialized).toContain(
      "create unique index if not exists cervise_products_branch_imei_idx on public.cervise_products(branch_id, imei) where imei is not null",
    );
  });

  it("mengunci baris serialized lewat imei, bukan sku", () => {
    expect(serialized).toContain(
      "on conflict (branch_id, imei) where imei is not null do update set central_item_id = excluded.central_item_id, is_active = excluded.is_active, name = excluded.name, category = excluded.category, cost = excluded.cost, price = excluded.price, updated_at = now()",
    );
    expect(serialized).toContain(
      "on conflict (branch_id, sku) where not is_serialized do update set central_item_id = excluded.central_item_id, is_active = excluded.is_active, name = excluded.name, category = excluded.category, cost = excluded.cost, price = excluded.price, updated_at = now()",
    );
    expect(serialized).toContain("if v_item.is_serialized then insert into public.cervise_products");
  });

  it("mempertahankan guard dan ledger distribusi", () => {
    expect(serialized).toContain("stok pusat tidak cukup");
    expect(serialized).toContain(
      "unit imei tidak tersedia di gudang",
    );
    expect(serialized).toContain(
      "perform public.apply_sparepart_stock_delta(v_result, p_qty, null, 'distribute', null)",
    );
    expect(serialized).toContain(
      "perform public.apply_stock_delta(v_result, p_qty, null, 'distribute', null, null, null)",
    );
    expect(serialized).toContain(
      "perform public.apply_central_stock_delta(v_item.id, -p_qty, p_expected_stock, 'distribute', p_target_branch_id, null)",
    );
  });

  it("menyebarkan perubahan master ke stok cabang", () => {
    expect(serialized).toContain(
      "update public.cervise_spareparts set name = v_item.name, category = v_item.category, cost = v_item.cost, price = v_item.price, updated_at = now() where central_item_id = v_item.id",
    );
    expect(serialized).toContain(
      "update public.cervise_products set name = v_item.name, category = v_item.category, cost = v_item.cost, price = v_item.price, updated_at = now() where central_item_id = v_item.id",
    );
    expect(serialized).toContain("returning * into v_item");
  });

  it("men-drop signature lama sebelum membuat ulang kedua rpc", () => {
    expect(serialized).toContain(
      "drop function if exists public.distribute_central_stock(uuid, uuid, integer, integer, text)",
    );
    expect(serialized).toContain(
      "drop function if exists public.update_central_item(uuid, text, text, integer, integer)",
    );
    expect(
      serialized.match(/create or replace function public\.distribute_central_stock\(/g),
    ).toHaveLength(1);
    expect(
      serialized.match(/create or replace function public\.update_central_item\(/g),
    ).toHaveLength(1);
  });

  it("mengamankan kedua rpc dari anon untuk signature yang sama", () => {
    for (const signature of [
      "public.distribute_central_stock(uuid, uuid, integer, integer, text)",
      "public.update_central_item(uuid, text, text, integer, integer)",
    ]) {
      expect(serialized).toContain(
        `revoke all on function ${signature} from public, anon`,
      );
      expect(serialized).toContain(
        `grant execute on function ${signature} to authenticated`,
      );
    }
  });
});
