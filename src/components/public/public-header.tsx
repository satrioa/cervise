import Image from "next/image";
import { MessageCircleIcon } from "lucide-react";
import { initialsOf } from "@/lib/photos";

function waLink(phone: string | null): string | null {
  if (!phone) return null;
  const angka = phone.replace(/[^\d]/g, "");
  if (angka.length < 8) return null;
  return `https://wa.me/${angka.startsWith("0") ? `62${angka.slice(1)}` : angka}`;
}

/**
 * Banner atas halaman Lacak.
 *
 * Logo memakai `object-contain` di dalam lingkaran dan fallback-nya inisial
 * lokal, bukan `api.dicebear.com`: halaman ini dibuka siapa pun tanpa login,
 * jadi memanggil avatar pihak ketiga akan mengirim nama toko ke luar setiap
 * kali banner dirender.
 */
export function PublicHeader({
  name,
  logoUrl,
  bannerUrl,
  tagline,
  phone,
}: {
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  tagline: string | null;
  phone: string | null;
}) {
  const wa = waLink(phone);

  return (
    <header className="relative isolate overflow-hidden">
      <div className="absolute inset-0">
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="size-full bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary)_55%,var(--background)))]" />
        )}
      </div>

      <div className="absolute inset-0 bg-background/45" aria-hidden />

      <div className="relative mx-auto flex w-full max-w-3xl items-center gap-3 px-4 pt-6">
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background font-heading text-sm font-bold text-foreground shadow-sm">
          {logoUrl ? (
            <Image src={logoUrl} alt={name} fill sizes="44px" unoptimized className="object-contain p-1" />
          ) : (
            initialsOf(name)
          )}
        </span>

        <h1 className="min-w-0 flex-1 truncate text-center font-heading text-lg font-bold text-foreground drop-shadow-sm">
          {name}
        </h1>

        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Hubungi ${name} via WhatsApp`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground/90 text-background shadow-sm transition-opacity hover:opacity-80"
          >
            <MessageCircleIcon className="size-5" />
          </a>
        ) : (
          <span className="size-11 shrink-0" aria-hidden />
        )}
      </div>

      {tagline ? (
        <p className="relative mx-auto mt-6 w-full max-w-3xl px-6 pb-10 text-center font-heading text-xl font-bold leading-snug text-foreground drop-shadow-sm">
          {tagline}
        </p>
      ) : (
        <div aria-hidden className="h-10" />
      )}
    </header>
  );
}