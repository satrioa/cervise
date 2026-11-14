import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function Loading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="min-h-svh bg-transparent text-foreground">
      <div className="mx-auto max-w-3xl px-8 py-5">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="mx-auto max-w-3xl px-8 py-4 pb-32 space-y-8">
        <section className="space-y-4">
          <Skeleton className="h-4 w-16" />
          <div className="flex items-center gap-4">
            <Skeleton className="size-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-28 rounded-md" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </section>
        <Separator />
        <section className="space-y-4">
          <Skeleton className="h-4 w-20" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </section>
        <Separator />
        <section className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2 max-w-sm">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        </section>
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
