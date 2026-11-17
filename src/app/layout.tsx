import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SoundLayer } from "@/components/layout/sound-layer";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cervise — Manajemen Servis Gadget Multibranch",
  description:
    "Cervise: aplikasi manajemen servis gadget untuk Frontliner & Teknisi. Multibranch, ringan di HP, kelola servis, customer, keuangan & laporan. Garansi 3 bulan.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

/**
 * Script no-flash tema, dijalankan sebelum paint lewat `next/script`.
 *
 * Tag script React biasa langsung di dalam komponen memicu peringatan
 * "Encountered a script tag while rendering React component" dan tidak
 * dijamin dieksekusi saat client rendering. `next/script` dengan
 * strategy `beforeInteractive` menyuntikkan script ke HTML awal sebelum
 * hydration, jadi tetap no-flash tanpa peringatan React.
 *
 * next-themes juga merender script serupa dari client component; salinan itu
 * dimatikan lewat `scriptProps` bertipe non-JavaScript.
 * Harus sama dengan storageKey + attribute ThemeProvider di bawah.
 */
const THEME_SCRIPT = `!function(){try{var e=localStorage.getItem("cervise-theme")||"system",t=e==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":e,d=document.documentElement;d.classList.remove("light","dark"),d.classList.add(t),d.style.colorScheme=t}catch(e){}}()`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Disuntikkan sebelum hydration, jadi tidak ada kedip tema. */}
        <Script id="cervise-theme-no-flash" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        {/* enableSystem wajib true supaya opsi "Sistem" di ThemeToggle benar-benar
            mengikuti prefers-color-scheme; dengan false, pilihan itu diam-diam
            diabaikan. defaultTheme "system" juga menghormati setelan OS dari
            kunjungan pertama, tanpa memaksa light. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="cervise-theme"
          disableTransitionOnChange={false}
          scriptProps={{ type: "application/json" }}
        >
          <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
          <SoundLayer />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
