import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="min-h-svh bg-background">
      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-2 sm:px-6 sm:py-4 lg:px-8">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-2 pb-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-5">
            <Skeleton className="h-20 w-20 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-full max-w-md" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-2 pb-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-40" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-2 pb-4">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
