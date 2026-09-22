import { useEffect, useState } from "react";
import { TrashIcon, XIcon } from "lucide-react";

export function ToastsUndoShowcasePage() {
  const [remaining, setRemaining] = useState(8);

  useEffect(() => {
    const t = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 0.05 : 0));
    }, 50);
    return () => window.clearInterval(t);
  }, []);

  const pct = Math.max(0, (remaining / 8) * 100);

  return (
    <div className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <FakeAppBackdrop />
      <div className="-translate-x-1/2 absolute bottom-8 left-1/2 z-50 w-96">
        <div className="overflow-hidden rounded-lg border border-foreground/10 bg-foreground text-background shadow-xl">
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background/15">
              <TrashIcon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">Project archived</div>
              <p className="mt-0.5 truncate text-xs opacity-70">
                "Q3 planning" moved to archive.
              </p>
            </div>
            <button
              type="button"
              className="rounded-md bg-background/15 px-2.5 py-1 font-medium text-xs transition-colors hover:bg-background/25"
            >
              Undo
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              className="rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
          <div className="h-0.5 bg-background/10">
            <div
              className="h-full bg-background/40 transition-[width] duration-100"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="mt-2 text-center font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
          {remaining > 0 ? `${remaining.toFixed(1)}s left to undo` : "Permanent"}
        </div>
      </div>
    </div>
  );
}

function FakeAppBackdrop() {
  return (
    <div className="absolute inset-0 p-10 opacity-50 space-y-3">
      <div className="h-4 w-56 rounded bg-foreground/15" />
      <div className="h-2 w-72 rounded bg-foreground/10" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-border/40 bg-foreground/[0.02]"
          />
        ))}
      </div>
    </div>
  );
}
