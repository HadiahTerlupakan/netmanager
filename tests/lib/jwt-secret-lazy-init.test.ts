import { beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  vi.doUnmock('@/lib/jwt')
  process.env = { ...originalEnv, NODE_ENV: 'production' }
  delete process.env.NEXTAUTH_SECRET
  delete process.env.AUTH_SECRET
})

describe('JWT secret lazy init', () => {
  it('imports jwt helpers without throwing before a token operation is invoked', async () => {
    const jwtModule = await vi.importActual<typeof import('@/lib/jwt')>('@/lib/jwt')

    expect(jwtModule).toBeDefined()
    expect(() => jwtModule.verifyPelangganAccessToken('invalid-token')).not.toThrow()
    expect(() => jwtModule.generatePelangganAccessToken({
      id: '1',
      idPelanggan: '00000001',
      nama: 'Test',
      username: 'test',
      status: 'AKTIF',
    })).toThrow('[SECURITY] NEXTAUTH_SECRET environment variable is required in production!')
  })
})
