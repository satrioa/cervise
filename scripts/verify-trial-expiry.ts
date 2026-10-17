/**
 * Verifikasi gerbang trial berakhir terhadap database sungguhan.
 *
 * Test otomatis (`src/lib/supabase/actor-billing-gate.test.ts`) membuktikan
 * logikanya dengan stub Supabase. Test itu tidak membuktikan dua hal yang
 * paling mungkin rusak di produksi:
 *
 *   1. `trial_ends_at` benar-benar berisi tanggal yang dibaca `actor.ts`,
 *      dan tidak null untuk tenant yang sedang trial.
 *   2. Tenant yang kondisinya sudah "expired" benar-benar terkunci, dan
 *      halaman tagihannya benar-benar bisa dibuka.
 *
 * Skrip ini menutup keduanya: ia mengubah `trial_ends_at` satu tenant uji ke
 * masa lalu, memberi tahu apa yang harus dicek di browser, lalu mengembalikannya
 * seperti semula.
 *
 * Skrip hanya menyentuh `tenant_subscriptions.trial_ends_at`. Tidak mengirim
 * pesan, tidak membuat invoice, tidak mengubah langganan lain.
 *
 * CARA PAKAI (PowerShell):
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "..."   # sudah ada di .env.local
 *   $env:CERVISE_TEST_ORG_ID        = "<uuid tenant uji>"
 *
 *   npm run verify:trial            # ubah ke lampau
 *   # ... cek manual di browser ...
 *   $env:CERVISE_RESTORE_AT = "<tanggal dari output langkah pertama>"
 *   npm run verify:trial -- --restore   # kembalikan
 *
 * `--dry-run` hanya menampilkan keadaan sekarang tanpa mengubah apa pun.
 */

import { createClient } from "@supabase/supabase-js";

/** Tanggal lampau yang dipakai untuk memaksa keadaan "expired". */
const EXPIRED_AT = "2020-01-01T00:00:00.000Z";

function required(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`\n  Environment variable ${name} belum diisi.`);
    console.error(`  Contoh (PowerShell):  $env:${name} = "..."\n`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  const organizationId = required("CERVISE_TEST_ORG_ID", process.env.CERVISE_TEST_ORG_ID);
  const restoreTo = process.env.CERVISE_RESTORE_AT;

  const wantsRestore = process.argv.includes("--restore");
  const dryRun = process.argv.includes("--dry-run");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: subscription, error } = await supabase
    .from("tenant_subscriptions")
    .select("id, status, trial_ends_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error(`Gagal membaca subscription: ${error.message}`);
    process.exit(1);
  }
  if (!subscription) {
    console.error(`Tidak ada baris tenant_subscriptions untuk ${organizationId}.`);
    process.exit(1);
  }

  const current = subscription.trial_ends_at;
  const isExpiredNow = !current || new Date(current) <= new Date();

  console.log("\n  Tenant uji");
  console.log(`    organization_id : ${organizationId}`);
  console.log(`    status          : ${subscription.status}`);
  console.log(`    trial_ends_at   : ${current ?? "(null)"}`);
  console.log(`    akses app       : ${isExpiredNow ? "TERKUNCI (expired)" : "aktif"}`);

  if (wantsRestore) {
    if (!restoreTo) {
      console.error("\n  --restore butuh CERVISE_RESTORE_AT berisi tanggal ISO.");
      console.error(`  Jalankan dulu tanpa --restore untuk melihat trial_ends_at sekarang.\n`);
      process.exit(1);
    }
    if (dryRun) {
      console.log(`\n  [dry-run] Akan mengembalikan trial_ends_at ke ${restoreTo}.\n`);
      return;
    }
    const { error: restoreError } = await supabase
      .from("tenant_subscriptions")
      .update({ trial_ends_at: restoreTo })
      .eq("id", subscription.id);
    if (restoreError) {
      console.error(`Gagal mengembalikan: ${restoreError.message}\n`);
      process.exit(1);
    }
    console.log(`\n  trial_ends_at dikembalikan ke ${restoreTo}.\n`);
    return;
  }

  if (dryRun) {
    console.log("\n  [dry-run] Tidak ada yang diubah.");
    if (!isExpiredNow) {
      console.log(`  Untuk menguji, jalankan tanpa --dry-run (akan sementara diset ke ${EXPIRED_AT}).`);
    } else {
      console.log("  Tenant sudah expired. Untuk mengembalikan, jalankan dengan --restore.");
    }
    console.log("");
    return;
  }

  if (isExpiredNow) {
    console.log("\n  Tenant sudah dalam keadaan expired - tidak ada yang diubah.");
    console.log("  Untuk mengembalikan ke tanggal sebelumnya, jalankan:");
    console.log(`    $env:CERVISE_RESTORE_AT = "<tanggal>"`);
    console.log("    npm run verify:trial -- --restore\n");
    return;
  }

  const { error: updateError } = await supabase
    .from("tenant_subscriptions")
    .update({ trial_ends_at: EXPIRED_AT })
    .eq("id", subscription.id);

  if (updateError) {
    console.error(`Gagal mengubah trial_ends_at: ${updateError.message}\n`);
    process.exit(1);
  }

  console.log(`\n  trial_ends_at diubah sementara ke ${EXPIRED_AT}.`);
  console.log("\n  Cek manual di browser:");
  console.log("    1. /app            -> banner 'Masa trial Anda sudah berakhir',");
  console.log("                            dan pilihan paket tetap terlihat.");
  console.log("    2. /app/servis     -> harus ter-redirect ke halaman tagihan.");
  console.log("    3. /app/pengaturan/subscription?reason=trial-ended -> banner muncul.");
  console.log("    4. Klik 'Pilih paket' -> invoice harus dibuat (owner belum menyetujui,");
  console.log("                            jadi akses masih terkunci - itu memang begitu).");
  console.log("\n  Setelah selesai, kembalikan dengan:");
  console.log(`    $env:CERVISE_RESTORE_AT = "${current}"`);
  console.log("    npm run verify:trial -- --restore\n");
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
