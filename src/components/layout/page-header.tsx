import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FilterGroup } from "./filter-group";
import { PageBreadcrumb } from "./page-breadcrumb";
import { PageHeaderContainer } from "./page-header-container";
import { SettingsHeaderTabs } from "./settings-nav";
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
  /** Filter langsung tampil di mobile, tanpa tombol lipat. */
  filtersAlwaysVisible?: boolean;
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
  filtersAlwaysVisible = false,
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
        "border-b border-border/60 bg-white dark:bg-[#0f0f0f]",
        // Shell compact memakai warna canvas yang sama dengan latar halaman,
        // supaya header tidak tampil sebagai bilah putih yang menonjol.
        "group-data-[shell=compact]/shell:bg-canvas group-data-[shell=compact]/shell:dark:bg-canvas",
        "group-data-[shell=compact]/shell:border-b-0 lg:group-data-[shell=compact]/shell:border-b lg:group-data-[shell=compact]/shell:border-border/30",
        sticky
          ? "sticky top-0 z-30 group-data-[shell=compact]/shell:relative lg:group-data-[shell=compact]/shell:sticky"
          : "relative",
        className,
      )}
    >
      <PageHeaderContainer className="flex min-h-16 flex-row items-center justify-between gap-4">
        <div className="min-w-0 flex-1 group-data-[shell=compact]/shell:hidden lg:group-data-[shell=compact]/shell:block">
          <PageBreadcrumb title={title} titleClassName={titleClassName} />
        </div>
        <ShellChrome />
      </PageHeaderContainer>
      {hasRow2 ? (
        <div className="border-t border-border/40 group-data-[shell=compact]/shell:border-t-0 lg:group-data-[shell=compact]/shell:border-t lg:group-data-[shell=compact]/shell:border-border/20">
          {/* Mobile: search + tombol filter + aksi di baris pertama. Panel
              filter dibuka lewat ikon dan ditata grid 2 kolom supaya semua
              kontrol terlihat tanpa scroll horizontal. */}
          <PageHeaderContainer
            className={cn(
              "flex flex-wrap items-center gap-2 py-2 sm:h-12 sm:flex-nowrap sm:gap-3 sm:py-0",
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
                alwaysVisible={filtersAlwaysVisible}
                className="sm:flex-1 sm:justify-end"
              >
                {filters}
              </FilterGroup>
            ) : null}
          </PageHeaderContainer>
        </div>
      ) : null}
      <SettingsHeaderTabs />
    </header>
  );
}
