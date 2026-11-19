"use client";

import dynamic from "next/dynamic";
import { MessageCircleIcon } from "lucide-react";
import { buildCustomPackageWhatsAppUrl } from "@/lib/custom-package-whatsapp";

// Gradient memakai Math.random() saat render, jadi hanya dipasang di client
// agar tidak memicu hydration mismatch.
const AnimatedGradient = dynamic(
  () => import("@/components/fancy/background/animated-gradient-with-svg"),
  { ssr: false },
);

const GRADIENT_COLORS = ["#2563EB", "#7C3AED", "#EC4899"];

export function CustomPackageCta() {
  const href = buildCustomPackageWhatsAppUrl(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP);
  const external = href.startsWith("http");

  return (
    <section className="relative isolate overflow-hidden border-t bg-slate-950 py-16 text-white sm:py-20">
      <div aria-hidden="true" className="absolute inset-0 z-0">
        <AnimatedGradient colors={GRADIENT_COLORS} speed={10} blur="medium" />
      </div>
      <div aria-hidden="true" className="absolute inset-0 z-0 bg-slate-950/60" />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 text-center sm:px-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/70">
          Butuh paket custom?
        </span>
        <h2 className="text-balance text-3xl font-bold sm:text-4xl">
          Paket yang pas untuk kebutuhan toko Anda
        </h2>
        <p className="max-w-2xl text-sm text-white/80 sm:text-base">
          Punya banyak cabang, alur servis khusus, atau butuh integrasi? Ceritakan kebutuhan Anda — kami bantu susun paketnya.
        </p>
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-white bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-blue-700"
        >
          <MessageCircleIcon className="size-4" aria-hidden />
          Chat Admin WhatsApp
        </a>
      </div>
    </section>
  );
}

export default CustomPackageCta;
