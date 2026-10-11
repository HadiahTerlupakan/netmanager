import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Konfigurasi terpisah untuk tes integrasi DB nyata (`tests/db/`).
 *
 * Konfigurasi utama memasang `tests/setup.ts`, yang me-mock `@/lib/prisma`
 * secara global. Mock itu tepat untuk 968 berkas tes lainnya, tapi membuat tes
 * DB nyata mustahil: ia justru menukar hal yang mau dibuktikan. Jadi berkas di
 * `tests/db/` dikeluarkan dari konfigurasi utama dan dijalankan di sini dengan
 * setup-nya sendiri, tanpa satu pun mock Prisma.
 *
 * Berjalan serial: tes-tes ini menulis ke tabel yang sama.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./tests/db/setup.ts"],
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "node-cron": path.resolve(
        __dirname,
        "./node_modules/node-cron/dist/cjs/node-cron.js",
      ),
      "@prisma/client-radius": path.resolve(
        __dirname,
        "./prisma/generated/radius",
      ),
      "@prisma/client-billing": path.resolve(
        __dirname,
        "./prisma/generated/billing",
      ),
      "@prisma/client-mitra": path.resolve(
        __dirname,
        "./prisma/generated/mitra",
      ),
    },
    extensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"],
  },
});
