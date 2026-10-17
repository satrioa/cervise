import { StarIcon } from "lucide-react";
import type { Testimonial } from "@/lib/public/testimonial";

/**
 * Carousel testimoni.
 *
 * Kalau tenant belum punya testimoni aktif, section ini tidak dirender sama
 * sekali - lebih baik tidak ada daripada kartu kosong yang terlihat seperti
 * halaman yang gagal memuat.
 */
export function TestimonialsCarousel({ items }: { items: Testimonial[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      <h2 className="text-center font-heading text-xl font-bold">Testimoni</h2>

      <div className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <figure
            key={item.id}
            className="w-[min(78vw,17rem)] shrink-0 snap-start rounded-2xl border border-border/60 bg-card p-4 shadow-xs/5"
          >
            {item.rating !== null ? (
              <div className="flex gap-0.5" aria-label={`${item.rating} dari 5 bintang`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <StarIcon
                    key={i}
                    aria-hidden
                    className={
                      i < item.rating!
                        ? "size-3.5 fill-primary text-primary"
                        : "size-3.5 text-muted-foreground/40"
                    }
                  />
                ))}
              </div>
            ) : null}
            <blockquote className="mt-2 text-[length:var(--lacak-text-body)] leading-relaxed text-foreground/90">
              {item.isi}
            </blockquote>
            <figcaption className="mt-3 text-sm font-semibold">{item.nama}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}