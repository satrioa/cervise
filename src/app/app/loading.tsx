import { AsciiSkeleton } from "@/components/ui/ascii";

/**
 * Fallback route `/app/*` selama server menyiapkan data.
 *
 * Menggantikan spinner: kerangka ASCII Dither langsung terlihat (server-rendered,
 * tanpa JS) dan bentuknya meniru halaman standar — judul, empat kartu statistik,
 * lalu satu panel besar. Shell (header/sidebar/bottom bar) tetap dari layout,
 * jadi tidak ikut berkedip.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Memuat halaman"
      className="mx-auto w-full max-w-[1600px] px-4 py-4 lg:px-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <AsciiSkeleton lines={1} widths={["11rem"]} className="text-sm" />
        <AsciiSkeleton lines={1} widths={["6rem"]} className="text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((seed) => (
          <div key={seed} className="rounded-2xl border border-border/60 bg-card p-4">
            <AsciiSkeleton lines={2} widths={["52%", "78%"]} seed={seed} />
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-border/60 bg-card p-4">
        <AsciiSkeleton
          lines={8}
          seed={9}
          widths={["100%", "94%", "88%", "97%", "72%", "91%", "100%", "64%"]}
        />
      </div>

      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
