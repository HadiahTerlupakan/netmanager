/**
 * Test Utilities
 * 
 * Helper functions untuk testing
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

/**
 * Test database client
 * Menggunakan DATABASE_URL dari environment atau test database
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
 */
export async function cleanupTestDatabase() {
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

