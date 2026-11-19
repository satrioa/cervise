"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Tombol refresh data tanpa reload halaman. Tiap halaman kirim fungsi refetch
 * sendiri: state lokal (servis, sparepart) atau `router.refresh()` (inventori).
 */
export function RefreshDataButton({
  onRefresh,
  className,
}: {
  onRefresh: () => void | Promise<void>;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Muat ulang data"
      title="Muat ulang data"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            await onRefresh();
          } catch {
            toast.error("Gagal memuat ulang data");
          }
        });
      }}
      className={cn("size-8", className)}
    >
      <RefreshCw className={cn("size-4", isPending ? "animate-spin" : undefined)} />
    </Button>
  );
}

export default RefreshDataButton;
