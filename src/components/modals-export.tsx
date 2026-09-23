import { useState } from "react";
import {
  CalendarIcon,
  DownloadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Format = "csv" | "json" | "pdf";

const FORMATS: { id: Format; label: string; meta: string; Icon: typeof FileTextIcon }[] = [
  { id: "csv", label: "CSV", meta: "Spreadsheet · 84 columns", Icon: FileSpreadsheetIcon },
  { id: "json", label: "JSON", meta: "Raw, with metadata", Icon: FileJsonIcon },
  { id: "pdf", label: "PDF", meta: "Print-ready report", Icon: FileTextIcon },
];

const FIELDS = [
  { id: "summary", label: "Summary metrics", default: true },
  { id: "events", label: "All events", default: true },
  { id: "users", label: "User attributes", default: false },
  { id: "raw", label: "Raw payloads", default: false },
];

export function ModalsExportShowcasePage() {
  const [format, setFormat] = useState<Format>("csv");

  return (
    <div className="relative min-h-svh bg-background">
      <div aria-hidden className="px-10 py-10 opacity-25">
        <div className="font-heading text-2xl">Analytics</div>
      </div>

      <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-border/60 border-b px-5 py-3.5">
            <div>
              <div className="font-heading text-sm">Export data</div>
              <div className="mt-0.5 text-muted-foreground text-xs">
                We'll email you the download link.
              </div>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          <div className="space-y-5 px-5 py-4">
            <div>
              <div className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
                Format
              </div>
              <div className="flex flex-col gap-2">
                {FORMATS.map((f) => {
                  const active = format === f.id;
                  return (
                    <label
                      key={f.id}
                      className={
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors " +
                        (active
                          ? "border-foreground/60 bg-foreground/[0.04]"
                          : "border-border/60 hover:border-foreground/30")
                      }
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        checked={active}
                        onChange={() => setFormat(f.id)}
                      />
                      <span
                        className={
                          "size-3.5 rounded-full border " +
                          (active
                            ? "border-foreground bg-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background"
                            : "border-border")
                        }
                      />
                      <f.Icon className="size-4 opacity-70" />
                      <div className="flex-1">
                        <div className="text-sm">{f.label}</div>
                        <div className="text-muted-foreground text-xs">
                          {f.meta}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
                Date range
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-left"
              >
                <CalendarIcon className="size-4 opacity-60" />
                <span className="flex-1 text-sm">Mar 27 – Apr 25, 2026</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  30d
                </span>
              </button>
            </div>

            <div>
              <div className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
                Include
              </div>
              <div className="flex flex-col gap-1.5">
                {FIELDS.map((f) => (
                  <label
                    key={f.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-foreground/[0.03]"
                  >
                    <input
                      type="checkbox"
                      defaultChecked={f.default}
                      className="size-3.5"
                    />
                    <span className="text-sm">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-border/60 border-t bg-background px-5 py-3 text-xs">
            <span className="text-muted-foreground">
              Estimated size · ~3.4 MB
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" type="button">
                Cancel
              </Button>
              <Button type="button">
                <DownloadIcon />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
