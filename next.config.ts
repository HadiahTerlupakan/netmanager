import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  // Disable PWA in development to prevent page reload loop
  // For testing push notifications, use: npm run build && npm start
  disable: process.env.NODE_ENV === 'development',
  register: true,
  customWorkerSrc: 'worker',
  customWorkerDest: 'public',
  customWorkerPrefix: 'worker',
})

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  reactStrictMode: true,
  // Next.js 16: serverActions configuration is now handled differently
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
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https: ws: wss: localhost:* 127.0.0.1:*",
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

export default withPWA(nextConfig)
