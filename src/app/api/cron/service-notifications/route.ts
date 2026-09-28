import { NextResponse } from "next/server";

import { resolveAppOrigin } from "@/lib/auth/redirect-url";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { dispatchPendingNotifications } from "@/lib/notifications/dispatcher";

export const runtime = "nodejs";
// Batas keras yang sama dengan desain: 25 pesan per run dengan Fonnte yang
// lambat adalah yang menghabiskan anggaran ini, bukan pekerjaan route di sini.
export const maxDuration = 60;

const RUN_LIMIT = 25;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Outbox menyimpan metadata saja, karena isi pesan butuh origin aplikasi --
  // sesuatu yang tidak diketahui database. Jadi route yang wajib menyediakannya.
  //
  // Dipakai helper milik repo sendiri, bukan karangan sendiri: `resolveAppOrigin`
  // sudah mengurus prioritas env, `x-forwarded-*`, dan `http` untuk localhost.
  // Request dari Vercel selalu membawa header Host, jadi hasilnya benar di
  // produksi (domain publik) maupun di dev lokal (`http://localhost:3000`), dan
  // env production menimpa host preview yang bisa hilang kapan saja.
  const siteOrigin = resolveAppOrigin(
    (name) => request.headers.get(name),
    process.env.NEXT_PUBLIC_SITE_URL,
  );

  // Menolak, bukan mengirim tanpa origin. Dispatcher boleh jalan dengan origin
  // kosong -- `service-message` lalu menghapus baris "Cek status" dan tetap
  // mengirim. Hasilnya justru yang paling sulit dilihat: pelanggan menerima
  // pesan tanpa tautan, dan tidak ada yang gagal.
  //
  // Yang terjadi pada baris di antrean: TIDAK ADA yang diklaim. Kode ini
  // berhenti sebelum dispatcher dipanggil, jadi claim_service_notifications
  // tidak pernah jalan dan TIDAK ADA lease 2 menit yang terpasang. Barisnya
  // hanya duduk pending, tidak "pending di bawah lease" -- jadi jangan
  // menghitung waktu penguinsiran dari lease untuk jalur ini.
  //
  // Dan kondisi ini tidak magically hilang: kalau origin tidak bisa ditentukan
  // sekarang, besok pagi pun begitu. Tick 5 menit berikutnya akan
  // 500 lagi sampai ada yang memperbaiki konfigurasinya.
  if (!siteOrigin) {
    return NextResponse.json(
      { error: "Origin aplikasi tidak bisa ditentukan dari header request" },
      { status: 500 },
    );
  }

  try {
    const result = await dispatchPendingNotifications({ limit: RUN_LIMIT, siteOrigin });
    return NextResponse.json(result);
  } catch (error) {
    // Dispatcher melempar, bukan mengembalikan nol: nol berarti "tidak ada yang
    // perlu dikerjakan", dan jawaban 200 dengan antrean kosong persis seperti
    // yang terjadi kalau claim-nya gagal dibaca. Kegagalan di sini adalah
    // masalah sisi server, jadi 500 -- jawaban 200 akan membuat cron terlihat
    // sehat padahal tidak ada yang terkirim, dan itu cara pipa notifikasi
    // rusak bertahan berminggu-minggu tanpa ada yang melihat.
    //
    // Yang ditulis ke log adalah error aslinya. Body hanya menyebut kategori,
    // karena pesan dari Supabase bisa memuat detail koneksi dan response ini
    // dibaca siapa pun yang mengetik URL-nya.
    console.error("[cron/service-notifications] dispatch gagal:", error);
    return NextResponse.json({ error: "Notification dispatch failed" }, { status: 500 });
  }
}
