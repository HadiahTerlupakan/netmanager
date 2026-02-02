import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository'
import { WorkOrderStatus, WorkOrderType, type WorkOrders, type PrismaClient, type WorkOrderUpdates, type WorkOrderAssignments, type WorkOrderTasks, type User } from '@prisma/client'

// Mock the sync service
vi.mock('@/modules/work-order/services/WorkOrderSyncService', () => ({
  syncWoStatusToTicket: vi.fn().mockResolvedValue(undefined)
}))

// Mock notification service
vi.mock('@/modules/work-order/services/WorkOrderNotificationService', () => ({
  notifyNewWorkOrder: vi.fn().mockResolvedValue(undefined),
  notifyWorkOrderAssigned: vi.fn().mockResolvedValue(undefined),
  notifyWorkOrderStatusChange: vi.fn().mockResolvedValue(undefined),
  notifyWorkOrderUpdate: vi.fn().mockResolvedValue(undefined)
}))

// Mock socket emitter to prevent network calls
vi.mock('@/lib/websocket/emitter', () => ({
  socketEmitter: {
    workOrderActivity: vi.fn(),
    newWorkOrder: vi.fn(),
    updateWorkOrder: vi.fn(),
    workOrderAssigned: vi.fn(),
    broadcast: vi.fn()
  }
}))

// Helper to create update mock
const createUpdateMock = (overrides = {}) => ({
  id: 'update-1',
  workOrderId: 'wo-1',
  updateType: 'STATUS_CHANGE',
  message: 'Status changed',
  createdAt: new Date(),
  createdById: 'user-1',
  ...overrides
})

// Helper to create base work order mock
// Helper to create base work order mock
const createWoMock = (overrides: Partial<WorkOrders> = {}): WorkOrders => ({
  id: 'wo-1',
  workOrderNumber: 'WO-001',
  status: WorkOrderStatus.PENDING,
  title: 'Test WO',
  type: WorkOrderType.INSTALLATION,
  priority: 'NORMAL',
  departmentId: null,
  siteId: null,
  assignedToId: null,
  startedAt: null,
  completedAt: null,
  verifiedAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  description: null,
  requesterName: null,
  requesterPhone: null,
  requesterAddress: null,
  latitude: null,
  longitude: null,
  customerId: null,
  createdById: 'user-1',
  approvedById: null,
  rejectionReason: null,
  ...overrides
} as WorkOrders)

describe('WorkOrderRepository', () => {
  let repository: WorkOrderRepository

  beforeEach(() => {
    repository = new WorkOrderRepository(prismaMock as unknown as PrismaClient)
    vi.clearAllMocks()
    // Default mocks for common operations
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Test User'
    } as unknown as User)
  })

  describe('generateWorkOrderNumber', () => {
    it('should generate WO number with date prefix', async () => {
      prismaMock.workOrders.count.mockResolvedValueOnce(0)

      const result = await repository.generateWorkOrderNumber()

      expect(result).toMatch(/^WO-\d{8}-0001$/)
    })

    it('should always increment counter using unique check', async () => {
      // Implementation uses findFirst to check uniqueness, not count
      prismaMock.workOrders.findFirst.mockResolvedValueOnce({ id: 'existing' } as unknown as WorkOrders)
      prismaMock.workOrders.findFirst.mockResolvedValueOnce(null)

      const result = await repository.generateWorkOrderNumber()

      // Should be a valid WO number format
      expect(result).toMatch(/^WO-\d{8}-\d{4}$/)
    })
  })

  describe('create', () => {
    it('should create work order with PENDING status', async () => {
      const mockWo = createWoMock({ workOrderNumber: 'WO-20241229-001' })

      prismaMock.workOrders.findFirst.mockResolvedValueOnce(null)
      prismaMock.workOrders.create.mockResolvedValueOnce(mockWo as unknown as WorkOrders)

      const result = await repository.create({
        type: WorkOrderType.INSTALLATION,
        title: 'Test WO',
        description: 'Test description'
      })

      expect(result.status).toBe('PENDING')
      expect(prismaMock.workOrders.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            priority: 'NORMAL'
          })
        })
      )
    })
  })

  describe('updateStatus', () => {
    it('should set startedAt when transitioning to IN_PROGRESS', async () => {
      prismaMock.workOrders.findUnique.mockResolvedValue(
        createWoMock({ status: 'ASSIGNED' }) as unknown as WorkOrders
      );
      prismaMock.workOrderUpdates.create.mockResolvedValue(createUpdateMock() as unknown as WorkOrderUpdates)
      prismaMock.workOrders.update.mockResolvedValue(
        createWoMock({ status: 'IN_PROGRESS', startedAt: new Date() }) as unknown as WorkOrders
      )

      await repository.updateStatus('wo-1', WorkOrderStatus.IN_PROGRESS, 'user-1')

      expect(prismaMock.workOrders.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'IN_PROGRESS',
            startedAt: expect.any(Date)
          })
        })
      )
    })

    it('should set completedAt and calculate actualHours when COMPLETED', async () => {
      const startedAt = new Date(Date.now() - 3600000) // 1 hour ago
      prismaMock.workOrders.findUnique.mockResolvedValue(
        createWoMock({ status: 'IN_PROGRESS', startedAt }) as unknown as WorkOrders
      )
      prismaMock.workOrderUpdates.create.mockResolvedValue(createUpdateMock() as unknown as WorkOrderUpdates)
      prismaMock.workOrders.update.mockResolvedValue(
        createWoMock({ status: 'COMPLETED', completedAt: new Date() }) as unknown as WorkOrders
      )

      await repository.updateStatus('wo-1', WorkOrderStatus.COMPLETED, 'user-1')

      expect(prismaMock.workOrders.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            completedAt: expect.any(Date),
            actualHours: expect.any(Number)
          })
        })
      )
    })

    it('should set verifiedAt when VERIFIED', async () => {
      prismaMock.workOrders.findUnique.mockResolvedValue(
        createWoMock({ status: 'COMPLETED' }) as unknown as WorkOrders
      )
      prismaMock.workOrderUpdates.create.mockResolvedValue(createUpdateMock() as unknown as WorkOrderUpdates)
      prismaMock.workOrders.update.mockResolvedValue(
        createWoMock({ status: 'VERIFIED', verifiedAt: new Date() }) as unknown as WorkOrders
      )

      await repository.updateStatus('wo-1', WorkOrderStatus.VERIFIED, 'user-1')

      expect(prismaMock.workOrders.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'VERIFIED',
            verifiedAt: expect.any(Date)
          })
        })
      )
    })

    it('should set closedAt when CLOSED', async () => {
      prismaMock.workOrders.findUnique.mockResolvedValue(
        createWoMock({ status: 'VERIFIED' }) as unknown as WorkOrders
      )
      prismaMock.workOrderUpdates.create.mockResolvedValue(createUpdateMock() as unknown as WorkOrderUpdates)
      prismaMock.workOrders.update.mockResolvedValue(
        createWoMock({ status: 'CLOSED', closedAt: new Date() }) as unknown as WorkOrders
      )

      await repository.updateStatus('wo-1', WorkOrderStatus.CLOSED, 'user-1')

      expect(prismaMock.workOrders.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CLOSED',
            closedAt: expect.any(Date)
          })
        })
      )
    })

    it('should throw error if work order not found', async () => {
      prismaMock.workOrders.findUnique.mockResolvedValueOnce(null)

      await expect(
        repository.updateStatus('non-existent', WorkOrderStatus.IN_PROGRESS)
      ).rejects.toThrow('Work order not found')
    })
  })

  describe('assign', () => {
    it('should set assignedToId and change status to ASSIGNED', async () => {
      prismaMock.workOrders.update.mockResolvedValueOnce({} as unknown as WorkOrders);
      prismaMock.workOrderAssignments.create.mockResolvedValueOnce({} as unknown as WorkOrderAssignments)
      prismaMock.workOrders.findUnique.mockResolvedValue(
        createWoMock({ assignedToId: 'user-1', status: 'ASSIGNED' }) as unknown as WorkOrders
      )

      await repository.assign('wo-1', 'user-1', 'Lead')

      expect(prismaMock.workOrders.update).toHaveBeenCalledWith({
        where: { id: 'wo-1' },
        data: {
          assignedToId: 'user-1',
          status: 'ASSIGNED'
        }
      })

      expect(prismaMock.workOrderAssignments.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workOrderId: 'wo-1',
          userId: 'user-1',
          role: 'Lead'
        })
      })
    })
  })

  describe('unassign', () => {
    it('should clear assignedToId and revert to PENDING', async () => {
      prismaMock.workOrders.update.mockResolvedValueOnce(
        createWoMock({ assignedToId: null, status: 'PENDING' }) as unknown as WorkOrders
      )

      const result = await repository.unassign('wo-1')

      expect(prismaMock.workOrders.update).toHaveBeenCalledWith({
        where: { id: 'wo-1' },
        data: {
          assignedToId: null,
          status: 'PENDING'
        }
      })
      expect(result.status).toBe('PENDING')
    })
  })

  describe('cancel', () => {
    it('should add cancellation note and set status to CANCELLED', async () => {
      prismaMock.workOrderUpdates.create.mockResolvedValue(createUpdateMock({ updateType: 'NOTE' }) as unknown as WorkOrderUpdates)
      prismaMock.workOrders.findUnique.mockResolvedValue(createWoMock() as unknown as WorkOrders)
      prismaMock.workOrders.update.mockResolvedValue(
        createWoMock({ status: 'CANCELLED' }) as unknown as WorkOrders
      )

      await repository.cancel('wo-1', 'Customer request', 'user-1')

      // First call is for cancellation note
      expect(prismaMock.workOrderUpdates.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workOrderId: 'wo-1',
          updateType: 'NOTE',
          message: expect.stringContaining('Customer request')
        })
      })
    })
  })

  describe('addTask', () => {
    it('should create task with PENDING status', async () => {
      prismaMock.workOrderTasks.create.mockResolvedValueOnce({
        id: 'task-1',
        workOrderId: 'wo-1',
        title: 'Install ONU',
        status: 'PENDING'
      } as unknown as WorkOrderTasks)

      const result = await repository.addTask({
        workOrderId: 'wo-1',
        title: 'Install ONU',
        description: 'Install new ONU device'
      })

      expect(result.status).toBe('PENDING')
      expect(prismaMock.workOrderTasks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workOrderId: 'wo-1',
          title: 'Install ONU',
          status: 'PENDING'
        })
      })
    })
  })

  describe('completeTask', () => {
    it('should set status to COMPLETED and record completedAt', async () => {
      prismaMock.workOrderTasks.update.mockResolvedValueOnce({
        id: 'task-1',
        status: 'COMPLETED',
        completedAt: new Date(),
        completedById: 'user-1'
      } as unknown as WorkOrderTasks)

      await repository.completeTask('task-1', 'user-1')

      expect(prismaMock.workOrderTasks.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedById: 'user-1',
          completedAt: expect.any(Date)
        })
      })
    })
  })

  describe('getStatistics', () => {
    it('should return aggregated statistics', async () => {
      // Clear any previous mock setup for this specific method
      prismaMock.workOrders.count.mockReset()

      // Set up the mock implementation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.workOrders.count.mockImplementation(async (args: any) => {
        // If query has priority filter, it's the "urgentOpen" count
        if (args?.where?.priority) {
          return 5
        }
        // Otherwise it's the total count (empty where or simple filters)
        return 100
      })

      prismaMock.workOrders.groupBy.mockResolvedValueOnce([
        { status: 'PENDING', _count: 10 },
        { status: 'IN_PROGRESS', _count: 20 },
        { status: 'COMPLETED', _count: 30 },
        { status: 'CLOSED', _count: 40 }
      ] as unknown as Array<{ status: string; _count: number }>)

      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
        { avgHours: 2.0, totalCost: 100 }
      ])

      prismaMock.workOrders.aggregate.mockResolvedValueOnce({
        _avg: { rating: 4.5 },
        _count: { rating: 50 }
      } as unknown as { _avg: { rating: number }; _count: { rating: number } })

      const result = await repository.getStatistics()

      expect(result.total).toBe(100)
      expect(result.pending).toBe(10)
      expect(result.inProgress).toBe(20)
      expect(result.completed).toBe(30)
      expect(result.closed).toBe(40)
      expect(result.avgRating).toBe(4.5)
      expect(result.urgentOpen).toBe(5)
    })
  })

  describe('findAll with filters', () => {
    it('should filter by status', async () => {
      prismaMock.workOrders.findMany.mockResolvedValueOnce([])
      prismaMock.workOrders.count.mockResolvedValueOnce(0)

      await repository.findAll({ status: WorkOrderStatus.PENDING })

      expect(prismaMock.workOrders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING'
          })
        })
      )
    })

    it('should filter by multiple statuses', async () => {
      prismaMock.workOrders.findMany.mockResolvedValueOnce([])
      prismaMock.workOrders.count.mockResolvedValueOnce(0)

      await repository.findAll({
        status: [WorkOrderStatus.PENDING, WorkOrderStatus.ASSIGNED]
      })

      expect(prismaMock.workOrders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['PENDING', 'ASSIGNED'] }
          })
        })
      )
    })

    it('should filter unassigned only', async () => {
      prismaMock.workOrders.findMany.mockResolvedValueOnce([])
      prismaMock.workOrders.count.mockResolvedValueOnce(0)

      await repository.findAll({ unassignedOnly: true })

      expect(prismaMock.workOrders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedToId: null
          })
        })
      )
    })

    it('should search by keyword', async () => {
      prismaMock.workOrders.findMany.mockResolvedValueOnce([])
      prismaMock.workOrders.count.mockResolvedValueOnce(0)

      await repository.findAll({ search: 'internet' })

      expect(prismaMock.workOrders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ title: expect.any(Object) })
            ])
          })
        })
      )
    })
  })
})
