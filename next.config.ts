import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones on the LAN hit the dev server by IP; without this Next 15 warns on
  // every cross-origin dev request and blocks HMR assets.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.0.0/16",
    "10.0.0.0/8",
    "172.16.0.0/12",
    "*.local",
  ],
};

export default nextConfig;
