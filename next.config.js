/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Optimize for Playwright
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'playwright'];
    }
    return config;
  },
  // Ensure proper output for Vercel
  output: 'standalone',
}

module.exports = nextConfig
