import { ArrowUpRightIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import {
  CHANGE_LABELS,
  formatReleaseDate,
  releaseUrl,
  type ChangeKind,
  type Release,
} from "@/lib/changelog";

const KIND_VARIANTS: Record<ChangeKind, "success" | "info" | "warning"> = {
  added: "success",
  changed: "info",
  fixed: "warning",
};

export function ReleaseCard({ release }: { release: Release }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={release.highlight ? "info" : "secondary"} className="font-mono">
            v{release.version}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatReleaseDate(release.date)}</span>
          {release.highlight ? (
            <Badge variant="warning" className="gap-1">
              <SparklesIcon className="size-3" /> Sorotan
            </Badge>
          ) : null}
        </div>
        <CardTitle>{release.title}</CardTitle>
        <CardDescription>{release.summary}</CardDescription>
      </CardHeader>
      <CardPanel className="space-y-4">
        {(Object.keys(CHANGE_LABELS) as ChangeKind[]).map((kind) => {
          const items = release.changes[kind] ?? [];
          if (items.length === 0) return null;
          return (
            <div key={kind}>
              <Badge variant={KIND_VARIANTS[kind]} className="mb-2">
                {CHANGE_LABELS[kind]}
              </Badge>
              <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                {items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          );
        })}
        <a
          href={releaseUrl(release.version)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Lihat tag di GitHub <ArrowUpRightIcon className="size-3" />
        </a>
      </CardPanel>
    </Card>
  );
}
