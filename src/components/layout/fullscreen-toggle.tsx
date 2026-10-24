"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Tombol layar penuh untuk header CompactShell.
 *
 * Menggantikan ThemeToggle di top bar compact. Status dibaca dari
 * `document.fullscreenElement` dan disinkronkan lewat `fullscreenchange`,
 * jadi ikon ikut berubah saat user keluar dengan Esc atau gesture browser.
 */
export function FullscreenToggle({ className }: { className?: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggle = async () => {
    if (!document.fullscreenEnabled) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Browser bisa menolak fullscreen (izin/iframe). Biarkan UI tetap utuh.
    }
  };

  const Icon = isFullscreen ? Minimize2 : Maximize2;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void toggle()}
      aria-label={isFullscreen ? "Keluar layar penuh" : "Layar penuh"}
      title={isFullscreen ? "Keluar layar penuh" : "Layar penuh"}
      aria-pressed={isFullscreen}
      className={cn("size-8 shrink-0 p-0", className)}
    >
      <Icon className="size-4" />
    </Button>
  );
}
