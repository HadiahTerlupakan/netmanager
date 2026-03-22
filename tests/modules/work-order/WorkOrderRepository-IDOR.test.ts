import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository'
import { getTenantIdFromContext } from '@/lib/tenant-context'
import { type PrismaClient } from '@prisma/client'

vi.mock('@/lib/tenant-context', () => ({
  getTenantIdFromContext: vi.fn()
}))

describe('WorkOrderRepository - IDOR Protection', () => {
  let repository: WorkOrderRepository

  beforeEach(() => {
    repository = new WorkOrderRepository(prismaMock as unknown as PrismaClient)
    vi.clearAllMocks()
  })

  it('should isolate findById by tenantId', async () => {
    // Setup: Context has tenant-A
    vi.mocked(getTenantIdFromContext).mockResolvedValue({ tenantId: 'tenant-A', isSuperAdmin: false })
    
    // Action
    await repository.findById('wo-123')

    // Verify: Query must include tenantId filter
    expect(prismaMock.workOrders.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'wo-123',
        tenantId: 'tenant-A'
      })
    }))
  })

  it('should allow SuperAdmin to bypass tenant isolation in findById', async () => {
    // Setup: Context is SuperAdmin
    vi.mocked(getTenantIdFromContext).mockResolvedValue({ tenantId: null, isSuperAdmin: true })
    
    // Action
    await repository.findById('wo-123')

    // Verify: Query should NOT have tenantId filter
    expect(prismaMock.workOrders.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'wo-123' }
    }))
  })

  it('should prevent deleting WO from another tenant', async () => {
    // Setup: Context has tenant-A
    vi.mocked(getTenantIdFromContext).mockResolvedValue({ tenantId: 'tenant-A', isSuperAdmin: false })
    
    // Mock deleteMany to return 0 counts (meaning nothing matched the filter)
    prismaMock.workOrders.deleteMany.mockResolvedValue({ count: 0 })

    // Action & Verify
    await expect(repository.delete('wo-other-tenant')).rejects.toThrow('Work order not found or access denied')
    
    expect(prismaMock.workOrders.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'wo-other-tenant',
        tenantId: 'tenant-A'
      }
    }))
  })

  it('should isolate sub-resource additions (addTask) to parent tenant', async () => {
    // Setup: Context has tenant-A
    vi.mocked(getTenantIdFromContext).mockResolvedValue({ tenantId: 'tenant-A', isSuperAdmin: false })
    
    // Mock parent lookup: parent WO not found in tenant-A
    prismaMock.workOrders.findFirst.mockResolvedValue(null)

    // Action & Verify
    await expect(repository.addTask({
      workOrderId: 'wo-other',
      title: 'Malicious Task'
    })).rejects.toThrow('Work order not found or access denied')

    expect(prismaMock.workOrders.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'wo-other', tenantId: 'tenant-A' }
    }))
  })

  it('should isolate sub-resource deletions (deleteAttachment) to parent tenant', async () => {
    // Setup: Context has tenant-A
    vi.mocked(getTenantIdFromContext).mockResolvedValue({ tenantId: 'tenant-A', isSuperAdmin: false })
    
    // Mock attachment lookup: not found in tenant-A
    prismaMock.workOrderAttachments.findFirst.mockResolvedValue(null)

    // Action & Verify
    await expect(repository.deleteAttachment('att-other')).rejects.toThrow('Attachment not found or access denied')

    expect(prismaMock.workOrderAttachments.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'att-other', workOrders: { tenantId: 'tenant-A' } }
    }))
  })
})
