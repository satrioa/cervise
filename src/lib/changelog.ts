import data from "@/content/changelog.json";

export type ChangeKind = "added" | "changed" | "fixed";

export type Release = {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: Record<ChangeKind, string[]>;
  highlight?: boolean;
};

export const releases = data.releases as Release[];

export const CHANGE_LABELS: Record<ChangeKind, string> = {
  added: "Baru",
  changed: "Diubah",
  fixed: "Diperbaiki",
};

export function releaseTag(version: string) {
  return `v${version}`;
}

export function releaseUrl(version: string) {
  return `https://github.com/satrioa/cervise/releases/tag/${releaseTag(version)}`;
}

export function formatReleaseDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
