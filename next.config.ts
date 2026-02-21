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
  // Exclude uploads folder from precaching (files are stored in CDN/R2)
  // This prevents 404 errors when files are moved/deleted
  workboxOptions: {
    // Skip waiting - immediately activate new service worker
    skipWaiting: true,
    // Clean up outdated caches to prevent bad-precaching-response errors
    cleanupOutdatedCaches: true,
    // Immediately claim clients
    clientsClaim: true,
    runtimeCaching: [
      {
        // Cache images from uploads on-demand with CacheFirst fallback to network
        urlPattern: /\/uploads\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'uploads-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
          networkTimeoutSeconds: 10,
          // Use background sync for failed requests
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
    // Exclude these patterns from precaching
    exclude: [
      /\/uploads\/.*/,
      /\.map$/,
      // Exclude attendance photos specifically
      /\/uploads\/attendance\/.*/,
    ],
  },
})

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  // output: 'standalone', // Disabled because we use a custom server (server.ts)
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: '192.168.**' },
      { protocol: 'http', hostname: '10.**' },
      { protocol: 'http', hostname: '192.168.1.100' },
      { protocol: 'http', hostname: '**' },
      { protocol: 'https', hostname: '**.radpro.id' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: 'cdn.radpro.id' },
      { protocol: 'https', hostname: '**' }
    ],
    // Enable image optimization
    unoptimized: false,
  },
  // Enable gzip compression for API responses
  compress: true,
  reactStrictMode: true,

  // Increase body size limit for APK uploads (default 1MB -> 100MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '1gb',
    },
  },

  // Webpack configuration to suppress React warnings and remove console.log in production
  webpack: (config, { isServer, dev }) => {
    // Suppress React UNSAFE_componentWillReceiveProps warnings from swagger-ui-react
    if (!isServer) {
      config.ignoreWarnings = [
        /UNSAFE_componentWillReceiveProps/,
        /componentWillReceiveProps/,
        /ModelCollapse/
      ]
    }

    // Remove console.log in production (keep console.error and console.warn)
    if (!dev && !isServer) {
      const TerserPlugin = require('terser-webpack-plugin')
      config.optimization.minimizer = config.optimization.minimizer || []
      config.optimization.minimizer.push(
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: false, // Don't drop all console
              pure_funcs: ['console.log', 'console.debug', 'console.info'], // Only drop these
            },
          },
        })
      )
    }

    return config
  },

  // CORS Configuration
  async headers() {
    // Employee portal URL for CORS (development or production)
    const employeePortalUrl = process.env.EMPLOYEE_PORTAL_URL || 'http://localhost:3001'

    return [
      {
        // CORS for Employee Auth API (public endpoints for login/refresh)
        source: '/api/employee-auth/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: employeePortalUrl },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      {
        // CORS for Employee API endpoints
        source: '/api/employee/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: employeePortalUrl },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      {
        // CORS for Settings public API (for employee portal branding)
        source: '/api/settings/public',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: employeePortalUrl },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
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
            value: 'camera=(self), microphone=(self), geolocation=(self)'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https: ws: wss: localhost:* 127.0.0.1:*",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "media-src 'self' blob: data:",
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
