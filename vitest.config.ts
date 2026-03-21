import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'modules/**/*.ts',
        'lib/**/*.ts'
      ],
      exclude: [
        'node_modules',
        'tests',
        '**/*.d.ts',
        '**/index.ts'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@prisma/client-radius': path.resolve(__dirname, './prisma/generated/radius'),
      '@prisma/client-billing': path.resolve(__dirname, './prisma/generated/billing'),
      '@prisma/client-mitra': path.resolve(__dirname, './prisma/generated/mitra')
    }
  }
})
