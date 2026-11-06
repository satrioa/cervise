"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import BlurFadeThemeTransition, {
  useBlurFadeThemeTransition,
} from "@/components/ui/BlurFadeThemeTransition";
import { cn } from "@/lib/utils";

/**
 * Pengalih tema terang/gelap untuk APLIKASI.
 *
 * Menyimpan ke `localStorage["cervise-theme"]` lewat `next-themes`, dan hanya
 * memengaruhi `<html>` lewat class `dark`. Tidak ada hubungannya dengan
 * pengaturan tampilan halaman Lacak di `/app/pengaturan/tampilan`: yang itu
 * milik toko, disimpan di database, dan tidak menyentuh class pada `<html>`.
 *
 * `BlurFadeThemeTransition` dipakai dalam mode terkontrol supaya next-themes
 * tetap satu-satunya pemilik state tema.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <BlurFadeThemeTransition
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      onThemeChange={setTheme}
    >
      <ThemeToggleInner className={className} />
    </BlurFadeThemeTransition>
  );
}

function ThemeToggleInner({ className }: { className?: string }) {
  const { theme, triggerTransition, isAnimating } = useBlurFadeThemeTransition();
  // Tema hanya diketahui di client. useSyncExternalStore mengembalikan false di
  // server dan true di client, jadi ikon tidak hydration-mismatch.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isDark = mounted && theme === "dark";
  const Icon = isDark ? SunIcon : MoonIcon;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => triggerTransition()}
      disabled={isAnimating}
      aria-label={isDark ? "Ubah ke tema terang" : "Ubah ke tema gelap"}
      title={isDark ? "Tema terang" : "Tema gelap"}
      className={cn("size-8 shrink-0 p-0", className)}
    >
      <Icon className="size-4" />
    </Button>
  );
}
