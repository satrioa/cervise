"use client";

import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DateRange = { from?: Date; to?: Date };

/**
 * Filter rentang tanggal (Popover + Calendar mode="range"), satu kontrol
 * alih-alih dua tombol tanggal terpisah.
 *
 * Pola ini sudah dipakai di /app/servis dan /app/keuangan/transaksi; tiga
 * halaman laporan sebelumnya masih memakai dua popover `mode="single"` yang
 * membuat pengguna harus membuka kalender dua kali dan bisa mistyped angka
 * tengahnya. Kontrol ini dipakai semuanya supaya konsisten.
 *
 * Nilai tetap Date di state; serialisasi ke string YYYY-MM-DD tetap urusan
 * pemanggil lewat toLocalDateString, jadi kontrak query tidak berubah.
 */
export function DateRangeFilter({
  value,
  onChange,
  placeholder = "Semua tanggal",
  resultLabel,
  className,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  /** Teks jumlah hasil di footer, mis. "12 transaksi". */
  resultLabel?: string;
  className?: string;
}) {
  const label = (() => {
    if (value.from && value.to) {
      const sameMonth =
        value.from.getMonth() === value.to.getMonth() &&
        value.from.getFullYear() === value.to.getFullYear();
      return sameMonth
        ? `${format(value.from, "d", { locale: localeId })}\u2013${format(value.to, "d MMM yyyy", { locale: localeId })}`
        : `${format(value.from, "d MMM", { locale: localeId })} \u2013 ${format(value.to, "d MMM yyyy", { locale: localeId })}`;
    }
    if (value.from) return format(value.from, "d MMM yyyy", { locale: localeId });
    if (value.to) return format(value.to, "d MMM yyyy", { locale: localeId });
    return placeholder;
  })();

  const hasRange = Boolean(value.from || value.to);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-auto shrink-0 justify-start gap-2 font-normal text-sm",
              !hasRange && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <CalendarIcon className="size-4 opacity-70" />
        <span className="truncate">{label}</span>
        {hasRange ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onChange({});
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
                onChange({});
              }
            }}
            className="-mr-1 ml-1 rounded p-0.5 hover:bg-foreground/10"
            aria-label="Hapus rentang"
          >
            <XIcon className="size-3.5" />
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="range"
          selected={value.from ? { from: value.from, to: value.to } : undefined}
          onSelect={(range) => onChange({ from: range?.from, to: range?.to })}
          numberOfMonths={2}
        />
        <div className="flex items-center justify-between border-t p-2">
          <span className="px-2 text-xs text-muted-foreground">
            {resultLabel ?? (hasRange ? "Rentang dipilih" : "Pilih rentang")}
          </span>
          <Button variant="ghost" size="xs" onClick={() => onChange({})}>
            Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
