import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Next picks this project as the workspace root even if parent folders
  // contain other lockfiles.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
