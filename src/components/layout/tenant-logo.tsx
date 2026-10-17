"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/photos";

/**
 * Logo TENANT -- bukan foto profil.
 *
 * Tiga sidebar dulu merender logo tenant dengan tiga bentuk berbeda, dan dua
 * di antaranya memakainya sebagai avatar: `AvatarImage` dan `IdentityAvatar`
 * sama-sama memakai `object-cover` plus `rounded-full`. Akibatnya logo bisnis
 * tampil sebagai foto profil bulat, dan tepinya terpotong.
 *
 * Yang benar untuk logo: persegi, `object-contain` supaya utuh, dan fallback
 * berupa inisial lokal. Tidak ada panggilan ke layanan avatar pihak ketiga --
 * kalau logo tidak ada, cukup huruf, dan tidak ada permintaan keluar ke
 * internet hanya untuk menggambar avatar.
 */
export function TenantLogo({
  logoUrl,
  name,
  title,
  className,
}: {
  logoUrl: string | null | undefined;
  name: string | null | undefined;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !failed;

  return (
    <span
      title={title}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-lg bg-muted font-medium text-muted-foreground",
        className ?? "size-8 text-xs",
      )}
    >
      {showLogo ? (
        <Image
          src={logoUrl as string}
          alt={name ?? "Logo tenant"}
          fill
          sizes="40px"
          unoptimized
          onError={() => setFailed(true)}
          className="object-contain"
        />
      ) : (
        initialsOf(name ?? "C")
      )}
    </span>
  );
}
