import {
  FacebookLogo,
  Globe,
  InstagramLogo,
  MapPin,
  TiktokLogo,
  WhatsappLogo,
  XLogo,
  YoutubeLogo,
} from "@phosphor-icons/react/dist/ssr";

type SocialItem = { href: string; label: string; Icon: typeof InstagramLogo };

/**
 * Footer halaman Lacak.
 *
 * Sosial tampil sebagai ikon bulat saja (tanpa teks) supaya tidak memakan
 * ruang di layar HP; nama platform tetap ada di `aria-label`/`title` untuk
 * pembaca layar, dan alamatnya datang dari data yang sudah divalidasi
 * `safeExternalUrl` di `toPublicTenant`.
 */
export function PublicFooter({
  name,
  instagramUrl,
  tiktokUrl,
  websiteUrl,
  facebookUrl,
  xUrl,
  youtubeUrl,
  whatsappUrl,
  mapsUrl,
  footerNote,
  address,
  phone,
}: {
  name: string;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  xUrl?: string | null;
  youtubeUrl?: string | null;
  whatsappUrl?: string | null;
  mapsUrl?: string | null;
  footerNote?: string | null;
  address: string | null;
  phone: string | null;
}) {
  const socials: SocialItem[] = [];
  if (instagramUrl) socials.push({ href: instagramUrl, label: "Instagram", Icon: InstagramLogo });
  if (tiktokUrl) socials.push({ href: tiktokUrl, label: "TikTok", Icon: TiktokLogo });
  if (whatsappUrl) socials.push({ href: whatsappUrl, label: "WhatsApp", Icon: WhatsappLogo });
  if (websiteUrl) socials.push({ href: websiteUrl, label: "Website", Icon: Globe });
  if (facebookUrl) socials.push({ href: facebookUrl, label: "Facebook", Icon: FacebookLogo });
  if (xUrl) socials.push({ href: xUrl, label: "X", Icon: XLogo });
  if (youtubeUrl) socials.push({ href: youtubeUrl, label: "YouTube", Icon: YoutubeLogo });
  if (mapsUrl) socials.push({ href: mapsUrl, label: "Lokasi", Icon: MapPin });

  const adaSocial = socials.length > 0;
  const adaKontak = Boolean(address || phone || footerNote);
  if (!adaSocial && !adaKontak) return null;

  return (
    <footer className="mt-auto bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-6 py-8 text-center">
        {adaSocial ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {socials.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${label} ${name}`}
                title={label}
                className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/5 transition-colors hover:bg-white/15"
              >
                <Icon className="size-5" weight="fill" aria-hidden />
              </a>
            ))}
          </div>
        ) : null}

        {adaKontak ? (
          <div className="space-y-0.5 text-sm text-neutral-300">
            {footerNote ? <p>{footerNote}</p> : null}
            {address ? <p>{address}</p> : null}
            {phone ? <p className="tabular-nums">{phone}</p> : null}
          </div>
        ) : null}

        <p className="text-xs text-neutral-500">© {new Date().getFullYear()} {name}</p>
      </div>
    </footer>
  );
}
