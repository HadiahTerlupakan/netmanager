import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OnuService, getOnuService } from '@/modules/network/services/OnuService'
import type { Server as SocketIOServer } from 'socket.io'

// Mock repositories
vi.mock('@/lib/repositories', () => ({
  getOLTRepository: vi.fn().mockReturnValue({
    findById: vi.fn()
  }),
  getOnuRepository: vi.fn().mockReturnValue({
    findByGponOnu: vi.fn(),
    upsert: vi.fn()
  })
}))

// Mock SNMP update function
vi.mock('@/modules/network/services/onu-update-snmp-get', () => ({
  updateMultipleOnusViaGetWithOids: vi.fn()
}))

// Mock cache service
vi.mock('@/modules/network/services/onu-cache-service', () => ({
  onuCacheService: {
    invalidate: vi.fn()
  }
}))

describe('OnuService', () => {
  let service: OnuService
  let mockSocketIO: Partial<SocketIOServer>
  
  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()
    
    mockSocketIO = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn()
    }
    
    service = new OnuService(mockSocketIO as SocketIOServer)
  })

  describe('updateOnus', () => {
    it('should return empty array when no ONUs provided', async () => {
      const result = await service.updateOnus([])
      expect(result).toEqual([])
    })

    it('should group ONUs by OLT', async () => {
      const { getOLTRepository, getOnuRepository } = await import('@/lib/repositories')
      const { updateMultipleOnusViaGetWithOids } = await import('@/modules/network/services/onu-update-snmp-get')

      // Mock OLT repository
      const mockOltRepo = {
        findById: vi.fn().mockResolvedValue({
          id: 'olt-1',
          ipAddress: '192.168.1.1',
          snmpPort: 161,
          snmpConnected: true,
          snmpCommunityWrite: 'public',
          snmpVersion: '2c'
        })
      };
      (getOLTRepository as any).mockReturnValue(mockOltRepo)

      // Mock ONU repository
      const mockOnuRepo = {
        findByGponOnu: vi.fn().mockResolvedValue({
          statusOid: '.1.3.6.1.4.1.2011.6.128.1.1.2.46.1.15',
          rxOltOid: null,
          rxOnuOid: null
        }),
        upsert: vi.fn().mockResolvedValue({ id: 'onu-1', updated: true })
      };
      (getOnuRepository as any).mockReturnValue(mockOnuRepo);

      // Mock SNMP update
      (updateMultipleOnusViaGetWithOids as any).mockResolvedValue([
        { gponOnu: '1/1/1:1', status: 'Online', rxOlt: '-20.5', rxOnu: '-18.0' }
      ])

      const onuList = [
        { gponOnu: '1/1/1:1', oltId: 'olt-1' },
        { gponOnu: '1/1/1:2', oltId: 'olt-1' }
      ]

      await service.updateOnus(onuList)

      // Should query OLT once (grouped)
      expect(mockOltRepo.findById).toHaveBeenCalledTimes(1)
      expect(mockOltRepo.findById).toHaveBeenCalledWith('olt-1')
    })

    it('should skip ONU if OLT is not SNMP connected', async () => {
      const { getOLTRepository } = await import('@/lib/repositories')

      const mockOltRepo = {
        findById: vi.fn().mockResolvedValue({
          id: 'olt-1',
          ipAddress: '192.168.1.1',
          snmpConnected: false // Not connected!
        })
      };
      (getOLTRepository as any).mockReturnValue(mockOltRepo)

      const result = await service.updateOnus([
        { gponOnu: '1/1/1:1', oltId: 'olt-1' }
      ])

      // Should return as not updated
      expect(result).toEqual([
        { gponOnu: '1/1/1:1', oltId: 'olt-1', updated: false }
      ])
    })

    it('should emit WebSocket event on successful update', async () => {
      const { getOLTRepository, getOnuRepository } = await import('@/lib/repositories')
      const { updateMultipleOnusViaGetWithOids } = await import('@/modules/network/services/onu-update-snmp-get')

      const mockOltRepo = {
        findById: vi.fn().mockResolvedValue({
          id: 'olt-1',
          ipAddress: '192.168.1.1',
          snmpPort: 161,
          snmpConnected: true,
          snmpCommunityWrite: 'public',
          snmpVersion: '2c'
        })
      };
      (getOLTRepository as any).mockReturnValue(mockOltRepo)

      const mockOnuRepo = {
        findManyByOltIdMinimal: vi.fn().mockResolvedValue([
          {
            gponOnu: '1/1/1:1',
            statusOid: '.1.3.6.1.4.1.2011.6.128.1.1.2.46.1.15',
            rxOltOid: null,
            rxOnuOid: null,
            status: 'Online'
          }
        ]),
        upsert: vi.fn().mockResolvedValue({ id: 'onu-1', updated: true })
      };
      (getOnuRepository as any).mockReturnValue(mockOnuRepo);

      (updateMultipleOnusViaGetWithOids as any).mockResolvedValue([
        { gponOnu: '1/1/1:1', status: 'Online' }
      ])

      await service.updateOnus([{ gponOnu: '1/1/1:1', oltId: 'olt-1' }])

      // Should emit WebSocket event
      expect(mockSocketIO.to).toHaveBeenCalledWith('admin:onu')
      expect(mockSocketIO.emit).toHaveBeenCalledWith('onu:updated', expect.objectContaining({
        gponOnu: '1/1/1:1',
        oltId: 'olt-1',
        updated: true
      }))
    })
  })

  describe('getOnuService', () => {
    it('should return singleton instance', () => {
      const instance1 = getOnuService()
      const instance2 = getOnuService()

      expect(instance1).toBe(instance2)
    })
  })

  describe('setSocketServer', () => {
    it('should set socket server', () => {
      const newService = new OnuService()
      const mockIO = { to: vi.fn(), emit: vi.fn() } as any

      newService.setSocketServer(mockIO)

      // Internal check - we can't directly access private field
      // but we can verify it works by calling updateOnus
      expect(() => newService.setSocketServer(mockIO)).not.toThrow()
    })
  })
})
