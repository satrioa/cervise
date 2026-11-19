"use server";

import { requireMenu } from "@/lib/auth/require-menu";
import { toRekapRow, type RekapRow } from "./rekap";

export type RekapSummary = {
  employeeId: string;
  nama: string;
  hadir: number;
  terlambat: number;
  pulangAwal: number;
  belumPulang: number;
};

export async function getAttendanceRekap(
  month: string,
  branchId: string | null,
  status: string | null,
): Promise<{ rows: RekapRow[]; summary: RekapSummary[]; branches: { id: string; name: string }[] }> {
  const actor = await requireMenu("laporan_absensi");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Bulan tidak valid");
  const from = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const to = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);

  let query = actor.supabase
    .from("attendance_rekap")
    .select(
      "id,attendance_date,employee_id,branch_id,check_in_at,check_out_at,check_in_selfie_path,check_out_lat,check_out_lng,note,full_name,branch_name,check_in_time,check_out_time",
    )
    .eq("organization_id", actor.orgId)
    .gte("attendance_date", from)
    .lte("attendance_date", to)
    .order("attendance_date", { ascending: false });
  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rawRows = (data ?? []) as Parameters<typeof toRekapRow>[0][];
  const rows: RekapRow[] = rawRows.map((row) => toRekapRow(row));
  const filtered = status ? rows.filter((row) => row.status === status) : rows;

  const summary = new Map<string, RekapSummary>();
  for (const row of rows) {
    const current = summary.get(row.nama) ?? {
      employeeId: row.nama,
      nama: row.nama,
      hadir: 0,
      terlambat: 0,
      pulangAwal: 0,
      belumPulang: 0,
    };
    if (row.status === "HADIR") current.hadir++;
    if (row.status === "TERLAMBAT") current.terlambat++;
    if (row.status === "PULANG_AWAL") current.pulangAwal++;
    if (row.status === "BELUM_PULANG") current.belumPulang++;
    summary.set(row.nama, current);
  }

  const { data: branches } = await actor.supabase
    .from("branches")
    .select("id,name")
    .eq("organization_id", actor.orgId)
    .order("name");
  return { rows: filtered, summary: [...summary.values()], branches: branches ?? [] };
}
