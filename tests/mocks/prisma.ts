import type { PrismaClient } from '@prisma/client'
import { mockDeep } from 'vitest-mock-extended'
import type { DeepMockProxy } from 'vitest-mock-extended'

export type MockPrismaClient = DeepMockProxy<PrismaClient>

export const createMockPrisma = (): MockPrismaClient => {
  return mockDeep<PrismaClient>()
}

// Re-export from setup for convenience
export { prismaMock } from '../setup'
