import { ChartSkeleton } from "@/components/ui/skeleton-shapes";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteHeaderSkeleton } from "@/components/ui/route-skeleton";

/**
 * Kerangka route Analitik Servis.
 *
 * Mirip `CerviseAnalyticsSection`: grafik tren, lalu dua kartu breakdown
 * (Top teknisi, Top masalah), lalu kartu performa cabang.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
      <RouteHeaderSkeleton
        titleWidth="12rem"
        descriptionWidth="28rem"
        action
      />

      <section className="rounded-2xl border border-border/60 bg-card p-4 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Skeleton className="h-3 w-32" />
            <div className="mt-2 flex items-baseline gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[0, 1, 2].map((legend) => (
              <div key={legend} className="flex items-center gap-1.5">
                <Skeleton className="size-2 rounded-sm" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 h-64 w-full">
          <ChartSkeleton shape="naik" />
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1].map((card) => (
          <div key={card} className="rounded-2xl border border-border/60 bg-card p-4 lg:p-6">
            <Skeleton className="h-4 w-32" />
            <ul aria-hidden className="mt-4 flex flex-col gap-3">
              {Array.from({ length: card === 0 ? 5 : 6 }, (_, row) => (
                <li key={row} className="flex items-center gap-2">
                  {card === 0 ? (
                    <>
                      <Skeleton className="size-6 shrink-0 rounded-full" />
                      <Skeleton className="h-3 flex-1" style={{ maxWidth: `${45 + ((row * 11) % 35)}%` }} />
                      <Skeleton className="h-3 w-14 shrink-0" />
                    </>
                  ) : (
                    <>
                      <Skeleton className="h-3 flex-1" style={{ maxWidth: `${42 + ((row * 9) % 32)}%` }} />
                      <Skeleton className="h-3 w-16 shrink-0" />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-border/60 bg-card p-4 lg:p-6">
        <Skeleton className="h-4 w-36" />
        <ul aria-hidden className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, row) => (
            <li
              key={row}
              className="flex items-center gap-2.5 rounded-md border border-border/40 bg-background/40 px-3 py-2.5"
            >
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3" style={{ width: `${50 + ((row * 7) % 30)}%` }} />
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-1 flex-1 rounded-full" />
                  <Skeleton className="h-2.5 w-10 shrink-0" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
