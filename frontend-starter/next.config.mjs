/** @type {import('next').NextConfig} */
const nextConfig = {
  // The app calls the n8n webhooks directly from the browser, so no rewrites are needed.
  experimental: {
    // Turbopack would otherwise keep a file cache under .next/ that can hold values from the
    // shell environment and from .env.local in plain text. The cache only saves build time.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
