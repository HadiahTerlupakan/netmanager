import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { WorkOrderService } from '@/modules/work-order/services/WorkOrderService'
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository'

// Mock the dependencies
vi.mock('@/modules/work-order/repositories/WorkOrderRepository')
vi.mock('@/modules/work-order/services/WorkOrderNotifications')
vi.mock('@/modules/work-order/services/WorkOrderCacheService')
vi.mock('@/lib/websocket/emitter')
vi.mock('@/lib/logger')

describe('WorkOrderService', () => {
    let service: WorkOrderService
    let repositoryMock: any

    beforeEach(() => {
        vi.clearAllMocks()
        service = new WorkOrderService(prismaMock as any)
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
            expect(result.error).toContain('Access denied: Different department')
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
            expect(result.error).toContain('Access denied: Different site')
            expect(result.code).toBe('FORBIDDEN')
        })

        it('should allow access if no restrictions are present', async () => {
            repositoryMock.findById.mockResolvedValue(mockWorkOrder)

            const userContext = {
                id: 'user-1',
                role: 'USER',
                permissions: []
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
})
