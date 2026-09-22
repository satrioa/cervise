"use client";

import { toast as sonnerToast } from "sonner";
import { CheckIcon, AlertCircleIcon, RotateCcwIcon, TrashIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

// Success toast - matches toasts-success showcase
export function toastSuccess(opts: { title?: string; description?: string } = {}) {
  const { title = "Saved", description = "Workspace settings updated." } = opts;
  return sonnerToast.custom(
    (t) => (
      <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background px-3.5 py-3 shadow-lg backdrop-blur w-80 animate-in slide-in-from-top-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">{title}</div>
          <p className="mt-0.5 truncate text-muted-foreground text-xs">{description}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => sonnerToast.dismiss(t)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    ),
    { duration: 3000 }
  );
}

// Error retry toast - matches toasts-error-retry showcase
export function toastErrorRetry(opts: {
  title?: string;
  description?: string;
  code?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
} = {}) {
  const {
    title = "Couldn't send invite",
    description = "Email gateway is unreachable right now. We'll keep your draft — try again or write to support.",
    code = "503",
    onRetry,
    onDismiss,
  } = opts;
  return sonnerToast.custom(
    (t) => (
      <div className="rounded-lg border border-destructive/40 bg-background shadow-lg w-96 animate-in slide-in-from-top-2 overflow-hidden">
        <div className="flex items-start gap-3 p-3.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertCircleIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{title}</span>
              {code && (
                <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[9px] text-destructive uppercase tracking-[0.2em]">
                  {code}
                </span>
              )}
            </div>
            <p className="mt-1 text-muted-foreground text-xs leading-relaxed">{description}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              sonnerToast.dismiss(t);
              onDismiss?.();
            }}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground shrink-0"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/60 px-3 py-2 bg-muted/20">
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => {
              sonnerToast.dismiss(t);
              onDismiss?.();
            }}
          >
            Dismiss
          </Button>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => {
              sonnerToast.dismiss(t);
              onRetry?.();
            }}
          >
            <RotateCcwIcon className="size-3.5" />
            Retry
          </Button>
        </div>
      </div>
    ),
    { duration: 5000 }
  );
}

// Undo toast - matches toasts-undo showcase (bottom center, progress bar, auto-dismiss)
export function toastUndo(opts: {
  title?: string;
  description?: string;
  onUndo?: () => void;
  duration?: number;
} = {}) {
  const { title = "Project archived", description = '"Q3 planning" moved to archive.', onUndo, duration = 8000 } = opts;

  return sonnerToast.custom(
    (t) => <UndoToastContent t={t} title={title} description={description} onUndo={onUndo} duration={duration} />,
    {
      duration,
      position: "bottom-center",
    }
  );
}

function UndoToastContent({
  t,
  title,
  description,
  onUndo,
  duration,
}: {
  t: string | number;
  title: string;
  description: string;
  onUndo?: () => void;
  duration: number;
}) {
  const [remaining, setRemaining] = useState(duration / 1000);

  useEffect(() => {
    const start = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, duration - elapsed);
      setRemaining(left / 1000);
      if (left <= 0) window.clearInterval(interval);
    }, 50);
    return () => window.clearInterval(interval);
  }, [duration]);

  const pct = Math.max(0, (remaining / (duration / 1000)) * 100);

  return (
    <div className="overflow-hidden rounded-lg border border-foreground/10 bg-foreground text-background shadow-xl w-96 animate-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background/15">
          <TrashIcon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">{title}</div>
          <p className="mt-0.5 truncate text-xs opacity-70">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onUndo?.();
            sonnerToast.dismiss(t);
          }}
          className="rounded-md bg-background/15 px-2.5 py-1 font-medium text-xs transition-colors hover:bg-background/25"
        >
          Undo
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => sonnerToast.dismiss(t)}
          className="rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      <div className="h-0.5 bg-background/10">
        <div className="h-full bg-background/40 transition-[width] duration-100" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Convenience re-export
export const cerviseToast = {
  success: toastSuccess,
  errorRetry: toastErrorRetry,
  undo: toastUndo,
};
