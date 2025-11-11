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
  // Cleanup test database
  await cleanupTestDatabase()
})

// Cleanup sebelum setiap test (optional)
// Uncomment jika ingin clean database sebelum setiap test
// beforeEach(async () => {
//   await cleanupTestDatabase()
// })

