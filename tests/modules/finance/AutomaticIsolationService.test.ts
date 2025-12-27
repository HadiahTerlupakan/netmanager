import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { AutomaticIsolationService } from '@/modules/finance/services/AutomaticIsolationService'
import { Status } from '@prisma/client'

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

  describe('runDailyCheck', () => {
    it('should skip if feature is disabled', async () => {
      // Mock: Feature disabled
      prismaMock.settings.findUnique.mockResolvedValueOnce({
        key: 'GENERAL_AUTO_ISOLASI_ENABLED',
        value: 'false'
      } as any)

      await AutomaticIsolationService.runDailyCheck()

      // Should not query customers
      expect(prismaMock.pelanggan.findMany).not.toHaveBeenCalled()
    })

    it('should process overdue customers when feature is enabled', async () => {
      // Mock: Feature enabled (default if not set)
      prismaMock.settings.findUnique.mockResolvedValueOnce(null) // Enabled by default
      // Mock: Tolerance 1 day
      prismaMock.settings.findUnique.mockResolvedValueOnce({
        key: 'GENERAL_AUTO_ISOLASI_HARI_TOLERANSI',
        value: '1'
      } as any)

      // Mock: Overdue customer (jatuhTempo Jan 10, today is Jan 15 = 5 days late)
      const overdueCustomer = {
        id: 'customer-1',
        nama: 'Overdue Customer',
        userId: 'user-1',
        status: Status.AKTIF,
        autoIsolir: true,
        jatuhTempo: new Date('2024-01-10') // 5 days ago
      }
      prismaMock.pelanggan.findMany.mockResolvedValueOnce([overdueCustomer] as any)

      // Mock: Update pelanggan
      prismaMock.pelanggan.update.mockResolvedValueOnce({
        ...overdueCustomer,
        status: Status.ISOLIR
      } as any)

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
      prismaMock.settings.findUnique.mockResolvedValueOnce({ value: '1' } as any)

      // No customers returned (because they all have autoIsolir: false)
      prismaMock.pelanggan.findMany.mockResolvedValueOnce([])

      await AutomaticIsolationService.runDailyCheck()

      expect(prismaMock.pelanggan.update).not.toHaveBeenCalled()
    })

    it('should skip customers within tolerance period', async () => {
      prismaMock.settings.findUnique.mockResolvedValueOnce(null) // Enabled
      prismaMock.settings.findUnique.mockResolvedValueOnce({
        key: 'GENERAL_AUTO_ISOLASI_HARI_TOLERANSI',
        value: '7' // 7 days tolerance
      } as any)

      // Customer is only 5 days late, tolerance is 7
      // Due to query filtering (jatuhTempo < today), this customer would be returned
      // But the loop should skip because diffDays < toleranceDays
      const customerWithinTolerance = {
        id: 'customer-1',
        nama: 'Customer',
        userId: 'user-1',
        status: Status.AKTIF,
        autoIsolir: true,
        jatuhTempo: new Date('2024-01-10') // 5 days ago, but tolerance is 7
      }
      prismaMock.pelanggan.findMany.mockResolvedValueOnce([customerWithinTolerance] as any)

      await AutomaticIsolationService.runDailyCheck()

      // Should NOT update because within tolerance
      expect(prismaMock.pelanggan.update).not.toHaveBeenCalled()
    })

    it('should isolate customer exactly after tolerance period', async () => {
      prismaMock.settings.findUnique.mockResolvedValueOnce(null)
      prismaMock.settings.findUnique.mockResolvedValueOnce({ value: '5' } as any) // 5 days tolerance

      // Customer is exactly 5 days late
      const overdueCustomer = {
        id: 'customer-1',
        nama: 'Overdue Customer',
        userId: 'user-1',
        status: Status.AKTIF,
        autoIsolir: true,
        jatuhTempo: new Date('2024-01-10') // Exactly 5 days ago
      }
      prismaMock.pelanggan.findMany.mockResolvedValueOnce([overdueCustomer] as any)
      prismaMock.pelanggan.update.mockResolvedValueOnce({} as any)

      await AutomaticIsolationService.runDailyCheck()

      // Should isolate (5 >= 5)
      expect(prismaMock.pelanggan.update).toHaveBeenCalled()
    })
  })
})
