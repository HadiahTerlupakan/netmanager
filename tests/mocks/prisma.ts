import { vi } from 'vitest'
import type { MockPrismaClient } from '../setup'

/**
 * Creates a mock model with common Prisma operations
 */
const createMockModel = () => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  upsert: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn(),
  groupBy: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
})

/**
 * Creates a mock PrismaClient with common models mocked
 */
export const createMockPrisma = (): MockPrismaClient => {
  const mock = {
    user: createMockModel(),
    pelanggan: createMockModel(),
    invoice: createMockModel(),
    payment: createMockModel(),
    paket: createMockModel(),
    bandwidth: createMockModel(),
    mikrotikRouter: createMockModel(),
    attendance: createMockModel(),
    leave: createMockModel(),
    workOrder: createMockModel(),
    inventory: createMockModel(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(async (cb: (prisma: unknown) => Promise<unknown>) => {
      if (typeof cb === 'function') {
        return cb(mock)
      }
      return cb
    }),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  }
  return mock as unknown as MockPrismaClient
}

// Re-export from setup for convenience
export { prismaMock } from '../setup'
