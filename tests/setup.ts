/**
 * Test Setup
 * 
 * Setup untuk integration tests
 */

import { beforeAll, afterAll, beforeEach } from 'vitest'
import { cleanupTestDatabase } from '@/lib/test-utils'

// Setup sebelum semua tests
beforeAll(async () => {
  // Setup test database jika diperlukan
  // Misalnya: create test database, run migrations, dll
})

// Cleanup setelah semua tests
afterAll(async () => {
  // Hanya cleanup jika menggunakan test database
  // Atau jika di CI environment (dimana kita yakin menggunakan test database)
  if (process.env.TEST_DATABASE_URL || process.env.CI === 'true') {
    await cleanupTestDatabase()
  } else {
    // Di development, skip cleanup jika TEST_DATABASE_URL tidak di-set
    // untuk menghindari kehilangan data development
    console.warn('⚠️  TEST_DATABASE_URL tidak di-set, skip cleanup untuk menghindari kehilangan data development')
    console.warn('⚠️  Setup TEST_DATABASE_URL untuk auto-cleanup setelah tests')
  }
})

// Cleanup sebelum setiap test (optional)
// Uncomment jika ingin clean database sebelum setiap test
// beforeEach(async () => {
//   await cleanupTestDatabase()
// })

