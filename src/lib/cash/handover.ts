import type { SupabaseClient } from "@supabase/supabase-js";

export const PENDING_HANDOVER_MESSAGE =
  "Shift ini sedang menunggu dilanjutkan. Buka Laporan Shift, lalu lanjutkan atau tutup shift sebelum mencatat transaksi.";

/**
 * Blokir transaksi uang saat serah terima sedang menunggu.
 *
 * Dua query polos (bukan embed PostgREST): cari sesi terbuka cabang, lalu cek
 * handover tertunda milik sesi itu. Handover hanya dibaca kalau sesinya masih
 * terbuka, jadi baris handover yang tertinggal pada sesi tertutup tidak akan
 * memblokir transaksi selamanya.
 */
export async function getPendingHandoverBlockMessage(
  supabase: SupabaseClient,
  branchId: string,
): Promise<string | null> {
  const { data: session, error: sessionError } = await supabase
    .from("cervise_cash_sessions")
    .select("id")
    .eq("branch_id", branchId)
    .is("closed_at", null)
    .order("open_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) return null;

  const { data: handover, error: handoverError } = await supabase
    .from("cervise_cash_session_handovers")
    .select("id")
    .eq("session_id", session.id)
    .is("resumed_at", null)
    .limit(1)
    .maybeSingle();
  if (handoverError) throw new Error(handoverError.message);
  return handover ? PENDING_HANDOVER_MESSAGE : null;
}
