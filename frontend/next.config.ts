import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
  // Forward /images/* to ComfyUI output via Nginx, allow unoptimized direct src
  reactStrictMode: true,
};

export default nextConfig;
