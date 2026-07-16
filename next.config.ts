import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // Disable PWA in development to prevent page reload loop
  // For testing push notifications, use: npm run build && npm start
  disable: process.env.NODE_ENV === "development",
  register: true,
  customWorkerSrc: "worker",
  customWorkerDest: "public",
  customWorkerPrefix: "worker",
  publicExcludes: ["!uploads/**", "!uploads/attendance/**"],
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
        handler: "NetworkFirst",
        options: {
          cacheName: "uploads-cache",
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
      ({ asset }) => {
        // Exclude anything in /uploads folder
        if (asset.name.includes("uploads/")) return true;
        // Exclude attendance specifically
        if (asset.name.includes("attendance/")) return true;
        // Exclude source maps
        if (asset.name.endsWith(".map")) return true;
        return false;
      },
      /\/uploads\/.*/,
      /\.map$/,
      /\/uploads\/attendance\/.*/,
    ],
    manifestTransforms: [
      async (entries) => ({
        manifest: entries.filter(
          (entry) =>
            ![
              "/_next/build-manifest.json",
              "/_next/react-loadable-manifest.json",
              "/_next/server/middleware-build-manifest.js",
              "/_next/server/middleware-react-loadable-manifest.js",
              "/_next/server/next-font-manifest.js",
              "/_next/server/next-font-manifest.json",
            ].includes(entry.url),
        ),
      }),
    ],
  },
});

const isDev = process.env.NODE_ENV === "development";
const firebaseRtdbHostPattern =
  "https://*.asia-southeast1.firebasedatabase.app";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "qrcode",
    "jimp",
    "sharp",
  ],
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,
  // Standalone output hanya untuk Docker production build.
  // Di dev, mode ini menambah overhead trace dependency yang tidak perlu.
  ...(isDev ? {} : { output: "standalone" as const }),
  // outputFileTracingIncludes hanya relevan untuk standalone build (production).
  // Di dev, list 40+ pattern node_modules ini bikin Turbopack lambat resolve.
  outputFileTracingIncludes: isDev
    ? undefined
    : {
        "/api/:path*": [
          "prisma.config.ts",
          "prisma.radius.config.ts",
          "prisma.billing.config.ts",
          "prisma.mitra.config.ts",
          "prisma/*.prisma",
          "prisma/schema.prisma",
          "prisma/schema.radius.prisma",
          "prisma/billing.prisma",
          "prisma/mitra.prisma",
          "node_modules/prisma/**",
          "node_modules/@prisma/**",
          "node_modules/valibot/**",
          "node_modules/pathe/**",
          "node_modules/remeda/**",
          "node_modules/std-env/**",
          "node_modules/zeptomatch/**",
          "node_modules/graphmatch/**",
          "node_modules/grammex/**",
          "node_modules/tsx/**",
          "node_modules/esbuild/**",
          "node_modules/@esbuild/**",
          "node_modules/get-tsconfig/**",
          "node_modules/source-map-support/**",
          "node_modules/buffer-from/**",
          "node_modules/effect/**",
          "node_modules/@standard-schema/spec/**",
          "node_modules/fast-check/**",
          "node_modules/deepmerge-ts/**",
          "node_modules/empathic/**",
          "node_modules/chokidar/**",
          "node_modules/jiti/**",
          "node_modules/defu/**",
          "node_modules/ohash/**",
          "node_modules/confbox/**",
          "node_modules/exsolve/**",
          "node_modules/giget/**",
          "node_modules/perfect-debounce/**",
          "node_modules/pkg-types/**",
          "node_modules/rc9/**",
          "node_modules/postgres/**",
          "node_modules/mysql2/**",
          "node_modules/arg/**",
          "node_modules/dotenv/**",
          "node_modules/cross-spawn/**",
          "node_modules/cli-cursor/**",
          "node_modules/restore-cursor/**",
          "node_modules/hono/**",
          "node_modules/@hono/**",
          "node_modules/proper-lockfile/**",
          "node_modules/graceful-fs/**",
          "node_modules/retry/**",
          "node_modules/signal-exit/**",
          "node_modules/fs-extra/**",
          "node_modules/@mrleebo/**",
          "node_modules/@electric-sql/**",
          "node_modules/undici/**",
        ],
      },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "**.radpro.id" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "cdn.radpro.id" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "**" },
    ],
    // Disable image optimization in staging/production to avoid 400 errors from external domains
    // and reduce server CPU usage.
    unoptimized: process.env.NODE_ENV === "production",
  },
  // Enable gzip compression for API responses
  compress: true,
  reactStrictMode: true,

  // Increase body size limits for large uploads.
  experimental: {
    serverActions: {
      bodySizeLimit: "1gb",
    },
    proxyClientMaxBodySize: "1gb",
    // Filesystem cache untuk dev — compile result di-persist antar restart, bukan in-memory only.
    // Ini paling impactful untuk project besar dengan banyak route.
    turbopackFileSystemCacheForDev: true,
    // Persist Turbopack compile cache untuk production build di .next/cache/turbopack/.
    // BuildKit cache mount di Dockerfile menarget /app/.next/cache — cache ini tertangkap.
    // Warm build (run kedua+) skip recompile modul yang tidak berubah.
    turbopackFileSystemCacheForBuild: true,
    // Catatan: turbopackTreeShaking + turbopackRemoveUnusedImports/Exports
    // memicu Rust panic "index out of bounds" di Next 16.2.2 (bug upstream).
    // Re-evaluasi saat upgrade Next.
  },

  // TypeScript sudah dijalankan di Jenkins QC stage (npm run typecheck).
  // Saat build Docker, SKIP_TS_CHECK=true dilewatkan via build-arg supaya
  // next build tidak menjalankan typecheck lagi (hemat ~2.5 menit).
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TS_CHECK === "true",
  },

  // Webpack configuration to suppress known non-critical warnings.
  // Catatan: Turbopack (default di `next dev`) tidak baca config ini.
  // Webpack hanya jalan saat `next build` (production) atau jika Turbopack di-disable.
  webpack: (config, { isServer, dev }) => {
    config.ignoreWarnings = [
      /UNSAFE_componentWillReceiveProps/,
      /componentWillReceiveProps/,
      /ModelCollapse/,
      /Critical dependency: the request of a dependency is an expression/,
    ];

    // Optimasi splitChunks hanya untuk production build (mengurangi bundle size FE).
    // Di dev, splitChunks justru memperlambat compile karena overhead chunking.
    if (!isServer && !dev) {
      config.optimization = {
        ...config.optimization,
        moduleIds: "deterministic",
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            commons: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendors",
              chunks: "all",
              priority: 10,
              maxSize: 244000,
            },
          },
        },
      };
    }

    // parallelism adaptif berdasarkan CPU — lebih andal daripada RAM karena
    // os.totalmem() membaca RAM host (bukan cgroup limit container),
    // berisiko OOM jika host > 32GB tapi container di-cap 8GB.
    // availableParallelism() cgroup-aware di Node >=18.14; cap di 4 untuk aman.
    if (!dev) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const os = require("os") as typeof import("os");
      const cpus = os.availableParallelism?.() ?? os.cpus().length;
      const safe = Math.min(cpus, 4);
      config.parallelism = safe >= 4 ? 4 : safe >= 2 ? 2 : 1;
    }

    return config;
  },

  // CORS Configuration
  async headers() {
    // Employee portal URL for CORS (development or production)
    const employeePortalUrl =
      process.env.EMPLOYEE_PORTAL_URL || "http://localhost:3001";

    return [
      {
        // CORS for Employee Auth API (public endpoints for login/refresh)
        source: "/api/employee-auth/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: employeePortalUrl },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Requested-With",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      {
        // CORS for Employee API endpoints
        source: "/api/employee/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: employeePortalUrl },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Requested-With",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      {
        // CORS for Settings public API (for employee portal branding)
        source: "/api/settings/public",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: employeePortalUrl },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${firebaseRtdbHostPattern}`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              `script-src-elem 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${firebaseRtdbHostPattern}`,
              "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              `connect-src 'self' https: ws: wss: localhost:* 127.0.0.1:* ${firebaseRtdbHostPattern}`,
              `frame-src 'self' ${firebaseRtdbHostPattern}`,
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "media-src 'self' blob: data:",
              "manifest-src 'self'",
              "worker-src 'self' blob:",
              "frame-src 'self'",
              "child-src 'self'",
            ]
              .filter(Boolean)
              .join("; "),
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
