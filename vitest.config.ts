import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["modules/**/*.ts", "lib/**/*.ts"],
      exclude: ["node_modules", "tests", "**/*.d.ts", "**/index.ts"],
    },
    testTimeout: process.env.CI ? 20000 : 10000,
    hookTimeout: process.env.CI ? 30000 : 10000,
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
  },
});
