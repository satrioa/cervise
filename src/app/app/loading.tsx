import { Skeleton } from "@/components/ui/skeleton";
import { ChartSkeleton } from "@/components/ui/skeleton-shapes";

/**
 * Fallback route `/app/*` selama server menyiapkan data.
 *
 * Menggantikan spinner: kerangka ASCII Dither langsung terlihat (server-rendered,
 * tanpa JS) dan bentuknya meniru halaman standar — judul, empat kartu statistik,
 * lalu satu panel besar. Shell (header/sidebar/bottom bar) tetap dari layout,
 * jadi tidak ikut berkedip.
 *
 * Route yang punya bentuk datanya sendiri punya `loading.tsx` sendiri yang
 * lebih akurat (tabel, grafik, daftar). File ini hanya menutup route yang
 * belum punya bentuk khusus.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Memuat halaman"
      className="mx-auto w-full max-w-[1600px] px-4 py-4 lg:px-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-5" style={{ width: "11rem", maxWidth: "100%" }} />
        <Skeleton className="h-5" style={{ width: "6rem", maxWidth: "100%" }} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((seed) => (
          <div key={seed} className="rounded-2xl border border-border/60 bg-card p-4">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-2.5 h-7 w-28" />
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-border/60 bg-card p-4">
        <div className="h-56 w-full">
          <ChartSkeleton shape="naik" />
        </div>
      </div>

      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
