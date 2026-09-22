import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/app/inventory", destination: "/app/sparepart", permanent: true }];
  },
};

export default nextConfig;
