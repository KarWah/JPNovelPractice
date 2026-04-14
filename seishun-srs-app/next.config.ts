import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Local /public images work without config; add external domains here as needed
    remotePatterns: [],
  },
};

export default nextConfig;
