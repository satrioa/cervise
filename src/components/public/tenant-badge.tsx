import { initialsOf } from "@/lib/photos";

/**
 * Logo + nama tenant untuk halaman yang belum punya banner sendiri.
 *
 * Fallback-nya inisial lokal, BUKAN `api.dicebear.com`. Repo ini sudah
 * menyingkirkan DiceBear di sisi lain justru karena ia mengirim nama tenant
 * ke pihak ketiga setiap kali komponen dirender, dan halaman publik tidak
 * punya sesi - jadi tiap pengunjung menjadi jalan bagi nama toko keluar.
 */
export function TenantBadge({
  name,
  logoUrl,
  branchName,
}: {
  name: string;
  logoUrl: string | null;
  branchName: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background text-xs font-medium text-foreground">
        {logoUrl ? (
          // Logo berasal dari bucket tenant sendiri dan sudah dibatasi
          // `publicPhotoUrl`, jadi `<Image>` tidak perlu di sini.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={name}
            width={40}
            height={40}
            className="size-full object-contain p-1"
          />
        ) : (
          initialsOf(name)
        )}
      </span>
      <div className="min-w-0 text-left">
        <div className="truncate font-heading text-sm font-semibold">{name}</div>
        {branchName ? <div className="truncate text-xs text-muted-foreground">{branchName}</div> : null}
      </div>
    </div>
  );
}