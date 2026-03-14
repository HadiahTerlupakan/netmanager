import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prismaMock } from '@/tests/setup'

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}))

vi.mock('next-auth/next', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  prismaAuth: prismaMock,
}))

import { POST as APPROVE } from '@/app/api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/approve/route'
import { POST as REJECT } from '@/app/api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/reject/route'

describe('rab revision approval route', () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'approver-1' } })
    prismaMock.$transaction.mockImplementation(
      async <T>(callback: (tx: typeof prismaMock) => Promise<T>) => callback(prismaMock),
    )
  })

  it('marks the revision approved and promotes it to the final baseline on first approval', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'approver-1',
      role: { canApproveRab: true, name: 'Finance', isSuperAdmin: false },
    })

    prismaMock.rabRevision.findUnique.mockResolvedValue({
      id: 'rev-2',
      rabProjectId: 'rab-1',
      status: 'PENDING_APPROVAL',
      approvals: [],
      project: { id: 'rab-1' },
    })
    prismaMock.rabRevisionApproval.count.mockResolvedValue(1)

    prismaMock.rabRevision.update.mockResolvedValue({
      id: 'rev-2',
      rabProjectId: 'rab-1',
      status: 'APPROVED',
      approvals: [{ userId: 'approver-1' }],
    })

    const response = await APPROVE(new NextRequest('http://localhost/api/revision/approve', { method: 'POST' }), {
      params: Promise.resolve({ id: 'rab-1', revisionId: 'rev-2' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.rabRevisionApproval.create).toHaveBeenCalled()
    expect(prismaMock.rabProject.update).toHaveBeenCalledWith({
      where: { id: 'rab-1' },
      data: { finalApprovedRevisionId: 'rev-2' },
    })
    expect(body.data.status).toBe('APPROVED')
  })

  it('records rejection without changing the final baseline pointer', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'approver-1',
      role: { canApproveRab: true, name: 'Finance', isSuperAdmin: false },
    })

    prismaMock.rabRevision.findUnique.mockResolvedValue({
      id: 'rev-2',
      rabProjectId: 'rab-1',
      status: 'PENDING_APPROVAL',
      approvals: [],
    })

    const response = await REJECT(
      new NextRequest('http://localhost/api/revision/reject', {
        method: 'POST',
        body: JSON.stringify({ notes: 'Harga tidak valid' }),
        headers: { 'content-type': 'application/json' },
      }),
      {
        params: Promise.resolve({ id: 'rab-1', revisionId: 'rev-2' }),
      },
    )

    expect(response.status).toBe(200)
    expect(prismaMock.rabProject.update).not.toHaveBeenCalled()
    expect(prismaMock.rabRevision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rev-2' },
        data: expect.objectContaining({ status: 'REJECTED' }),
      }),
    )
  })

  it('blocks approval while the revision is still a draft', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'approver-1',
      role: { canApproveRab: true, name: 'Finance', isSuperAdmin: false },
    })

    prismaMock.rabRevision.findUnique.mockResolvedValue({
      id: 'rev-3',
      rabProjectId: 'rab-1',
      status: 'DRAFT',
      approvals: [],
      project: { id: 'rab-1' },
    })

    const response = await APPROVE(new NextRequest('http://localhost/api/revision/approve', { method: 'POST' }), {
      params: Promise.resolve({ id: 'rab-1', revisionId: 'rev-3' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('diajukan terlebih dahulu')
    expect(prismaMock.rabRevisionApproval.create).not.toHaveBeenCalled()
  })

  it('promotes a stale pending revision that already has enough approvals', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'approver-1',
      role: { canApproveRab: true, name: 'Finance', isSuperAdmin: false },
    })

    prismaMock.rabRevision.findUnique.mockResolvedValue({
      id: 'rev-4',
      rabProjectId: 'rab-1',
      status: 'PENDING_APPROVAL',
      approvals: [{ userId: 'approver-1', status: 'APPROVED' }],
      project: { id: 'rab-1' },
    })

    const response = await APPROVE(new NextRequest('http://localhost/api/revision/approve', { method: 'POST' }), {
      params: Promise.resolve({ id: 'rab-1', revisionId: 'rev-4' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.rabRevisionApproval.create).not.toHaveBeenCalled()
    expect(prismaMock.rabProject.update).toHaveBeenCalledWith({
      where: { id: 'rab-1' },
      data: { finalApprovedRevisionId: 'rev-4' },
    })
    expect(body.message).toContain('baseline final')
  })
})
