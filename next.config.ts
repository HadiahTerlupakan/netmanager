import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // App Router is default; ensure serverActions available when needed
    // Suppress middleware deprecation warning (middleware.ts is still supported)
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // CORS Configuration
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "media-src 'self'",
              "manifest-src 'self'",
              "worker-src 'self' blob:",
              "frame-src 'self'",
              "child-src 'self'",
            ].filter(Boolean).join('; ')
          }
        ],
      },
    ]
  },
}

// Tambahkan kondisi untuk tidak menggunakan PWA di development environment
if (process.env.NODE_ENV === 'development') {
  console.log('PWA disabled in development environment to avoid potential shell execution warnings')
  module.exports = nextConfig
} else {
  const withPWA = require("@ducanh2912/next-pwa")
  module.exports = withPWA({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
    register: true,
  })(nextConfig)
}


