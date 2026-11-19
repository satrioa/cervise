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

const GRADIENT_COLORS = ["#B4D1F6"];

export function CustomPackageCta() {
  const href = buildCustomPackageWhatsAppUrl(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP);
  const external = href.startsWith("http");

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <section className="relative isolate overflow-hidden rounded-2xl bg-[#4194fa] px-6 py-14 text-center text-white sm:py-16">
        <div aria-hidden="true" className="absolute inset-0 z-0">
          <AnimatedGradient colors={GRADIENT_COLORS} speed={10} blur="medium" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-4">
          <h2 className="text-balance text-2xl font-bold sm:text-3xl">
            Siap tumbuhkan bisnis dengan solusi sistem Manajemen Servis Gadget Multibranch?
          </h2>
          <p className="max-w-2xl text-sm text-white/90 sm:text-base">
            dikembangkan khusus untuk toko servis dan jual beli gadget untuk operasional yang terstruktur dan mempunyai laporan yang rapi.
          </p>
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-white bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-blue-700"
          >
            Chat Admin WhatsApp
            <MessageCircleIcon className="size-4" aria-hidden />
          </a>
        </div>
      </section>
    </div>
  );
}

export default CustomPackageCta;
