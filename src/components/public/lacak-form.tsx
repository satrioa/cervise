import type { PublicTenant } from "@/lib/public/landing";
import { ServisResultCard } from "@/components/public/servis-result-card";
import type { PublicServisResult } from "@/lib/public/lookup";

/**
 * Halaman Lacak tanpa form: kode hanya ada di URL (`/{slug}/lacak/{kode}`) yang
 * dibuka dari QR di struk, jadi hasil lookup dikirim dari server page.
 */
export function LacakForm({
  initialResult,
  initialError,
}: {
  tenant: PublicTenant;
  initialCode?: string;
  /** Hasil lookup dari server page; null kalau belum ada atau gagal. */
  initialResult?: PublicServisResult | null;
  initialError?: string | null;
  /** Pratinjau di halaman Tampilan: form tetap tampil, tapi tidak memanggil API. */
  preview?: boolean;
}) {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="rounded-2xl border bg-card p-[var(--lacak-pad-card)] shadow-xs/5">
        <div className="space-y-[var(--lacak-gap)]">
          <div className="text-center">
            <h2 className="font-heading text-[length:var(--lacak-text-title)] font-bold tracking-tight">
              Lacak Progres Servis
            </h2>
            <p className="mt-1 text-[length:var(--lacak-text-body)] text-muted-foreground">
              Kode cek service akan otomatis diverifikasi saat struk diterbitkan.
            </p>
          </div>

          {initialError ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <span>{initialError}</span>
            </div>
          ) : null}
        </div>
      </div>

      {initialResult ? (
        <div className="mt-4">
          <ServisResultCard result={initialResult} />
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Simpan struk service Anda. Status akan otomatis tersedia saat unit diterbitkan.
      </p>
    </div>
  );
}
