import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SoundLayer } from "@/components/layout/sound-layer";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "next-themes";

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
 * Script no-flash tema, dijalankan server sebelum paint.
 *
 * next-themes merender script-nya sendiri dari client component; React 19.2
 * memperingatkan setiap `<script>` yang dibuat di client (upstream issue
 * pacocoursey/next-themes#385). Karena script itu hanya berguna sebelum
 * hydration, versi server ini yang dipakai dan salinan milik provider
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
        {/* Dijalankan sebelum body selesai di-parse, jadi tidak ada kedip tema. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
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
