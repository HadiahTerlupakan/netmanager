// Mock notification service - DO THIS FIRST before any imports
vi.mock('@/modules/work-order/services/WorkOrderNotificationService', () => ({
  notifyNewWorkOrder: vi.fn(),
  notifyWorkOrderAssigned: vi.fn(),
  notifyWorkOrderStatusChange: vi.fn(),
  notifyWorkOrderUpdate: vi.fn()
}))

import { describe, it, expect, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { syncWoStatusToTicket, closeWoOnTicketClose } from '@/modules/work-order/services/WorkOrderSyncService'
import { WorkOrderStatus, TicketStatus, type WorkOrders, type SupportTickets, type TicketReplies } from '@prisma/client'

describe('WorkOrderSyncService', () => {
  describe('syncWoStatusToTicket', () => {
    it('should do nothing if work order not found', async () => {
      prismaMock.workOrders.findUnique.mockResolvedValueOnce(null)

      await syncWoStatusToTicket('non-existent-wo', WorkOrderStatus.IN_PROGRESS)

      expect(prismaMock.supportTickets.update).not.toHaveBeenCalled()
    })

    it('should do nothing if work order has no linked ticket', async () => {
      prismaMock.workOrders.findUnique.mockResolvedValueOnce({
        id: 'wo-1',
        workOrderNumber: 'WO-001',
        ticketId: null, // No linked ticket
        attachments: []
      } as unknown as WorkOrders)

      await syncWoStatusToTicket('wo-1', WorkOrderStatus.IN_PROGRESS)

      expect(prismaMock.supportTickets.update).not.toHaveBeenCalled()
    })

    it('should update ticket to IN_PROGRESS when WO status is IN_PROGRESS', async () => {
      prismaMock.workOrders.findUnique.mockResolvedValueOnce({
        id: 'wo-1',
        workOrderNumber: 'WO-001',
        ticketId: 'ticket-1',
        ticket: { id: 'ticket-1' },
        attachments: []
      } as unknown as WorkOrders)

      prismaMock.supportTickets.update.mockResolvedValueOnce({} as unknown as SupportTickets)

      await syncWoStatusToTicket('wo-1', WorkOrderStatus.IN_PROGRESS)

      expect(prismaMock.supportTickets.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { status: TicketStatus.IN_PROGRESS }
      })
    })

    it('should update ticket to RESOLVED and create report when WO is COMPLETED', async () => {
      prismaMock.workOrders.findUnique.mockResolvedValueOnce({
        id: 'wo-1',
        workOrderNumber: 'WO-001',
        ticketId: 'ticket-1',
        ticket: { id: 'ticket-1' },
        title: 'Fix Connection',
        description: 'Customer internet down',
        resolutionNotes: 'Replaced ONU',
        assignedToId: 'user-1',
        attachments: [
          { caption: '[COMPLETION] Photo 1', filePath: '/photos/1.jpg' },
          { caption: '[COMPLETION] Photo 2', filePath: '/photos/2.jpg' }
        ]
      } as unknown as WorkOrders)

      prismaMock.supportTickets.update.mockResolvedValueOnce({} as unknown as SupportTickets)
      prismaMock.ticketReplies.create.mockResolvedValueOnce({} as unknown as TicketReplies)

      await syncWoStatusToTicket('wo-1', WorkOrderStatus.COMPLETED)

      // Should update ticket to RESOLVED
      expect(prismaMock.supportTickets.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { status: TicketStatus.RESOLVED }
      })

      // Should create completion report
      expect(prismaMock.ticketReplies.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId: 'ticket-1',
          isFromAdmin: true,
          senderId: 'user-1'
        })
      })
    })
  })

  describe('closeWoOnTicketClose', () => {
    it('should cancel PENDING work orders', async () => {
      prismaMock.workOrders.findMany.mockResolvedValueOnce([
        { id: 'wo-1', workOrderNumber: 'WO-001', status: 'PENDING' }
      ] as unknown as WorkOrders[])

      prismaMock.workOrders.updateMany.mockResolvedValueOnce({ count: 1 })
      prismaMock.workOrders.findUnique.mockResolvedValueOnce({} as unknown as WorkOrders)

      await closeWoOnTicketClose('ticket-1')

      expect(prismaMock.workOrders.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 'wo-1' }),
        data: expect.objectContaining({
          status: 'CANCELLED',
          resolutionNotes: 'Tiket ditutup sebelum WO diambil'
        })
      })
    })

    it('should close IN_PROGRESS work orders without sending report', async () => {
      prismaMock.workOrders.findMany.mockResolvedValueOnce([
        { id: 'wo-1', workOrderNumber: 'WO-001', status: 'IN_PROGRESS' }
      ] as unknown as WorkOrders[])

      prismaMock.workOrders.updateMany.mockResolvedValueOnce({ count: 1 })
      prismaMock.workOrders.findUnique.mockResolvedValueOnce({} as unknown as WorkOrders)

      await closeWoOnTicketClose('ticket-1')

      expect(prismaMock.workOrders.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 'wo-1' }),
        data: expect.objectContaining({
          status: 'CLOSED',
          resolutionNotes: 'Tiket ditutup manual oleh Admin'
        })
      })
    })

    it('should archive COMPLETED work orders', async () => {
      const verifiedAt = new Date('2024-01-01')
      prismaMock.workOrders.findMany.mockResolvedValueOnce([
        { id: 'wo-1', workOrderNumber: 'WO-001', status: 'COMPLETED', verifiedAt }
      ] as unknown as WorkOrders[])

      prismaMock.workOrders.updateMany.mockResolvedValueOnce({ count: 1 })
      prismaMock.workOrders.findUnique.mockResolvedValueOnce({} as unknown as WorkOrders)

      await closeWoOnTicketClose('ticket-1')

      expect(prismaMock.workOrders.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 'wo-1' }),
        data: expect.objectContaining({
          status: 'CLOSED'
        })
      })
    })

    it('should handle multiple work orders with different statuses', async () => {
      // Clear previous calls to ensure clean state
      vi.clearAllMocks()

      prismaMock.workOrders.findMany.mockResolvedValueOnce([
        { id: 'wo-1', workOrderNumber: 'WO-001', status: 'PENDING' },
        { id: 'wo-2', workOrderNumber: 'WO-002', status: 'IN_PROGRESS' },
        { id: 'wo-3', workOrderNumber: 'WO-003', status: 'COMPLETED', verifiedAt: new Date() }
      ] as unknown as WorkOrders[])

      prismaMock.workOrders.updateMany.mockResolvedValue({ count: 1 })
      prismaMock.workOrders.findUnique.mockResolvedValue({} as unknown as WorkOrders)

      await closeWoOnTicketClose('ticket-1')

      // Should update all 3 work orders
      expect(prismaMock.workOrders.updateMany).toHaveBeenCalledTimes(3)
    })
  })
})
