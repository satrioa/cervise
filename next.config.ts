import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Tunnel dev (ngrok) punya hostname acak per sesi, jadi pakai wildcard.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app"],
  // Logo memakai `?v=2` sebagai cache-buster ketika file diganti.
  images: {
    localPatterns: [
      { pathname: "/**" },
      { pathname: "/Logo/**", search: "?v=2" },
    ],
  },
  async redirects() {
    return [{ source: "/app/inventory", destination: "/app/sparepart", permanent: true }];
  },
};

export default withNextIntl(nextConfig);
