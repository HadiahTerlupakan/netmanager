import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WorkOrderStatus } from '@prisma/client'
import { prismaMock } from '../../setup'
import { WorkOrderService } from '@/modules/work-order/services/WorkOrderService'

// Mock the dependencies
vi.mock('@/modules/work-order/repositories/WorkOrderRepository')
vi.mock('@/modules/work-order/services/WorkOrderNotifications')
vi.mock('@/modules/work-order/services/WorkOrderCacheService')
vi.mock('@/lib/websocket/emitter')
vi.mock('@/lib/logger')

describe('WorkOrderService', () => {
    let service: WorkOrderService
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let repositoryMock: any

    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        service = new WorkOrderService(prismaMock as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        repositoryMock = (service as any).repository
    })

    describe('Access Control (validateWorkOrderAccess via getWorkOrderById)', () => {
        const mockWorkOrder = {
            id: 'wo-123',
            departmentId: 'dept-1',
            siteId: 'site-1',
            workOrderNumber: 'WO-001',
            title: 'Test WO'
        }

        it('should allow access for SUPER_ADMIN regardless of site/department', async () => {
            repositoryMock.findById.mockResolvedValue(mockWorkOrder)

            const userContext = {
                id: 'admin-1',
                role: 'SUPER_ADMIN'
            }

            const result = await service.getWorkOrderById('wo-123', userContext)

            expect(result.success).toBe(true)
            expect(result.data).toEqual(mockWorkOrder)
        })

        it('should allow access when department matches and department_only restriction is active', async () => {
            repositoryMock.findById.mockResolvedValue(mockWorkOrder)

            const userContext = {
                id: 'user-1',
                role: 'USER',
                permissions: ['workorders:department_only'],
                departmentId: 'dept-1'
            }

            const result = await service.getWorkOrderById('wo-123', userContext)

            expect(result.success).toBe(true)
        })

        it('should deny access when department does not match and department_only restriction is active', async () => {
            repositoryMock.findById.mockResolvedValue(mockWorkOrder)

            const userContext = {
                id: 'user-1',
                role: 'USER',
                permissions: ['workorders:department_only'],
                departmentId: 'dept-different'
            }

            const result = await service.getWorkOrderById('wo-123', userContext)

            expect(result.success).toBe(false)
            expect(result.error).toContain('Akses ditolak: Departemen berbeda')
            expect(result.code).toBe('FORBIDDEN')
        })

        it('should allow access when site matches and site_only restriction is active', async () => {
            repositoryMock.findById.mockResolvedValue(mockWorkOrder)

            const userContext = {
                id: 'user-1',
                role: 'USER',
                permissions: ['workorders:site_only'],
                siteId: 'site-1'
            }

            const result = await service.getWorkOrderById('wo-123', userContext)

            expect(result.success).toBe(true)
        })

        it('should deny access when site does not match and site_only restriction is active', async () => {
            repositoryMock.findById.mockResolvedValue(mockWorkOrder)

            const userContext = {
                id: 'user-1',
                role: 'USER',
                permissions: ['workorders:site_only'],
                siteId: 'site-different'
            }

            const result = await service.getWorkOrderById('wo-123', userContext)

            expect(result.success).toBe(false)
            expect(result.error).toContain('Akses ditolak: Site berbeda')
            expect(result.code).toBe('FORBIDDEN')
        })

        it('should allow access if no restrictions are present', async () => {
            repositoryMock.findById.mockResolvedValue(mockWorkOrder)

            const userContext = {
                id: 'user-1',
                role: 'USER',
                permissions: [] as string[]
            }

            const result = await service.getWorkOrderById('wo-123', userContext)

            expect(result.success).toBe(true)
        })
    })

    describe('getWorkOrders (List restrictions)', () => {
        it('should apply department filter when department_only is present', async () => {
            repositoryMock.findAllForList.mockResolvedValue({ workOrders: [], total: 0, page: 1, totalPages: 0 })

            await service.getWorkOrders({
                userPermissions: ['workorders:department_only'],
                userDepartmentId: 'dept-1',
                userRole: 'USER'
            })

            expect(repositoryMock.findAllForList).toHaveBeenCalledWith(
                expect.objectContaining({ departmentId: 'dept-1' }),
                expect.any(Number),
                expect.any(Number)
            )
        })

        it('should return empty list if department_only is present but user has no departmentId', async () => {
            const result = await service.getWorkOrders({
                userPermissions: ['workorders:department_only'],
                userRole: 'USER'
                // missing userDepartmentId
            })

            expect(result.success).toBe(true)
            expect(result.data?.workOrders).toEqual([])
            expect(repositoryMock.findAllForList).not.toHaveBeenCalled()
        })

        it('should apply site filter when site_only is present', async () => {
            repositoryMock.findAllForList.mockResolvedValue({ workOrders: [], total: 0, page: 1, totalPages: 0 })

            await service.getWorkOrders({
                userPermissions: ['workorders:site_only'],
                userSiteId: 'site-1',
                userRole: 'USER'
            })

            expect(repositoryMock.findAllForList).toHaveBeenCalledWith(
                expect.objectContaining({ siteId: 'site-1' }),
                expect.any(Number),
                expect.any(Number)
            )
        })
    })

    describe('delete and status not-found normalization', () => {
        const userContext = {
            id: 'admin-1',
            role: 'USER',
            permissions: [] as string[],
        }

        it('returns NOT_FOUND when deleteWorkOrder cannot find the work order during access validation', async () => {
            repositoryMock.findById.mockResolvedValue(null)

            const result = await service.deleteWorkOrder('wo-missing', userContext)

            expect(result).toEqual({
                success: false,
                error: 'Work order tidak ditemukan',
                code: 'NOT_FOUND',
            })
        })

        it('returns NOT_FOUND when updateStatus cannot find the work order during access validation', async () => {
            repositoryMock.findById.mockResolvedValue(null)

            const result = await service.updateStatus('wo-missing', WorkOrderStatus.CANCELLED, userContext, 'Cancelled')

            expect(result).toEqual({
                success: false,
                error: 'Work order tidak ditemukan',
                code: 'NOT_FOUND',
            })
        })
    })
})
