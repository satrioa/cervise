import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FilterGroup } from "./filter-group";
import { ShellChrome } from "./shell-chrome";

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  /** Jumlah filter aktif (selain pencarian); tampil sebagai badge di mobile. */
  filterCount?: number;
  /** Label filter aktif, mis. "Status: Aktif · Cabang: Pusat". */
  filterSummary?: string;
  /** Halaman server: tombol hapus filter berupa link. */
  filterClearHref?: string;
  /** Halaman client: tombol hapus filter memanggil state lokal. */
  onClearFilters?: () => void;
  actions?: ReactNode;
  titleClassName?: string;
  containerClassName?: string;
  row2ClassName?: string;
  sticky?: boolean;
  className?: string;
};

export function PageHeader({
  title,
  description,
  search,
  filters,
  filterCount = 0,
  filterSummary,
  filterClearHref,
  onClearFilters,
  actions,
  titleClassName,
  containerClassName,
  row2ClassName,
  sticky = true,
  className,
}: PageHeaderProps) {
  // `ShellChrome` yang memutuskan apakah search + tema perlu dirender di
  // sini. `PageHeader` sengaja tetap server component, jadi `useShellChrome`
  // tidak boleh dipanggil langsung dari file ini.
  const hasRow2 = search != null || filters != null || actions != null;

  return (
    <header
      className={cn(
        "border-b border-border/60 bg-header/90 backdrop-blur-md",
        sticky ? "sticky top-0 z-30" : "relative",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex min-h-16 w-full max-w-6xl flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8",
          containerClassName,
        )}
      >
        <div className="min-w-0 flex-1">
          <h1 className={cn("truncate font-heading text-xl", titleClassName)}>{title}</h1>
          {description ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <ShellChrome />
      </div>
      {hasRow2 ? (
        <div className="border-t border-border/40">
          {/* Mobile: search + tombol filter + aksi di baris pertama. Panel
              filter dibuka lewat ikon dan ditata grid 2 kolom supaya semua
              kontrol terlihat tanpa scroll horizontal. */}
          <div
            className={cn(
              "mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-2 sm:h-12 sm:flex-nowrap sm:gap-3 sm:py-0 sm:px-6 lg:px-8",
              containerClassName,
              row2ClassName,
            )}
          >
            {search ? (
              <div className="order-1 min-w-0 flex-1 sm:w-56 sm:flex-none md:w-64 lg:w-72 [&_input]:h-8 [&_button]:h-8">
                {search}
              </div>
            ) : null}
            {actions ? (
              <div className="order-3 ml-auto flex shrink-0 items-center gap-2">{actions}</div>
            ) : null}
            {filters ? (
              <FilterGroup
                count={filterCount}
                summary={filterSummary}
                clearHref={filterClearHref}
                onClear={onClearFilters}
                className="sm:flex-1 sm:justify-end"
              >
                {filters}
              </FilterGroup>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
