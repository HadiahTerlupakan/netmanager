/**
 * Test Utilities
 * 
 * Helper functions untuk testing
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

/**
 * Test database client
 * Menggunakan TEST_DATABASE_URL jika tersedia, fallback ke DATABASE_URL
 * 
 * ⚠️ WARNING: Jika TEST_DATABASE_URL tidak di-set, akan menggunakan DATABASE_URL (development database)
 * Setup TEST_DATABASE_URL untuk menghindari kehilangan data development!
 */
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
  log: process.env.DEBUG ? ['query', 'error', 'warn'] : ['error'],
})

/**
 * Cleanup test database
 * 
 * ⚠️ WARNING: Function ini akan menghapus SEMUA data di database!
 * Pastikan menggunakan TEST_DATABASE_URL untuk menghindari kehilangan data development.
 */
export async function cleanupTestDatabase() {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
  
  // Safety check: Jangan hapus data development database tanpa konfirmasi
  if (!process.env.TEST_DATABASE_URL) {
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
    const isCI = process.env.CI === 'true'
    
    if (!isTestEnv && !isCI) {
      console.error('')
      console.error('⚠️  ⚠️  ⚠️  WARNING: TEST_DATABASE_URL tidak di-set! ⚠️  ⚠️  ⚠️')
      console.error('')
      console.error('Tests akan menggunakan DATABASE_URL (development database)')
      console.error('Cleanup akan menghapus SEMUA data di development database!')
      console.error('')
      console.error('Untuk menghindari kehilangan data:')
      console.error('1. Tambahkan TEST_DATABASE_URL di .env')
      console.error('2. Buat test database terpisah')
      console.error('3. Run migrations di test database')
      console.error('')
      throw new Error(
        'TEST_DATABASE_URL tidak di-set! ' +
        'Setup test database terpisah untuk menghindari kehilangan data development. ' +
        'Lihat docs/DATABASE_DATA_LOSS_FIX.md untuk instruksi lengkap.'
      )
    }
    
    // Di test environment atau CI, tetap warn tapi lanjutkan
    console.warn('⚠️  WARNING: TEST_DATABASE_URL tidak di-set, menggunakan DATABASE_URL')
    console.warn('⚠️  Cleanup akan menghapus data di development database!')
  }
  
  // Delete dalam urutan yang benar (menghindari foreign key constraint)
  await testPrisma.onu.deleteMany()
  await testPrisma.onuType.deleteMany()
  await testPrisma.speedProfile.deleteMany()
  await testPrisma.olt.deleteMany()
  await testPrisma.mikroTikRouter.deleteMany()
  await testPrisma.kmzFile.deleteMany()
  await testPrisma.joinboxOutput.deleteMany()
  await testPrisma.joinboxInput.deleteMany()
  await testPrisma.joinbox.deleteMany()
  await testPrisma.odpOutput.deleteMany()
  await testPrisma.odp.deleteMany()
  await testPrisma.odcOutput.deleteMany()
  await testPrisma.odc.deleteMany()
  await testPrisma.otbCore.deleteMany()
  await testPrisma.otb.deleteMany()
  await testPrisma.pole.deleteMany()
  await testPrisma.session.deleteMany()
  await testPrisma.user.deleteMany()
}

/**
 * Create test user
 */
export async function createTestUser(overrides?: {
  email?: string
  password?: string
  name?: string
  role?: 'USER' | 'ADMIN'
}) {
  const email = overrides?.email || `test-${Date.now()}@example.com`
  const password = overrides?.password || 'TestPassword123!'
  const passwordHash = await hash(password, 10)

  const user = await testPrisma.user.create({
    data: {
      email,
      passwordHash,
      name: overrides?.name || 'Test User',
      role: overrides?.role || 'ADMIN',
    },
  })

  return { ...user, password }
}

/**
 * Create test admin user
 */
export async function createTestAdmin() {
  return createTestUser({
    email: `admin-${Date.now()}@example.com`,
    password: 'AdminPassword123!',
    role: 'ADMIN',
  })
}

/**
 * Create test OLT
 */
export async function createTestOlt(overrides?: {
  name?: string
  ipAddress?: string
  telnetPassword?: string
}) {
  return testPrisma.olt.create({
    data: {
      name: overrides?.name || `Test OLT ${Date.now()}`,
      ipAddress: overrides?.ipAddress || `192.168.1.${Math.floor(Math.random() * 255)}`,
      type: 'ZTE-C300',
      telnetPassword: overrides?.telnetPassword || 'test-password',
    },
  })
}

/**
 * Create test MikroTik Router
 */
export async function createTestMikroTikRouter(overrides?: {
  name?: string
  ipAddress?: string
  apiPassword?: string
}) {
  return testPrisma.mikroTikRouter.create({
    data: {
      name: overrides?.name || `Test Router ${Date.now()}`,
      ipAddress: overrides?.ipAddress || `192.168.1.${Math.floor(Math.random() * 255)}`,
      apiUsername: 'admin',
      apiPassword: overrides?.apiPassword || 'test-password',
      secretRadius: 'test-secret',
    },
  })
}

/**
 * Mock NextAuth session untuk testing
 */
export function createMockSession(user: { id: string; email: string; role: string }) {
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

/**
 * Generate auth headers untuk testing
 * Note: Untuk Next.js App Router, kita perlu mock session di handler
 */
export function createAuthHeaders(token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return headers
}

