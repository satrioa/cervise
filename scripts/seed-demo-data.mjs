/**
 * Seed data demo untuk satu tenant.
 *
 * Dipakai karena seluruh halaman operasional yang sudah dibersihkan dari data
 * dummy sekarang menampilkan keadaan kosong yang jujur - tapi itu tidak
 * berarti halaman itu bisa dinilai, dan laporan/dashboard yang kosong
 * tidak bisa dicek perhitungannya.
 *
 * Sifat penting:
 *   - Idempoten. Dijalankan dua kali tidak menggandakan data; baris yang sudah
 *     ada dicocokkan lewat kunci alaminya (nomor HP, SKU, nama tag, dll).
 *   - Reversible. Id yang dibuat disimpan ke supabase/.seed-ids.json dan
 *     `./scripts/seed-demo-data.mjs clean` menghapusnya kembali.
 *   - Tidak menyentuh tabel auth. Hanya baris operasional.
 *
 * Batasan yang diketahui:
 *   - next_service_number() akan melempar error di bawah service_role karena
 *     memeriksa auth.uid(), jadi service_number ditulis langsung di sini.
 *   - cervise_service_spareparts hanya bisa ditulis lewat RPC, jadi data
 *     sparepart pada servis sengaja tidak diisi.
 *   - Paket trial punya branch_limit = 1, jadi tidak ada cabang tambahan.
 *
 * Pakai:  node scripts/seed-demo-data.mjs [slug-tenant]
 *         node scripts/seed-demo-data.mjs clean [slug-tenant]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(import.meta.dirname, "..");
const IDS_FILE = resolve(ROOT, "supabase", ".seed-ids.json");

function loadEnv() {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) {
    throw new Error(".env.local tidak ditemukan. Jalankan dari root repo.");
  }
  const env = {};
  for (const line of readFileSync(path, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const mode = process.argv[2] === "clean" ? "clean" : "seed";
const targetSlug = process.argv[2] === "clean" ? process.argv[3] : process.argv[2];

// ---------------------------------------------------------------- helpers

const created = { customers: [], services: [], products: [], sales: [], salesItems: [], financeTx: [] };

function must(result, what) {
  if (result.error) {
    throw new Error(`${what}: ${result.error.message}${result.error.hint ? ` (${result.error.hint})` : ""}`);
  }
  return result.data;
}

async function insert(table, row) {
  return must(await supabase.from(table).insert(row).select().single(), `insert ${table}`);
}

/** daysAgo(3) -> ISO string 3 hari lalu, supaya laporan harian/bulanan punya isi. */
function daysAgo(days, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function serviceNumber(index) {
  return `SRV-2026-${String(index).padStart(4, "0")}`;
}

function saleNumber(index) {
  return `SLV-2026-${String(index).padStart(4, "0")}`;
}

// ---------------------------------------------------------------- data

const CUSTOMERS = [
  { name: "Bagus Prasetyo", phone: "081234560101", address: "Jl. Melati No. 12, Klaten" },
  { name: "Siti Rahmawati", phone: "081234560102", address: "Jl. Kenanga No. 4, Klaten" },
  { name: "Dimas Anggara", phone: "081234560103", address: "Jl. Mawar No. 88, Karanganyar" },
  { name: "Rina Kusuma", phone: "081234560104", address: "Jl. Anggrek No. 21, Klaten" },
  { name: "Fajar Nugroho", phone: "081234560105", address: "Jl. Flamboyan No. 7, Sukoharjo" },
  { name: "Ayu Lestari", phone: "081234560106", address: "Jl. Dahlia No. 55, Klaten" },
];

const CATEGORIES = [
  "Layar",
  "Baterai",
  "IC Board",
  "Kamera",
  "Speaker",
  "Toolbar",
];

const KELENGKAPAN = ["Charger", "Box", "SIM Tray", "Kabel Data", "Tongs", "Kartu Memori"];

const TAGS = [
  "Layar pecah",
  "Baterai drop",
  "Tidak charging",
  "Kamera rusak",
  "Speaker kecil",
  "Panas overheating",
  "Liquid damage",
  "Tombol power mati",
];

const PRODUCTS = [
  { sku: "SCR-IPC11", name: "LCD iPhone 11 Incell", category: "Layar", cost: 320000, price: 650000, stock: 4 },
  { sku: "SCR-IPC12", name: "LCD iPhone 12 OLED", category: "Layar", cost: 780000, price: 1250000, stock: 2 },
  { sku: "BAT-IPC11", name: "Baterai iPhone 11", category: "Baterai", cost: 180000, price: 350000, stock: 7 },
  { sku: "BAT-SAM23", name: "Baterai Samsung S23", category: "Baterai", cost: 220000, price: 425000, stock: 3 },
  { sku: "SPK-AND1", name: "Speaker Pluslouder Android", category: "Speaker", cost: 45000, price: 120000, stock: 12 },
  { sku: "IC-VIB-M11", name: "IC Vibrator iPhone 11", category: "IC Board", cost: 85000, price: 185000, stock: 5 },
];

// Tanggal servis disebar beberapa minggu supaya grafik dashboard dan laporan
const SERVICES = [
  { c: 0, device: "iPhone 11", merk: "Apple", tipe: "iPhone 11", complaint: "Layar retak setelah jatuh", status: "Sudah Diambil", price: 650000, teknisi: 0, tags: ["Layar pecah"], kelengkapan: ["Charger", "Box"], days: 52, garansi: 30 },
  { c: 1, device: "Samsung Galaxy S23", merk: "Samsung", tipe: "Galaxy S23", complaint: "Baterai cepat habis", status: "Sudah Diambil", price: 425000, teknisi: 0, tags: ["Baterai drop"], kelengkapan: ["Charger", "SIM Tray"], days: 47, garansi: 30 },
  { c: 2, device: "Xiaomi Redmi Note 12", merk: "Xiaomi", tipe: "Redmi Note 12", complaint: "Tidak bisa charge", status: "Selesai", price: 120000, teknisi: 0, tags: ["Tidak charging"], kelengkapan: ["Charger"], days: 41, garansi: 14 },
  { c: 3, device: "iPhone 12", merk: "Apple", tipe: "iPhone 12", complaint: "Kamera depan blur", status: "Selesai", price: 250000, teknisi: 0, tags: ["Kamera rusak"], kelengkapan: ["Box", "Kabel Data"], days: 35, garansi: 30 },
  { c: 4, device: "Oppo A57", merk: "Oppo", tipe: "A57", complaint: "Speaker suara kecil", status: "Dikerjakan", price: 120000, teknisi: 0, tags: ["Speaker kecil"], kelengkapan: ["SIM Tray"], days: 6, garansi: 14 },
  { c: 5, device: "iPhone 13", merk: "Apple", tipe: "iPhone 13", complaint: "Panas berlebihan saat main game", status: "Diagnosa", price: 0, teknisi: 0, tags: ["Panas overheating"], kelengkapan: ["Charger", "Box"], days: 3, garansi: null },
  { c: 0, device: "Realme C55", merk: "Realme", tipe: "C55", complaint: "Kena air, tidak mau nyala", status: "Menunggu Konfirmasi", price: 350000, teknisi: 0, tags: ["Liquid damage"], kelengkapan: ["Tongs"], days: 2, garansi: null },
  { c: 2, device: "Vivo Y36", merk: "Vivo", tipe: "Y36", complaint: "Tombol power tidak merespons", status: "Masuk", price: 0, teknisi: null, tags: ["Tombol power mati"], kelengkapan: [], days: 1, garansi: null },
  { c: 3, device: "iPhone 11", merk: "Apple", tipe: "iPhone 11", complaint: "Layar pecah", status: "Menunggu Sparepart", price: 650000, teknisi: 0, tags: ["Layar pecah"], kelengkapan: ["Charger", "Box", "SIM Tray"], days: 8, garansi: 30 },
  { c: 4, device: "Samsung Galaxy A24", merk: "Samsung", tipe: "Galaxy A24", complaint: "Baterai swollen / kembung", status: "Batal", price: 0, teknisi: 0, tags: ["Baterai drop"], kelengkapan: ["Charger"], days: 15, garansi: null },
  { c: 5, device: "iPhone 12", merk: "Apple", tipe: "iPhone 12", complaint: "Speaker kecil saat telepon", status: "Sudah Diambil", price: 120000, teknisi: 0, tags: ["Speaker kecil"], kelengkapan: ["Kabel Data"], days: 25, garansi: 14 },
  { c: 1, device: "Xiaomi Redmi 13C", merk: "Xiaomi", tipe: "Redmi 13C", complaint: "Port charge longgar", status: "Masuk", price: 0, teknisi: null, tags: ["Tidak charging"], kelengkapan: [], days: 0, garansi: null },
];

const SALES = [
  {
    c: 0, days: 50, discount: 50000, paidFull: true,
    items: [
      { sku: "SCR-IPC11", qty: 1 },
      { sku: "BAT-IPC11", qty: 1 },
    ],
  },
  {
    c: 2, days: 30, discount: 0, paidFull: false,
    items: [
      { sku: "SCR-IPC12", qty: 1 },
      { sku: "SPK-AND1", qty: 2 },
    ],
  },
];

const EXPENSES = [
  { days: 45, amount: 350000, description: "Beli IC vibrator stok", metode: "Transfer" },
  { days: 20, amount: 150000, description: "Alat soldering Replacement", metode: "Tunai" },
  { days: 8, amount: 200000, description: "Sewa kios depan", metode: "Tunai" },
];

// ---------------------------------------------------------------- main

async function resolveTarget() {
  let orgQuery = supabase.from("organizations").select("id,name,slug").limit(20);
  const orgs = must(await orgQuery, "baca organizations");
  const org = targetSlug ? orgs.find((o) => o.slug === targetSlug) : orgs.find((o) => o.slug === "servisin");
  if (!org) {
    throw new Error(
      `Tenant "${targetSlug ?? "servisin"}" tidak ditemukan. Yang ada: ${orgs.map((o) => o.slug).join(", ")}`,
    );
  }
  const branch = must(
    await supabase.from("branches").select("id,name").eq("organization_id", org.id).eq("is_active", true).limit(1).single(),
    "baca branches",
  );
  const employee = must(
    await supabase.from("employees").select("profile_id,role").eq("organization_id", org.id).limit(1).single(),
    "baca employees",
  );
  return { org, branch, actorProfileId: employee.profile_id, actorRole: employee.role };
}

async function seed() {
  const { org, branch, actorProfileId, actorRole } = await resolveTarget();
  console.log(`Tenant   : ${org.name} (${org.slug})`);
  console.log(`Cabang   : ${branch.name}`);
  console.log(`Aktor    : ${actorProfileId} / ${actorRole}\n`);

  // 1. Kategori, kelengkapan, tag kerusakan
  for (const name of CATEGORIES) {
    const existing = must(
      await supabase.from("cervise_sparepart_categories").select("id").eq("branch_id", branch.id).eq("name", name).maybeSingle(),
      "cek kategori",
    );
    if (!existing) await insert("cervise_sparepart_categories", { branch_id: branch.id, name });
  }
  for (const name of KELENGKAPAN) {
    const existing = must(
      await supabase.from("cervise_kelengkapan_options").select("id").eq("branch_id", branch.id).eq("name", name).maybeSingle(),
      "cek kelengkapan",
    );
    if (!existing) await insert("cervise_kelengkapan_options", { branch_id: branch.id, name });
  }
  for (const name of TAGS) {
    const existing = must(
      await supabase.from("cervise_service_tags").select("id").eq("branch_id", branch.id).eq("name", name).maybeSingle(),
      "cek tag",
    );
    // usage_count dikelola kode aplikasi (bukan trigger), jadi di sini harus
    // diisi eksplisit - kalau tidak, semua tag akan tampil dengan angka 0.
    if (!existing) await insert("cervise_service_tags", { branch_id: branch.id, name, usage_count: 0 });
  }
  console.log(`Kategori / kelengkapan / tag: siap (${CATEGORIES.length} / ${KELENGKAPAN.length} / ${TAGS.length})`);

  // 2. Produk
  for (const p of PRODUCTS) {
    const existing = must(
      await supabase.from("cervise_products").select("id").eq("branch_id", branch.id).eq("sku", p.sku).maybeSingle(),
      "cek produk",
    );
    if (existing) {
      created.products.push(existing.id);
      continue;
    }
    const row = await insert("cervise_products", {
      organization_id: org.id,
      branch_id: branch.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      cost: p.cost,
      price: p.price,
      stock_qty: p.stock,
      is_active: true,
    });
    created.products.push(row.id);
  }
  console.log(`Produk   : ${PRODUCTS.length} (${created.products.length} total di cabang)`);

  // 3. Customer
  const customerIds = [];
  for (const c of CUSTOMERS) {
    const existing = must(
      await supabase.from("cervise_customers").select("id").eq("branch_id", branch.id).eq("phone", c.phone).maybeSingle(),
      "cek customer",
    );
    if (existing) {
      customerIds.push(existing.id);
      created.customers.push(existing.id);
      continue;
    }
    const row = await insert("cervise_customers", {
      branch_id: branch.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      tags: [],
      created_at: daysAgo(60),
    });
    customerIds.push(row.id);
    created.customers.push(row.id);
  }
  console.log(`Customer : ${customerIds.length}`);

  // 4. Servis
  let serviceIndex = 1;
  const serviceIds = [];
  for (const s of SERVICES) {
    const existing = must(
      await supabase.from("cervise_services").select("id").eq("branch_id", branch.id).eq("device", s.device).eq("complaint", s.complaint).maybeSingle(),
      "cek servis",
    );
    if (existing) {
      serviceIds.push({ id: existing.id, price: existing.price, status: existing.status });
      continue;
    }
    const createdAt = daysAgo(s.days, 9 + (s.days % 8), 15);
    // service_number diisi langsung: RPC next_service_number() menolak
    // service_role karena memeriksa auth.uid().
    const row = await insert("cervise_services", {
      branch_id: branch.id,
      customer_id: customerIds[s.c],
      device: s.device,
      merk: s.merk,
      tipe: s.tipe,
      complaint: s.complaint,
      status: s.status,
      teknisi_id: s.teknisi === null ? null : actorProfileId,
      price: s.price,
      kerusakan: s.tags,
      kelengkapan: s.kelengkapan,
      garansi_value: s.garansi,
      garansi_unit: s.garansi ? "hari" : null,
      garansi_until: s.garansi ? daysAgo(s.days - s.garansi) : null,
      service_number: serviceNumber(serviceIndex),
      created_by: actorProfileId,
      created_at: createdAt,
      updated_at: createdAt,
    });
    serviceIds.push({ id: row.id, price: row.price, status: row.status });
    created.services.push(row.id);
    serviceIndex += 1;
  }
  console.log(`Servis   : ${serviceIds.length}`);

  // usage_count dihitung ulang dari servis yang benar-benar memakai tag.
  for (const name of TAGS) {
    const used = SERVICES.filter((s) => s.tags.includes(name)).length;
    must(
      await supabase.from("cervise_service_tags").update({ usage_count: used }).eq("branch_id", branch.id).eq("name", name),
      "update usage_count",
    );
  }

  // 5. Penjualan + item
  const productRows = must(
    await supabase.from("cervise_products").select("id,sku,name,category,cost,price").eq("branch_id", branch.id),
    "baca produk untuk item",
  );
  const productBySku = new Map(productRows.map((p) => [p.sku, p]));

  let saleIndex = 1;
  for (const sale of SALES) {
    const number = saleNumber(saleIndex);
    const existing = must(
      await supabase.from("cervise_sales").select("id").eq("sale_number", number).maybeSingle(),
      "cek penjualan",
    );
    if (existing) {
      created.sales.push(existing.id);
      saleIndex += 1;
      continue;
    }
    const lines = sale.items
      .map((item) => {
        const product = productBySku.get(item.sku);
        if (!product) throw new Error(`SKU ${item.sku} tidak ditemukan di cabang ini`);
        const lineTotal = product.price * item.qty;
        return { product, qty: item.qty, lineTotal, cost: product.cost };
      });
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const total = subtotal - sale.discount;
    const paid = sale.paidFull ? total : Math.floor(total / 2);

    const saleRow = await insert("cervise_sales", {
      branch_id: branch.id,
      customer_id: customerIds[sale.c],
      sale_number: number,
      subtotal,
      discount_total: sale.discount,
      total,
      paid,
      payment_status: sale.paidFull ? "lunas" : "dp",
      payment_method: sale.paidFull ? "Transfer" : "Tunai",
      status: "selesai",
      kas_date: daysAgo(sale.days).slice(0, 10),
      created_by: actorProfileId,
      created_at: daysAgo(sale.days, 14),
      updated_at: daysAgo(sale.days, 14),
    });
    created.sales.push(saleRow.id);

    for (const line of lines) {
      const item = await insert("cervise_sales_items", {
        sale_id: saleRow.id,
        product_id: line.product.id,
        sku: line.product.sku,
        name: line.product.name,
        category: line.product.category,
        qty: line.qty,
        cost: line.cost,
        unit_price: line.product.price,
        line_total: line.lineTotal,
        is_serialized: false,
        created_at: daysAgo(sale.days, 14),
      });
      created.salesItems.push(item.id);
    }
    saleIndex += 1;
  }
  console.log(`Penjualan: ${SALES.length}`);

  // 6. Arus kas. finance_tx adalah tabel dasar; cervise_finance_tx hanya view
  //    baca saja, jadi penulisan harus ke finance_tx.
  const incomeServices = serviceIds.filter((s) => s.status === "Sudah Diambil" && s.price > 0);
  for (const s of incomeServices) {
    const description = `Pembayaran servis ${s.id.slice(0, 8)}`;
    const existing = must(
      await supabase.from("finance_tx").select("id").eq("branch_id", branch.id).eq("servis_id", s.id).maybeSingle(),
      "cek pemasukan",
    );
    if (existing) {
      created.financeTx.push(existing.id);
      continue;
    }
    const row = await insert("finance_tx", {
      branch_id: branch.id,
      servis_id: s.id,
      type: "pemasukan",
      amount: s.price,
      metode: "Tunai",
      description,
      kas_date: daysAgo(30).slice(0, 10),
      created_by: actorProfileId,
      created_at: daysAgo(30, 16),
    });
    created.financeTx.push(row.id);
  }
  for (const e of EXPENSES) {
    const existing = must(
      await supabase.from("finance_tx").select("id").eq("branch_id", branch.id).eq("description", e.description).maybeSingle(),
      "cek pengeluaran",
    );
    if (existing) {
      created.financeTx.push(existing.id);
      continue;
    }
    const row = await insert("finance_tx", {
      branch_id: branch.id,
      type: "pengeluaran",
      amount: e.amount,
      metode: e.metode,
      description: e.description,
      kas_date: daysAgo(e.days).slice(0, 10),
      created_by: actorProfileId,
      created_at: daysAgo(e.days, 11),
    });
    created.financeTx.push(row.id);
  }
  console.log(`Arus kas : ${incomeServices.length} pemasukan + ${EXPENSES.length} pengeluaran`);

  writeFileSync(IDS_FILE, JSON.stringify(created, null, 2));
  console.log(`\nId tersimpan di ${IDS_FILE.replace(ROOT, ".")}`);
  console.log("Bersihkan dengan: node scripts/seed-demo-data.mjs clean");
}

async function clean() {
  if (!existsSync(IDS_FILE)) {
    console.log("Tidak ada .seed-ids.json, tidak ada yang dibersihkan.");
    return;
  }
  const ids = JSON.parse(readFileSync(IDS_FILE, "utf8"));

  // Urutan dibalik sesuai ketergantungan foreign key.
  for (const [table, key] of [
    ["cervise_sales_items", "salesItems"],
    ["cervise_sales", "sales"],
    ["finance_tx", "financeTx"],
    ["cervise_services", "services"],
    ["cervise_customers", "customers"],
    ["cervise_products", "products"],
  ]) {
    const values = ids[key] ?? [];
    if (values.length === 0) continue;
    const { error } = await supabase.from(table).delete().in("id", values);
    console.log(`${table}: ${error ? `GAGAL ${error.message}` : `${values.length} dihapus`}`);
  }
  console.log("Kategori / kelengkapan / tag sengaja tidak dihapus - dipakai fitur lain.");
  writeFileSync(IDS_FILE, "null");
}

if (mode === "clean") {
  await clean();
} else {
  await seed();
}
