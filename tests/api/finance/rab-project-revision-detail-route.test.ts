import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prismaMock } from '@/tests/setup'

const { mockHasPermission, mockIsSuperAdmin } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockIsSuperAdmin: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/auth', () => ({
  isSuperAdmin: mockIsSuperAdmin,
}))

vi.mock('@/lib/rbac', () => ({
  hasPermission: mockHasPermission,
}))

vi.mock('@/lib/api', () => ({
  createHandler:
    (
      _options: unknown,
      handler: (
        req: NextRequest,
        ctx: { params: Record<string, string>; session: { user: { id: string } } },
      ) => Promise<Response>,
    ) =>
    async (
      request: NextRequest,
      { params }: { params?: Promise<Record<string, string>> },
    ) =>
      handler(request, {
        params: (await params) ?? {},
        session: { user: { id: 'user-1' } },
      }),
  apiSuccess: (data: unknown) => NextResponse.json({ success: true, data }),
  ApiErrors: {
    forbidden: (message: string) => NextResponse.json({ error: message }, { status: 403 }),
    notFound: (message: string) => NextResponse.json({ error: message }, { status: 404 }),
    badRequest: (message: string) => NextResponse.json({ error: message }, { status: 400 }),
  },
}))

import { GET, PATCH } from '@/app/api/finance/rab-projects/[id]/revisions/[revisionId]/route'
import { POST } from '@/app/api/finance/rab-projects/[id]/revisions/[revisionId]/submit/route'

describe('rab project revision detail route', () => {
  beforeEach(() => {
    mockHasPermission.mockResolvedValue(true)
    mockIsSuperAdmin.mockReturnValue(false)
  })

  it('allows editing draft item prices and projected opex before submission', async () => {
    prismaMock.rabRevision.findUnique.mockResolvedValue({
      id: 'rev-1',
      rabProjectId: 'rab-1',
      status: 'DRAFT',
    })

    prismaMock.rabRevision.update.mockResolvedValue({
      id: 'rev-1',
      rabProjectId: 'rab-1',
      revisionNumber: 1,
      status: 'DRAFT',
      reason: null,
      notes: null,
      createdById: 'user-1',
      submittedById: null,
      submittedAt: null,
      approvedById: null,
      approvedAt: null,
      rejectedById: null,
      rejectedAt: null,
      totalCapex: 120_000n,
      totalOpex: 35_000n,
      createdAt: new Date('2026-03-13T00:00:00Z'),
      updatedAt: new Date('2026-03-13T00:30:00Z'),
      items: [
        {
          id: 'rev-item-1',
          rabRevisionId: 'rev-1',
          rabItemId: 'item-1',
          name: 'ODP',
          description: null,
          quantity: 2,
          unitPrice: 60_000n,
          totalPrice: 120_000n,
          category: 'HARDWARE',
          expenseType: 'CAPEX',
          expenseCategoryId: null,
          wbsId: null,
          sortOrder: 0,
        },
      ],
      approvals: [],
    })

    const response = await PATCH(
      new NextRequest('http://localhost/api/finance/rab-projects/rab-1/revisions/rev-1', {
        method: 'PATCH',
        body: JSON.stringify({
          projectedOpex: 35_000,
          notes: 'Update vendor pricing',
          items: [
            {
              rabItemId: 'item-1',
              name: 'ODP',
              description: null,
              quantity: 2,
              unitPrice: 60_000,
              category: 'HARDWARE',
              expenseType: 'CAPEX',
            },
          ],
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'rab-1', revisionId: 'rev-1' }) },
    )

    expect(response.status).toBe(200)
    expect(prismaMock.rabRevision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rev-1' },
        data: expect.objectContaining({
          totalCapex: 120_000n,
          totalOpex: 35_000n,
        }),
      }),
    )
  })

  it('requires a non-empty reason before submission', async () => {
    prismaMock.rabRevision.findUnique.mockResolvedValue({
      id: 'rev-1',
      rabProjectId: 'rab-1',
      status: 'DRAFT',
      items: [{ id: 'rev-item-1' }],
    })

    const response = await POST(
      new NextRequest('http://localhost/api/finance/rab-projects/rab-1/revisions/rev-1/submit', {
        method: 'POST',
        body: JSON.stringify({ reason: '' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'rab-1', revisionId: 'rev-1' }) },
    )

    expect(response.status).toBe(400)
  })

  it('returns one serialized revision snapshot', async () => {
    prismaMock.rabRevision.findUnique.mockResolvedValue({
      id: 'rev-1',
      rabProjectId: 'rab-1',
      revisionNumber: 1,
      status: 'DRAFT',
      reason: null,
      notes: null,
      createdById: 'user-1',
      submittedById: null,
      submittedAt: null,
      approvedById: null,
      approvedAt: null,
      rejectedById: null,
      rejectedAt: null,
      totalCapex: 100_000n,
      totalOpex: 25_000n,
      createdAt: new Date('2026-03-13T00:00:00Z'),
      updatedAt: new Date('2026-03-13T00:00:00Z'),
      items: [],
      approvals: [],
    })

    const response = await GET(new NextRequest('http://localhost/api/finance/rab-projects/rab-1/revisions/rev-1'), {
      params: Promise.resolve({ id: 'rab-1', revisionId: 'rev-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.totalCapex).toBe('100000')
  })
})
