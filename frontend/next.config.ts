import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.0.125",
    "http://192.168.0.125:3001",
  ],
};

export default nextConfig;
