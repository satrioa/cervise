"use client";

import Image from "next/image";
import { useState } from "react";
import { initialsOf } from "@/lib/photos";

type IdentityAvatarProps = {
  /** URL publik hasil-built server. null = belum ada foto. */
  photoUrl?: string | null;
  name?: string | null;
  className?: string;
  /** Teks untuk alt / title. Default-nya initials. */
  label?: string;
};

/**
 * Avatar untuk orang (akun) maupun tenant. Satu implementasi supaya sidebar,
 * tenant switcher, halaman profil, dan daftar karyawan tidak berbeda perilaku:
 * ada foto -> tampil foto; tidak ada -> inisial lokal.
 *
 * Nilai cadangannya sengaja initials, bukan panggilan ke layanan avatar
 * pihak ketiga: sebelumnya fallback-nya memanggil api.dicebear.com, yang
 * mengirim nama pengguna ke server luar setiap kali komponen dirender.
 */
export function IdentityAvatar({ photoUrl, name, className, label }: IdentityAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = initialsOf(name);
  const showPhoto = Boolean(photoUrl) && !failed;

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground ${className ?? "size-8 text-xs"}`}
    >
      {showPhoto ? (
        <Image
          src={photoUrl as string}
          alt={label ?? name ?? initials}
          fill
          sizes="64px"
          unoptimized
          onError={() => setFailed(true)}
          className="object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}
