import { NextResponse } from "next/server";

import { autoCloseShifts } from "@/lib/cash/auto-close";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Dipanggil tiap jam oleh GitHub Actions. Endpoint yang menentukan apakah
 * cutoff tenant sudah lewat, jadi jam tutup buku tiap tenant bisa berbeda.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await autoCloseShifts());
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Gagal menutup shift otomatis" },
      { status: 500 },
    );
  }
}
