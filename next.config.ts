import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  poweredByHeader: false,
  basePath: process.env.BASE_PATH === 'root' ? undefined : process.env.BASE_PATH ?? '/config',
};

export default nextConfig;
