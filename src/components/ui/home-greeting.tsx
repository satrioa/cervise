"use client";

import { EncryptedText } from "@/components/ui/encrypted-text";
import MaskRevealUp from "@/components/ui/smoothui/mask-reveal-up";
import { useStyleWorld } from "@/lib/style-world-context";
import { useEffect, useState } from "react";

/**
 * Animasi lokal untuk baris tanggal + sapaan di home dashboard.
 * Scifi memakai efek terenkripsi; world lain memakai mask reveal naik.
 */
export function HomeGreeting({
  dateLabel,
  greeting,
}: {
  dateLabel: string;
  greeting: string;
}) {
  const { world } = useStyleWorld();
  const isScifi = world === "scifi";

  // EncryptedText menghasilkan karakter acak saat render awal. Tunggu mount
  // supaya hasil server dan klien tidak berbeda (hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const useEncrypted = isScifi && mounted;

  return (
    <div>
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
        {useEncrypted ? (
          <EncryptedText
            text={dateLabel}
            revealDelayMs={28}
            flipDelayMs={45}
            encryptedClassName="text-primary/70"
          />
        ) : (
          <MaskRevealUp lines={[dateLabel]} perWord stagger={70} />
        )}
      </div>
      <h1 className="mt-1 font-heading text-[2rem] font-normal leading-tight tracking-[-0.03em] sm:text-[2.5rem]">
        {useEncrypted ? (
          <EncryptedText
            text={greeting}
            revealDelayMs={45}
            flipDelayMs={45}
            encryptedClassName="text-primary/70"
          />
        ) : (
          <MaskRevealUp lines={[greeting]} delay={90} perWord stagger={70} />
        )}
      </h1>
    </div>
  );
}
