import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // @ts-ignore
    turbopack: {
      root: "/Users/fukumotoshogo/Downloads/ria-web",
    },
  },
};

export default nextConfig;
