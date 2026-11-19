import { requireMenu } from "@/lib/auth/require-menu";
import { wibDate } from "@/lib/attendance/status";
import { RekapClient } from "./rekap-client";
import { getAttendanceRekap } from "./actions";

export default async function LaporanAbsensiPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; cabang?: string; status?: string }>;
}) {
  await requireMenu("laporan_absensi");
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "")
    ? params.month!
    : wibDate(new Date()).slice(0, 7);
  const data = await getAttendanceRekap(month, params.cabang ?? null, params.status ?? null);
  return (
    <RekapClient
      month={month}
      cabang={params.cabang ?? ""}
      status={params.status ?? ""}
      {...data}
    />
  );
}
