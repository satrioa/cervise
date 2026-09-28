export function TenantBadge({
  name,
  logoUrl,
  branchName,
}: {
  name: string;
  logoUrl: string | null;
  branchName: string | null;
}) {
  const src =
    logoUrl && logoUrl.trim().length > 0
      ? logoUrl
      : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

  return (
    <div className="flex items-center gap-3">
      {/* Logo berasal dari domain tenant sendiri, jadi optimasi gambar dimatikan. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-lg border bg-background object-contain"
      />
      <div className="min-w-0 text-left">
        <div className="truncate font-heading text-sm font-semibold">{name}</div>
        {branchName ? <div className="truncate text-xs text-muted-foreground">{branchName}</div> : null}
      </div>
    </div>
  );
}
