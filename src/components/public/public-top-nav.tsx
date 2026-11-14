import Image from "next/image";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { initialsOf } from "@/lib/photos";

/** Nomor cabang dirapikan jadi tautan wa.me; nomor terlalu pendek diabaikan. */
function waLink(phone: string | null): string | null {
  if (!phone) return null;
  const angka = phone.replace(/[^\d]/g, "");
  if (angka.length < 8) return null;
  return `https://wa.me/${angka.startsWith("0") ? `62${angka.slice(1)}` : angka}`;
}

/**
 * Bar atas halaman Lacak: identitas toko di kiri, tombol WhatsApp di kanan.
 *
 * Logo memakai `object-cover` supaya benar-benar bulat penuh, dan fallback-nya
 * inisial lokal (bukan avatar pihak ketiga) karena halaman ini dibuka tanpa
 * login oleh siapa pun.
 */
export function PublicTopNav({
  name,
  logoUrl,
  phone,
}: {
  name: string;
  logoUrl: string | null;
  phone: string | null;
}) {
  const wa = waLink(phone);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2.5 px-4 py-2">
        <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-heading text-xs font-bold text-foreground">
          {logoUrl ? (
            <Image src={logoUrl} alt={name} fill sizes="36px" unoptimized className="object-cover" />
          ) : (
            initialsOf(name)
          )}
        </span>

        <p className="min-w-0 flex-1 truncate font-heading text-sm font-bold">{name}</p>

        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Hubungi ${name} via WhatsApp`}
            title="WhatsApp"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-85"
          >
            <WhatsappLogo className="size-5" weight="fill" aria-hidden />
          </a>
        ) : null}
      </div>
    </header>
  );
}
