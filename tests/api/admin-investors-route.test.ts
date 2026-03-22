import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prismaMock } from '../setup'

// Mock dependencies
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    createHandler: vi.fn((options, handler) => {
      // Store options on the handler for testing
      const wrappedHandler = async (req: NextRequest & { clone: () => NextRequest }, ctx: { validated?: unknown }) => {
        // Inject validated data if schema exists
        if (options.schema && req.json) {
            try {
                const body = await req.clone().json()
                ctx.validated = options.schema.parse(body)
            } catch (_e) {
                // simple mock validation logic
            }
        }
        return handler(req, ctx)
      };
      (wrappedHandler as unknown as { options: unknown }).options = options
      return wrappedHandler
    }),
    apiSuccess: vi.fn((data, options) => NextResponse.json({ success: true, data }, options)),
    ApiErrors: {
      badRequest: vi.fn((msg) => NextResponse.json({ success: false, error: msg }, { status: 400 })),
    }
  }
})

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password'),
}))

import { GET, POST } from '@/app/api/admin/investors/route'

describe('Investors API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET Handler', () => {
    it('should have correct permissions', () => {
      expect((GET as unknown as { options: { permissions: string[] } }).options.permissions).toContain('investors:read')
    })

    it('should return safe investors list', async () => {
      const mockInvestors = [
        { id: '1', username: 'inv1', passwordHash: 'hash1', namaLengkap: 'Inv One' },
        { id: '2', username: 'inv2', passwordHash: 'hash2', namaLengkap: 'Inv Two' }
      ]
      prismaMock.investor.findMany.mockResolvedValue(mockInvestors as unknown as typeof mockInvestors)

      const request = new NextRequest('http://localhost/api/admin/investors')
      const response = await (GET as unknown as (req: Request, ctx: unknown) => Promise<NextResponse>)(request, { permissions: ['investors:read'] })
      const json = await response.json() as { success: boolean, data: Array<{ username: string, passwordHash?: string }> }

      expect(json.success).toBe(true)
      expect(json.data[0]).not.toHaveProperty('passwordHash')
      expect(json.data[0].username).toBe('inv1')
    })
  })

  describe('POST Handler', () => {
    it('should have correct permissions and schema', () => {
      const postHandler = POST as unknown as { options: { permissions: string[], schema: unknown } }
      expect(postHandler.options.permissions).toContain('investors:create')
      expect(postHandler.options.schema).toBeDefined()
    })

    it('should create an investor and not store plaintext password', async () => {
      const payload = {
        username: 'newinv',
        password: 'password123',
        namaLengkap: 'New Investor',
        email: 'new@example.com'
      }
      
      const mockCreated = { ...payload, id: 'new-id', passwordHash: 'hashed_password' }
      delete (mockCreated as Partial<typeof payload>).password
      
      prismaMock.investor.findUnique.mockResolvedValue(null)
      prismaMock.investor.create.mockResolvedValue(mockCreated as unknown as typeof mockCreated)

      const request = new NextRequest('http://localhost/api/admin/investors', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      const response = await (POST as unknown as (req: Request, ctx: unknown) => Promise<NextResponse>)(request, { validated: payload })
      const json = await response.json() as { success: boolean }

      expect(json.success).toBe(true)
      expect(prismaMock.investor.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          username: 'newinv',
          passwordHash: 'hashed_password'
        })
      }))
      
      // Ensure 'password' is not in the data object
      const createCall = prismaMock.investor.create.mock.calls[0][0] as { data: Record<string, unknown> }
      expect(createCall.data).not.toHaveProperty('password')
    })

    it('should fail if password is missing', async () => {
        const payload = {
          username: 'newinv',
          namaLengkap: 'New Investor',
          email: 'new@example.com'
        }

        const request = new NextRequest('http://localhost/api/admin/investors', {
          method: 'POST',
          body: JSON.stringify(payload)
        })

        const response = await (POST as unknown as (req: Request, ctx: unknown) => Promise<NextResponse>)(request, { validated: payload })
        const json = await response.json() as { error: string }

        expect(response.status).toBe(400)
        expect(json.error).toContain('Password wajib diisi')
    })
  })
})
