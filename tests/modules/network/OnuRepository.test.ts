import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { OnuRepository } from '@/modules/network/repositories/OnuRepository'
import type { Onu, PrismaClient } from '@prisma/client'

// Mock onu-cache-service with correct method names
vi.mock('@/modules/network/services/onu-cache-service', () => ({
  onuCacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    invalidateOltCache: vi.fn().mockResolvedValue(undefined),
    invalidateAllCaches: vi.fn().mockResolvedValue(undefined)
  }
}))

describe('OnuRepository', () => {
  let repository: OnuRepository

  beforeEach(() => {
    repository = new OnuRepository(prismaMock as unknown as PrismaClient)
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('should create new ONU successfully', async () => {
      const input = {
        oltId: 'olt-1',
        gponOnu: '1/1/1:1',
        name: 'ONU Customer A',
        serialNumber: 'HWTC123456',
        status: 'Online'
      }

      prismaMock.onu.create.mockResolvedValueOnce({
        id: 'onu-1',
        ...input
      } as unknown as Onu)

      const result = await repository.create(input)

      expect(result).toBeDefined()
      expect(result.id).toBe('onu-1')
    })
  })

  describe('upsert', () => {
    it('should create new ONU if not exists', async () => {
      const oltId = 'olt-1'
      const gponOnu = '1/1/1:1'
      const data = {
        oltId,
        gponOnu,
        name: 'New ONU',
        status: 'Online'
      }

      // upsert uses findUnique with composite key
      prismaMock.onu.findUnique.mockResolvedValueOnce(null)
      prismaMock.onu.create.mockResolvedValueOnce({
        id: 'onu-new',
        ...data
      } as unknown as Onu)

      const result = await repository.upsert(oltId, gponOnu, data)

      expect(result.id).toBe('onu-new')
    })

    it('should update existing ONU', async () => {
      const oltId = 'olt-1'
      const gponOnu = '1/1/1:1'
      const data = {
        oltId,
        gponOnu,
        name: 'Updated ONU',
        status: 'Online',
        rxOlt: '-20.5 dBm'
      }

      // upsert finds existing ONU first
      prismaMock.onu.findUnique.mockResolvedValueOnce({
        id: 'onu-existing',
        oltId,
        gponOnu,
        name: 'Old Name',
        status: 'Offline'
      } as unknown as Onu)

      prismaMock.onu.update.mockResolvedValueOnce({
        id: 'onu-existing',
        ...data
      } as unknown as Onu)

      const result = await repository.upsert(oltId, gponOnu, data)

      expect(result.updated).toBe(true)
      expect(result.id).toBe('onu-existing')
    })
  })

  describe('findByGponOnu', () => {
    it('should find ONU by oltId and gponOnu', async () => {
      const mockOnu = {
        id: 'onu-1',
        oltId: 'olt-1',
        gponOnu: '1/1/1:1',
        name: 'Customer ONU',
        status: 'Online'
      }

      // findByGponOnu uses findUnique with composite key
      prismaMock.onu.findUnique.mockResolvedValueOnce(mockOnu as unknown as Onu)

      const result = await repository.findByGponOnu('olt-1', '1/1/1:1')

      expect(result).toBeDefined()
      expect(result?.gponOnu).toBe('1/1/1:1')
    })

    it('should return null if ONU not found', async () => {
      prismaMock.onu.findUnique.mockResolvedValueOnce(null)

      const result = await repository.findByGponOnu('olt-1', 'nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('findWithFilters', () => {
    it('should filter and paginate ONUs', async () => {
      const mockOnus = [
        { id: 'onu-1', status: 'Online', oltId: 'olt-1' },
        { id: 'onu-2', status: 'Online', oltId: 'olt-1' }
      ]

      prismaMock.onu.findMany.mockResolvedValueOnce(mockOnus as unknown as Onu[])
      prismaMock.onu.count.mockResolvedValueOnce(2)

      const result = await repository.findWithFilters(
        { status: 'Online', oltId: 'olt-1' },
        { page: 1, limit: 10 }
      )

      // Note: findWithFilters returns 'onus' not 'items'
      expect(result.onus).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.page).toBe(1)
    })
  })

  describe('getSummaryStats', () => {
    it('should return ONU statistics', async () => {
      // Mock count calls: total, then findMany for online, then counts for various statuses
      prismaMock.onu.count
        .mockResolvedValueOnce(100)  // Total
        .mockResolvedValueOnce(10)   // Offline
        .mockResolvedValueOnce(3)    // LOS
        .mockResolvedValueOnce(2)    // DyingGasp
        .mockResolvedValueOnce(0)    // Uncfg
        .mockResolvedValueOnce(0)    // Disabled

      // findMany for online ONUs with rxOlt
      prismaMock.onu.findMany.mockResolvedValueOnce([
        { rxOlt: '-20.5 dBm' },
        { rxOlt: '-22.0 dBm' },
        { rxOlt: '-25.0 dBm' }
      ] as unknown as Onu[])

      const result = await repository.getSummaryStats()

      expect(result.total).toBe(100)
      expect(result.online).toBe(3) // Length of findMany result
      expect(result.offline).toBe(10)
    })
  })

  describe('invalidateCache', () => {
    it('should call cache invalidate', async () => {
      const { onuCacheService } = await import('@/modules/network/services/onu-cache-service')

      await repository.invalidateCache('olt-1')

      expect(onuCacheService.invalidateOltCache).toHaveBeenCalledWith('olt-1')
    })
  })
})
