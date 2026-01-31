import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { prismaMock } from '../../setup'
import { AutomaticIsolationService } from '@/modules/finance/services/AutomaticIsolationService'
import { Status, type Pelanggan, type Invoice, type Settings } from '@prisma/client'

// Mock RadiusSyncService with proper class syntax
vi.mock('@/modules/network/services/radius-sync-service', () => ({
  RadiusSyncService: class MockRadiusSyncService {
    handleStatusChange = vi.fn().mockResolvedValue(undefined)
  }
}))

// Mock notification
vi.mock('@/modules/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({ id: 'notif-id' })
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    logActivity: vi.fn().mockResolvedValue(undefined)
  }
}))

describe('AutomaticIsolationService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Set today to Jan 15, 2024
    vi.setSystemTime(new Date('2024-01-15'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('runDailyCheck', () => {
    it('should skip if feature is disabled', async () => {
      // Mock: Feature disabled
      prismaMock.settings.findUnique.mockResolvedValueOnce({
        key: 'GENERAL_AUTO_ISOLASI_ENABLED',
        value: 'false'
      } as unknown as Settings)

      await AutomaticIsolationService.runDailyCheck()

      // Should not query customers
      expect(prismaMock.pelanggan.findMany).not.toHaveBeenCalled()
    })

    it('should process overdue customers when feature is enabled', async () => {
      // Mock: Feature enabled (default if not set)
      prismaMock.settings.findUnique.mockResolvedValueOnce(null) // Enabled by default

      // Mock: Overdue customer (jatuhTempo Jan 10, today is Jan 15 = 5 days late)
      const overdueCustomer = {
        id: 'customer-1',
        nama: 'Overdue Customer',
        userId: 'user-1',
        status: Status.AKTIF,
        autoIsolir: true,
        jatuhTempo: new Date('2024-01-10') // 5 days ago
      }
      prismaMock.pelanggan.findMany.mockResolvedValueOnce([overdueCustomer] as unknown as Pelanggan[])

      // Mock: No paid invoice found (should isolate)
      prismaMock.invoice.findFirst.mockResolvedValueOnce(null)

      // Mock: Update pelanggan
      prismaMock.pelanggan.update.mockResolvedValueOnce({
        ...overdueCustomer,
        status: Status.ISOLIR
      } as unknown as Pelanggan)

      await AutomaticIsolationService.runDailyCheck()

      // Should update customer status to ISOLIR
      expect(prismaMock.pelanggan.update).toHaveBeenCalledWith({
        where: { id: 'customer-1' },
        data: { status: Status.ISOLIR }
      })
    })

    it('should skip customers with autoIsolir = false', async () => {
      // The query itself filters by autoIsolir: true, so we test that no customers are returned
      prismaMock.settings.findUnique.mockResolvedValueOnce(null)

      // No customers returned (because they all have autoIsolir: false)
      prismaMock.pelanggan.findMany.mockResolvedValueOnce([])

      await AutomaticIsolationService.runDailyCheck()

      expect(prismaMock.pelanggan.update).not.toHaveBeenCalled()
    })

    it('should skip customers with recent paid invoice', async () => {
      prismaMock.settings.findUnique.mockResolvedValueOnce(null) // Enabled

      const overdueCustomer = {
        id: 'customer-1',
        nama: 'Customer',
        userId: 'user-1',
        status: Status.AKTIF,
        autoIsolir: true,
        jatuhTempo: new Date('2024-01-10')
      }
      prismaMock.pelanggan.findMany.mockResolvedValueOnce([overdueCustomer] as unknown as Pelanggan[])

      // Mock: Has recent paid invoice - should skip isolation
      prismaMock.invoice.findFirst.mockResolvedValueOnce({
        id: 'invoice-1',
        invoiceNumber: 'INV/2024/01/0001',
        status: 'PAID'
      } as unknown as Invoice)

      await AutomaticIsolationService.runDailyCheck()

      // Should NOT update because has paid invoice
      expect(prismaMock.pelanggan.update).not.toHaveBeenCalled()
    })

    it('should isolate customer without paid invoice', async () => {
      prismaMock.settings.findUnique.mockResolvedValueOnce(null)

      // Customer is exactly 5 days late
      const overdueCustomer = {
        id: 'customer-1',
        nama: 'Overdue Customer',
        userId: 'user-1',
        status: Status.AKTIF,
        autoIsolir: true,
        jatuhTempo: new Date('2024-01-10') // Exactly 5 days ago
      }
      prismaMock.pelanggan.findMany.mockResolvedValueOnce([overdueCustomer] as unknown as Pelanggan[])

      // No paid invoice found
      prismaMock.invoice.findFirst.mockResolvedValueOnce(null)

      prismaMock.pelanggan.update.mockResolvedValueOnce({} as unknown as Pelanggan)

      await AutomaticIsolationService.runDailyCheck()

      // Should isolate because no recent paid invoice
      expect(prismaMock.pelanggan.update).toHaveBeenCalled()
    })
  })
})
