"use client";

import dynamic from "next/dynamic";
import { WhatsappLogoIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Magnetic } from "@/components/ui/magnetic";
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

        <div className="relative z-10 flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:text-left">
          <div className="flex flex-col gap-3">
            <h2 className="text-balance text-2xl font-bold sm:text-3xl">
              Siap tumbuhkan bisnis dengan solusi sistem Manajemen Servis Gadget Multibranch?
            </h2>
            <p className="max-w-2xl text-sm text-white/90 sm:text-base">
              dikembangkan khusus untuk toko servis dan jual beli gadget untuk operasional yang terstruktur dan mempunyai laporan yang rapi.
            </p>
          </div>
          <Magnetic>
            <Button
              variant="candy"
              size="lg"
              shape="pill"
              className="shrink-0 [--btn:#ffffff] [--btn-fg:#1d4ed8] [--btn-hover:#dbeafe] shadow-lg"
              render={
                <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
                  Chat Admin WhatsApp
                  <WhatsappLogoIcon weight="fill" aria-hidden />
                </a>
              }
            />
          </Magnetic>
        </div>
      </section>
    </div>
  );
}

export default CustomPackageCta;
