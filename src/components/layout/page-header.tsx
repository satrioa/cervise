import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CommandSearchTrigger } from "./command-palette-provider";

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
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
  actions,
  titleClassName,
  containerClassName,
  row2ClassName,
  sticky = true,
  className,
}: PageHeaderProps) {
  const hasRow2 = search != null || filters != null || actions != null;

  return (
    <header
      className={cn(
        "border-b border-border/60 bg-background/90 backdrop-blur-md",
        sticky ? "sticky top-0 z-30" : "relative",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex min-h-16 w-full max-w-6xl flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-10",
          containerClassName,
        )}
      >
        <div className="min-w-0 flex-1">
          <h1 className={cn("truncate font-heading text-xl", titleClassName)}>{title}</h1>
          {description ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="shrink-0">
          <CommandSearchTrigger />
        </div>
      </div>
      {hasRow2 ? (
        <div className="border-t border-border/40">
          <div
            className={cn(
              "mx-auto flex h-12 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-10",
              containerClassName,
              row2ClassName,
            )}
          >
            {search ? <div className="w-56 shrink-0 sm:w-64 lg:w-72 [&_input]:h-8 [&_button]:h-8">{search}</div> : null}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-x-auto scrollbar-none">
              {filters}
              {actions}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
