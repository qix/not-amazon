import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	  allowedDevOrigins: ['172.16.50.130', '100.87.242.107'],

  serverExternalPackages: ["sharp", "sql.js"],
};

export default nextConfig;
