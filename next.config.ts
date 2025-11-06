import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // App Router is default; ensure serverActions available when needed
  },
}

export default nextConfig


