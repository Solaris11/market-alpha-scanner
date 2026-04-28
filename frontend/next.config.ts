import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "100.68.155.121",
    "http://100.68.155.121:3001",
    "192.168.0.125",
    "http://192.168.0.125:3001",
  ],
};

export default nextConfig;
