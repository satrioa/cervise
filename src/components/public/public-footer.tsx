import { CameraIcon, Music2Icon } from "lucide-react";

// Lucide tidak menyediakan ikon brand (Instagram/TikTok sengaja tidak ada di
// paket ikon), jadi memakai ikon yang paling mendekati perannya.
function labelDariUrl(url: string): string {
  const tanpaSkema = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
  const potongan = tanpaSkema.slice(-14);
  return potongan.length > 0 && tanpaSkema.length > 14 ? `…${potongan}` : tanpaSkema;
}

export function PublicFooter({
  name,
  instagramUrl,
  tiktokUrl,
  address,
  phone,
}: {
  name: string;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  address: string | null;
  phone: string | null;
}) {
  const adaSocial = Boolean(instagramUrl || tiktokUrl);
  const adaKontak = Boolean(address || phone);
  if (!adaSocial && !adaKontak) return null;

  return (
    <footer className="mt-auto bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-6 py-8 text-center">
        {adaSocial ? (
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {instagramUrl ? (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Instagram ${name}`}
                className="flex items-center gap-2 text-sm transition-opacity hover:opacity-75"
              >
                <CameraIcon className="size-4 shrink-0" aria-hidden />
                <span>{labelDariUrl(instagramUrl)}</span>
              </a>
            ) : null}
            {tiktokUrl ? (
              <a
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`TikTok ${name}`}
                className="flex items-center gap-2 text-sm transition-opacity hover:opacity-75"
              >
                <Music2Icon className="size-4 shrink-0" aria-hidden />
                <span>{labelDariUrl(tiktokUrl)}</span>
              </a>
            ) : null}
          </div>
        ) : null}

        {adaKontak ? (
          <div className="space-y-0.5 text-sm text-neutral-300">
            {address ? <p>{address}</p> : null}
            {phone ? <p className="tabular-nums">{phone}</p> : null}
          </div>
        ) : null}

        <p className="text-xs text-neutral-500">© {new Date().getFullYear()} {name}</p>
      </div>
    </footer>
  );
}