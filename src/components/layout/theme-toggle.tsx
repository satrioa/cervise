"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { CheckIcon, LaptopIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Terang", Icon: SunIcon },
  { value: "dark", label: "Gelap", Icon: MoonIcon },
  { value: "system", label: "Sistem", Icon: LaptopIcon },
] as const;

/**
 * Pengalih tema terang/gelap/sistem.
 *
 * next-thes sudah terpasang dan styling `dark:` sudah ada di seluruh
 * komponen, tapi sebelumnya tidak ada satu pun kontrol untuk mengubahnya -
 * ThemeProvider di app/layout.tsx memakai defaultTheme="light" dan
 * enableSystem={false}, jadi aplikasi praktisnya light-only.
 *
 * Button ini meniru gaya CommandSearchTrigger di sebelahnya, dan memakai
 * primitive coss yang sudah ada di repo (Button + Popover) -
 * tidak menambah dependensi.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // Tema hanya diketahui di client. useSyncExternalStore mengembalikan false di
  // server dan true di client, jadi ikon tidak akan hydration-mismatch tanpa
  // perlu useEffect + setState (yang juga complained oleh lint react-hooks).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const current = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[0];
  const Icon = mounted ? current.Icon : SunIcon;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="Ubah tema"
            title="Ubah tema"
            className={cn("size-8 shrink-0 p-0", className)}
          />
        }
      >
        <Icon className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        <div className="flex flex-col gap-0.5">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-foreground/[0.04]",
                mounted && theme === option.value && "bg-foreground/[0.06] font-medium",
              )}
            >
              <span className="flex items-center gap-2">
                <option.Icon className="size-3.5 opacity-60" />
                {option.label}
              </span>
              {mounted && theme === option.value ? <CheckIcon className="size-3.5" /> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
