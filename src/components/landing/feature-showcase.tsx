"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    title: "Tampilan Mudah digunakan",
    description: "Disesuaikan kebutuhan setiap role dari owner, teknisi & Frontliner",
  },
  {
    title: "Fitur Whatsapp otomatisasi",
    description: "Mengirim Pesan otomatis ke pelanggan dan ke teknisi untuk informasi servis",
  },
  {
    title: "Laporan Lengkap",
    description: "Laporan Shift harian, laporan keuangan, cashflow, laporan stok dan lainya.",
  },
] as const;

// Urutan harus sejajar dengan FEATURES: klik teks mengarah ke gambar index
// yang sama, dan IntersectionObserver menyorot teks sesuai gambar terlihat.
const FEATURE_IMAGES = [
  "/originkit/feature-tampilan.png",
  "/originkit/feature-wa.png",
  "/originkit/feature-laporan.png",
] as const;

export function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const index = imageRefs.current.indexOf(visible.target as HTMLDivElement);
          if (index >= 0) setActive(index);
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    imageRefs.current.forEach((element) => {
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const goTo = (index: number) => {
    setActive(index);
    imageRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="border-t px-4 pt-16 pb-24 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col divide-y divide-border">
            {FEATURES.map((feature, index) => (
              <button
                key={feature.title}
                type="button"
                onClick={() => goTo(index)}
                aria-current={active === index ? "step" : undefined}
                className="py-5 text-left transition-colors"
              >
                <h3
                  className={cn(
                    "text-base font-medium md:text-lg",
                    active === index ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              ref={(element) => {
                imageRefs.current[index] = element;
              }}
              className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border bg-muted/40"
            >
              <Image
                src={FEATURE_IMAGES[index]}
                alt={feature.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeatureShowcase;
