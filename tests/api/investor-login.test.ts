import { POST } from '@/app/api/investor/auth/login/route'
import { prismaMock } from '../setup'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { compare } from 'bcryptjs'

vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
}))

vi.mock('jose', () => {
  return {
    SignJWT: vi.fn().mockImplementation(() => {
      return {
        setProtectedHeader: vi.fn().mockReturnThis(),
        setIssuedAt: vi.fn().mockReturnThis(),
        setExpirationTime: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue('mocked-jwt-token'),
      }
    }),
  }
})

describe('Investor Login API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      // Un-comment to see errors
      console.log('[TEST-ERROR]', ...args)
    })
    process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-chars-long-standard'
  })

  it('should return 400 if username or password missing', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ username: 'test' }),
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toBe('Username dan Password wajib diisi')
  })

  it('should return 401 if investor not found', async () => {
    prismaMock.investor.findFirst.mockResolvedValue(null)
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ username: 'nonexistent', password: 'password' }),
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(401)
    expect(data.error).toBe('Username atau Password salah')
  })

  it('should return 401 if passwordHash is missing (verified legacy removal)', async () => {
    prismaMock.investor.findFirst.mockResolvedValue({
      id: '1',
      username: 'investor1',
      passwordHash: null,
      isActive: true,
    } as unknown as { id: string, username: string, passwordHash: string | null, isActive: boolean })

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ username: 'investor1', password: 'password' }),
    })
    const res = await POST(req)
    const data = await res.json() as { error: string }
    expect(res.status).toBe(401)
    expect(data.error).toBe('Username atau Password salah')
  })

  it('should return 401 if password does not match', async () => {
    prismaMock.investor.findFirst.mockResolvedValue({
      id: '1',
      username: 'investor1',
      passwordHash: 'hashed_pw',
      isActive: true,
    } as unknown as { id: string, username: string, passwordHash: string, isActive: boolean })
    (vi.mocked(compare) as Mock).mockResolvedValue(false)

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ username: 'investor1', password: 'wrongpassword' }),
    })
    const res = await POST(req)
    const data = await res.json() as { error: string }
    expect(res.status).toBe(401)
    expect(data.error).toBe('Username atau Password salah')
  })

  it('should return 200 and set cookie on successful login', async () => {
    const mockInvestor = {
      id: '1',
      username: 'investor1',
      passwordHash: 'hashed_pw',
      namaLengkap: 'Investor One',
      tenantId: 'tenant1',
      isActive: true,
    }
    prismaMock.investor.findFirst.mockResolvedValue(mockInvestor as unknown as { id: string, username: string, passwordHash: string, namaLengkap: string, tenantId: string, isActive: boolean })
    (vi.mocked(compare) as Mock).mockResolvedValue(true)

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ username: 'investor1', password: 'correctpassword' }),
    })
    const res = await POST(req)
    const data = await res.json() as { success: boolean, data: { user: { username: string } } }

    if (res.status === 500) {
      // Force log error if 500
      console.log('Failing with 500:', data)
    }

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.user.username).toBe('investor1')
    expect(res.headers.get('set-cookie')).toContain('investor_auth_token=mocked-jwt-token')
  })

  it('should return 403 if account is inactive', async () => {
    prismaMock.investor.findFirst.mockResolvedValue({
      id: '1',
      username: 'investor1',
      passwordHash: 'hashed_pw',
      isActive: false,
    } as unknown as { id: string, username: string, passwordHash: string, isActive: boolean })

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ username: 'investor1', password: 'password' }),
    })
    const res = await POST(req)
    const data = await res.json() as { error: string }
    expect(res.status).toBe(403)
    expect(data.error).toBe('Akun dinonaktifkan. Silakan hubungi Admin.')
  })
})
