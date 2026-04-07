import { beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  vi.doUnmock('@/lib/prisma')
  vi.doUnmock('@/lib/prisma-billing')
  vi.doUnmock('@/lib/prisma-radius')
  vi.doUnmock('@/lib/prisma-mitra')
  vi.doMock('dotenv/config', () => ({}))
  process.env = { ...originalEnv }
  delete process.env.DATABASE_URL
  delete process.env.DATABASE_URL_BILLING
  delete process.env.DATABASE_URL_MITRA
  delete process.env.RADIUS_DATABASE_URL
})

const importActual = async <T>(path: string): Promise<T> => vi.importActual(path) as Promise<T>

describe('Prisma env lazy init', () => {
  it('imports prisma module without throwing before the client is accessed', async () => {
    const prismaModule = await importActual<typeof import('@/lib/prisma')>('@/lib/prisma')

    expect(prismaModule).toBeDefined()
    expect(() => Reflect.get(prismaModule.prisma, '$connect')).toThrow('DATABASE_URL is not set in environment variables')
  })

  it('imports billing prisma module without throwing before the client is accessed', async () => {
    const prismaBillingModule = await importActual<typeof import('@/lib/prisma-billing')>('@/lib/prisma-billing')

    expect(prismaBillingModule).toBeDefined()
    expect(() => Reflect.get(prismaBillingModule.prismaBilling, '$connect')).toThrow('DATABASE_URL_BILLING is not set in environment variables')
  })

  it('imports radius prisma module without throwing before the client is accessed', async () => {
    const prismaRadiusModule = await importActual<typeof import('@/lib/prisma-radius')>('@/lib/prisma-radius')

    expect(prismaRadiusModule).toBeDefined()
    expect(() => Reflect.get(prismaRadiusModule.prismaRadius, '$connect')).toThrow('RADIUS_DATABASE_URL is not set in environment variables')
  })

  it('imports mitra prisma module without throwing before the client is accessed', async () => {
    const prismaMitraModule = await importActual<typeof import('@/lib/prisma-mitra')>('@/lib/prisma-mitra')

    expect(prismaMitraModule).toBeDefined()
    expect(() => Reflect.get(prismaMitraModule.prismaMitra, '$connect')).toThrow('DATABASE_URL_MITRA is not set in environment variables')
  })
})
