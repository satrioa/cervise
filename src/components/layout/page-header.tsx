import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  titleClassName?: string;
  innerClassName?: string;
  actionsClassName?: string;
  toolbarClassName?: string;
  sticky?: boolean;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  toolbar,
  titleClassName,
  innerClassName,
  actionsClassName,
  toolbarClassName,
  sticky = true,
  className,
}: PageHeaderProps) {
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
          "mx-auto flex min-h-16 w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-0 lg:px-10",
          innerClassName,
        )}
      >
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{eyebrow}</div>
          ) : null}
          <h1 className={cn("truncate font-heading text-xl", eyebrow ? "mt-1" : "mt-0", titleClassName)}>{title}</h1>
          {description ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? (
          <div className={cn("flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end", actionsClassName)}>
            {actions}
          </div>
        ) : null}
      </div>
      {toolbar ? (
        <div className="border-t border-border/40">
          <div className={cn("mx-auto w-full max-w-6xl px-4 py-2 sm:px-6 lg:px-10", toolbarClassName)}>
            <div className="overflow-x-auto scrollbar-none">{toolbar}</div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
