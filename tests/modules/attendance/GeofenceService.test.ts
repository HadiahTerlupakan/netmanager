import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GeofenceService } from '@/modules/attendance/services/GeofenceService'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn()
        }
    }
}))

import { prisma } from '@/lib/prisma'

describe('GeofenceService', () => {
    let service: GeofenceService

    beforeEach(() => {
        service = new GeofenceService()
        vi.clearAllMocks()
    })

    describe('calculateDistance', () => {
        it('should calculate distance correctly between two coordinates', () => {
            // Jakarta Monas: -6.1754, 106.8272
            // Jakarta Bundaran HI: -6.1944, 106.8229
            const distance = service.calculateDistance(
                -6.1754, 106.8272,
                -6.1944, 106.8229
            )

            // Distance should be approximately 2.1 km
            expect(distance).toBeGreaterThan(2000)
            expect(distance).toBeLessThan(2500)
        })

        it('should return 0 for same coordinates', () => {
            const distance = service.calculateDistance(
                -6.1754, 106.8272,
                -6.1754, 106.8272
            )

            expect(distance).toBe(0)
        })

        it('should calculate distance correctly for short distances', () => {
            // Two points 100 meters apart (approximately)
            const distance = service.calculateDistance(
                -6.1754, 106.8272,
                -6.1763, 106.8272  // ~100m north
            )

            expect(distance).toBeGreaterThan(90)
            expect(distance).toBeLessThan(110)
        })
    })

    describe('isInsideZone', () => {
        it('should return true if user is inside the zone radius', () => {
            const result = service.isInsideZone(
                -6.1754, 106.8272,  // User location
                -6.1755, 106.8273,  // Zone center (very close)
                100                  // 100m radius
            )

            expect(result).toBe(true)
        })

        it('should return false if user is outside the zone radius', () => {
            const result = service.isInsideZone(
                -6.1754, 106.8272,  // User location (Monas)
                -6.1944, 106.8229,  // Zone center (Bundaran HI, ~2km away)
                100                  // 100m radius
            )

            expect(result).toBe(false)
        })

        it('should return true when user is exactly at zone boundary', () => {
            // Create a point exactly 100m away
            const distance = service.calculateDistance(
                -6.1754, 106.8272,
                -6.1763, 106.8272
            )
            
            const result = service.isInsideZone(
                -6.1754, 106.8272,
                -6.1763, 106.8272,
                distance  // Use exact distance as radius
            )

            expect(result).toBe(true)
        })
    })

    describe('validateGeofence', () => {
        it('should return isInside=true if user has no site assigned', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
                sites: null
            } as any)

            const result = await service.validateGeofence('user-1', -6.1754, 106.8272)

            expect(result.isInside).toBe(true)
            expect(result.nearestDistance).toBeNull()
            expect(result.nearestSiteName).toBeNull()
        })

        it('should return isInside=true if site has no coordinates', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
                sites: {
                    id: 'site-1',
                    name: 'Test Site',
                    latitude: null,
                    longitude: null,
                    attendanceRadius: 100,
                    isActive: true
                }
            } as any)

            const result = await service.validateGeofence('user-1', -6.1754, 106.8272)

            expect(result.isInside).toBe(true)
        })

        it('should return isInside=true when user is within site radius', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
                sites: {
                    id: 'site-1',
                    name: 'Kantor Jakarta',
                    latitude: -6.1755,
                    longitude: 106.8273,
                    attendanceRadius: 100,
                    isActive: true
                }
            } as any)

            const result = await service.validateGeofence('user-1', -6.1754, 106.8272)

            expect(result.isInside).toBe(true)
            expect(result.nearestSiteName).toBe('Kantor Jakarta')
            expect(result.nearestDistance).toBeLessThan(100)
        })

        it('should return isInside=false when user is outside site radius', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
                sites: {
                    id: 'site-1',
                    name: 'Kantor Jakarta',
                    latitude: -6.1944,  // Bundaran HI
                    longitude: 106.8229,
                    attendanceRadius: 100,
                    isActive: true
                }
            } as any)

            // User at Monas (~2km from Bundaran HI)
            const result = await service.validateGeofence('user-1', -6.1754, 106.8272)

            expect(result.isInside).toBe(false)
            expect(result.nearestSiteName).toBe('Kantor Jakarta')
            expect(result.nearestDistance).toBeGreaterThan(2000)
        })

        it('should return isInside=true for inactive site', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
                sites: {
                    id: 'site-1',
                    name: 'Inactive Site',
                    latitude: -6.1944,
                    longitude: 106.8229,
                    attendanceRadius: 100,
                    isActive: false
                }
            } as any)

            const result = await service.validateGeofence('user-1', -6.1754, 106.8272)

            // Should be considered valid since site is inactive
            expect(result.isInside).toBe(true)
        })
    })

    describe('getZonesForUser', () => {
        it('should return empty array if user has no site', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
                sites: null
            } as any)

            const result = await service.getZonesForUser('user-1')

            expect(result).toEqual([])
        })

        it('should return zone info for user with active site', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
                sites: {
                    id: 'site-1',
                    name: 'Kantor Jakarta',
                    latitude: -6.1754,
                    longitude: 106.8272,
                    attendanceRadius: 150,
                    isActive: true
                }
            } as any)

            const result = await service.getZonesForUser('user-1')

            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                siteId: 'site-1',
                siteName: 'Kantor Jakarta',
                latitude: -6.1754,
                longitude: 106.8272,
                radius: 150
            })
        })
    })
})
