import { beforeEach, vi } from 'vitest'
import { mockReset, mockDeep } from 'vitest-mock-extended'
import { PrismaClient } from '@prisma/client'

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>()

// Mock the prisma module
vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock
}))

// Reset all mocks before each test
beforeEach(() => {
  mockReset(prismaMock)
})

// Mock console methods to reduce noise in tests (optional)
// vi.spyOn(console, 'log').mockImplementation(() => {})
// vi.spyOn(console, 'error').mockImplementation(() => {})
