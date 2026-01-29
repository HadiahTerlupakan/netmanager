/**
 * WorkOrderService
 * 
 * Centralized business logic for Work Order operations.
 * This service encapsulates validation, notifications, socket events, and logging.
 * Routes should call this service instead of directly using repositories.
 */

import type { PrismaClient, WorkOrderStatus, WorkOrderPriority, WorkOrderType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { WorkOrderRepository } from '../repositories/WorkOrderRepository'
import type { WorkOrderFilters, WorkOrderWithRelations } from '../repositories/IWorkOrderRepository'
import { onWorkOrderCreated, onWorkOrderStatusChanged, onWorkOrderAssigned } from './WorkOrderNotifications'
import { workOrderCacheService } from './WorkOrderCacheService'
import { socketEmitter } from '@/lib/websocket/emitter'
import { logger } from '@/lib/logger'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

// Types
export interface CreateWorkOrderInput {
    type: WorkOrderType
    title: string
    description: string
    priority?: WorkOrderPriority
    pelangganId?: string
    departmentId?: string
    siteId?: string
    scheduledDate?: Date | string
    ticketId?: string
    isInternal?: boolean
}

export interface UpdateWorkOrderInput {
    title?: string
    description?: string
    priority?: WorkOrderPriority
    status?: WorkOrderStatus
    scheduledDate?: Date | string
    departmentId?: string
    siteId?: string
    assignedToId?: string
    resolutionNotes?: string
}

export interface WorkOrderListOptions {
    page?: number
    limit?: number
    filters?: WorkOrderFilters
    userId?: string
    userPermissions?: string[]
    userDepartmentId?: string
    userSiteId?: string
    userRole?: string
}

export interface ServiceResult<T> {
    success: boolean
    data?: T
    error?: string
    code?: string
}

/**
 * WorkOrderService - Business logic layer for Work Orders
 */
export class WorkOrderService {
    private repository: WorkOrderRepository

    constructor(prismaClient: PrismaClient = prisma) {
        this.repository = new WorkOrderRepository(prismaClient)
    }

    // ==================== LIST OPERATIONS ====================

    /**
     * Get paginated list of work orders with site/department restrictions
     */
    async getWorkOrders(options: WorkOrderListOptions): Promise<ServiceResult<{
        workOrders: any[]
        total: number
        page: number
        totalPages: number
    }>> {
        try {
            const {
                page = 1,
                limit = 20,
                filters = {},
                userId,
                userPermissions = [],
                userDepartmentId,
                userSiteId,
                userRole,
            } = options

            const appliedFilters = { ...filters }

            // Apply department restriction
            const hasDepartmentRestriction = userPermissions.includes('workorders:department_only')
            const isSuperAdmin = userRole === 'SUPER_ADMIN'

            if (hasDepartmentRestriction && !isSuperAdmin) {
                if (!userDepartmentId) {
                    return {
                        success: true,
                        data: {
                            workOrders: [],
                            total: 0,
                            page,
                            totalPages: 0,
                        },
                    }
                }
                appliedFilters.departmentId = userDepartmentId
            }

            // Apply site restriction
            const hasSiteRestriction = userPermissions.includes('workorders:site_only')
            if (hasSiteRestriction && !isSuperAdmin) {
                if (!userSiteId) {
                    return {
                        success: true,
                        data: {
                            workOrders: [],
                            total: 0,
                            page,
                            totalPages: 0,
                        },
                    }
                }
                appliedFilters.siteId = userSiteId
            }

            // Use optimized query for list views
            const result = await this.repository.findAllForList(appliedFilters, page, limit)

            return { success: true, data: result }
        } catch (error) {
            logger.error('WorkOrderService.getWorkOrders failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to fetch work orders', code: 'FETCH_ERROR' }
        }
    }

    /**
     * Get work order requests (status = REQUESTED)
     */
    async getWorkOrderRequests(
        filters: { departmentId?: string; siteId?: string; search?: string },
        page: number = 1,
        limit: number = 20
    ): Promise<ServiceResult<{
        workOrders: any[]
        total: number
        page: number
        totalPages: number
    }>> {
        try {
            const result = await this.repository.findAllRequests(filters, page, limit)
            return { success: true, data: result }
        } catch (error) {
            logger.error('WorkOrderService.getWorkOrderRequests failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to fetch work order requests', code: 'FETCH_ERROR' }
        }
    }

    /**
     * Get work order statistics
     */
    async getStatistics(filters: { departmentId?: string; siteId?: string; assignedToId?: string }): Promise<ServiceResult<any>> {
        try {
            const stats = await this.repository.getStatistics(filters)
            return { success: true, data: stats }
        } catch (error) {
            logger.error('WorkOrderService.getStatistics failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to fetch statistics', code: 'FETCH_ERROR' }
        }
    }

    /**
     * Get recent work orders
     */
    async getRecentWorkOrders(limit: number = 5, filters: { departmentId?: string }): Promise<ServiceResult<any[]>> {
        try {
            const workOrders = await this.repository.getRecentWorkOrders(limit, filters)
            return { success: true, data: workOrders }
        } catch (error) {
            logger.error('WorkOrderService.getRecentWorkOrders failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to fetch recent work orders', code: 'FETCH_ERROR' }
        }
    }

    /**
     * Get single work order by ID
     */
    async getWorkOrderById(id: string): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            const workOrder = await this.repository.findById(id)
            
            if (!workOrder) {
                return { success: false, error: 'Work order not found', code: 'NOT_FOUND' }
            }

            return { success: true, data: workOrder }
        } catch (error) {
            logger.error('WorkOrderService.getWorkOrderById failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to fetch work order', code: 'FETCH_ERROR' }
        }
    }

    // ==================== CREATE OPERATIONS ====================

    /**
     * Create new work order with validation, notifications, and logging
     */
    async createWorkOrder(
        input: CreateWorkOrderInput,
        createdById: string
    ): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            // Validation
            if (!input.type || !input.title || !input.description) {
                return {
                    success: false,
                    error: 'Type, title, and description are required',
                    code: 'VALIDATION_ERROR',
                }
            }

            // Create work order - ensure scheduledDate is Date or undefined
            const { scheduledDate: rawScheduledDate, ...restInput } = input
            const createData = {
                ...restInput,
                createdById,
                ...(rawScheduledDate && { scheduledDate: new Date(rawScheduledDate) }),
            }

            const workOrder = await this.repository.create(createData)

            // Trigger notifications
            await this.notifyWorkOrderCreated(workOrder)

            // Broadcast socket event
            this.broadcastWorkOrderCreated(workOrder)

            // Link to ticket if present
            if (input.ticketId) {
                await this.linkToTicket(workOrder, input.ticketId, createdById)
            }

            // Log activity
            await this.logActivity('CREATE', 'Work Order', createdById, {
                id: workOrder.id,
                number: workOrder.workOrderNumber,
                title: workOrder.title,
            })

            // Invalidate cache
            await workOrderCacheService.invalidateAllCaches()

            return { success: true, data: workOrder as WorkOrderWithRelations }
        } catch (error) {
            logger.error('WorkOrderService.createWorkOrder failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to create work order', code: 'CREATE_ERROR' }
        }
    }

    // ==================== UPDATE OPERATIONS ====================

    /**
     * Update work order
     */
    async updateWorkOrder(
        id: string,
        input: UpdateWorkOrderInput,
        updatedById: string
    ): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            // Check exists
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Work order not found', code: 'NOT_FOUND' }
            }

            // Update - ensure scheduledDate is Date or undefined
            const { scheduledDate: rawScheduledDate, ...restInput } = input
            const updateData = {
                ...restInput,
                ...(rawScheduledDate && { scheduledDate: new Date(rawScheduledDate) }),
            }

            const updated = await this.repository.update(id, updateData)

            // Log activity
            await this.logActivity('UPDATE', 'Work Order', updatedById, {
                id: updated.id,
                number: updated.workOrderNumber,
                changes: input,
            })

            // Invalidate cache
            await workOrderCacheService.invalidateAllCaches()

            // Refetch with relations
            const result = await this.repository.findById(id)
            return { success: true, data: result as WorkOrderWithRelations }
        } catch (error) {
            logger.error('WorkOrderService.updateWorkOrder failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to update work order', code: 'UPDATE_ERROR' }
        }
    }

    /**
     * Update work order status with notifications
     */
    async updateStatus(
        id: string,
        status: WorkOrderStatus,
        userId: string,
        resolutionNotes?: string
    ): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Work order not found', code: 'NOT_FOUND' }
            }

            const previousStatus = existing.status

            // Update status
            let updated
            if (status === 'COMPLETED' && resolutionNotes) {
                updated = await this.repository.complete(id, resolutionNotes, userId)
            } else {
                updated = await this.repository.updateStatus(id, status, userId)
            }

            // Fetch full WO data for notification
            const fullWorkOrder = await this.repository.findById(id)
            
            // Notify status change
            if (fullWorkOrder) {
                await onWorkOrderStatusChanged(
                    {
                        id: fullWorkOrder.id,
                        workOrderNumber: fullWorkOrder.workOrderNumber,
                        title: fullWorkOrder.title,
                        type: fullWorkOrder.type,
                        priority: fullWorkOrder.priority,
                        departmentId: fullWorkOrder.departmentId,
                        siteId: fullWorkOrder.siteId,
                        assignedToId: fullWorkOrder.assignedToId,
                    },
                    previousStatus,
                    status,
                    userId
                )
            }

            // Log activity
            await this.logActivity('STATUS_CHANGE', 'Work Order', userId, {
                id,
                from: previousStatus,
                to: status,
            })

            // Invalidate cache
            await workOrderCacheService.invalidateAllCaches()

            const result = await this.repository.findById(id)
            return { success: true, data: result as WorkOrderWithRelations }
        } catch (error) {
            logger.error('WorkOrderService.updateStatus failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to update status', code: 'STATUS_ERROR' }
        }
    }

    // ==================== ASSIGNMENT OPERATIONS ====================

    /**
     * Assign work order to employee
     */
    async assignWorkOrder(
        id: string,
        employeeId: string,
        assignedById: string,
        role?: string
    ): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Work order not found', code: 'NOT_FOUND' }
            }

            // Validate employee status
            const employee = await prisma.user.findUnique({
                where: { id: employeeId },
                select: { id: true, name: true, isActive: true }
            })

            if (!employee) {
                return { success: false, error: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' }
            }

            if (!employee.isActive) {
                return {
                    success: false,
                    error: `Cannot assign work order to inactive employee: ${employee.name || 'Unknown'}`,
                    code: 'EMPLOYEE_INACTIVE'
                }
            }

            // Assign
            await this.repository.assign(id, employeeId, role, assignedById)

            // Notify
            const fullWorkOrder = await this.repository.findById(id)
            if (fullWorkOrder) {
                await onWorkOrderAssigned(
                    {
                        id: fullWorkOrder.id,
                        workOrderNumber: fullWorkOrder.workOrderNumber,
                        title: fullWorkOrder.title,
                        type: fullWorkOrder.type,
                        priority: fullWorkOrder.priority,
                        departmentId: fullWorkOrder.departmentId,
                        siteId: fullWorkOrder.siteId,
                        assignedToId: fullWorkOrder.assignedToId,
                    },
                    undefined,
                    assignedById
                )
            }

            // Log activity
            await this.logActivity('ASSIGN', 'Work Order', assignedById, {
                id,
                employeeId,
                role,
            })

            // Invalidate cache
            await workOrderCacheService.invalidateAllCaches()

            const result = await this.repository.findById(id)
            return { success: true, data: result as WorkOrderWithRelations }
        } catch (error) {
            logger.error('WorkOrderService.assignWorkOrder failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to assign work order', code: 'ASSIGN_ERROR' }
        }
    }

    // ==================== APPROVAL OPERATIONS ====================

    /**
     * Approve work order request
     */
    async approveRequest(
        id: string,
        approvedById: string
    ): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Work order not found', code: 'NOT_FOUND' }
            }

            if (existing.status !== 'REQUESTED') {
                return {
                    success: false,
                    error: 'Only REQUESTED work orders can be approved',
                    code: 'INVALID_STATUS',
                }
            }

            await this.repository.approveRequest(id, approvedById)

            // Log activity
            await this.logActivity('APPROVE', 'Work Order', approvedById, {
                id,
                number: existing.workOrderNumber,
            })

            // Invalidate cache
            await workOrderCacheService.invalidateAllCaches()

            const result = await this.repository.findById(id)
            return { success: true, data: result as WorkOrderWithRelations }
        } catch (error) {
            logger.error('WorkOrderService.approveRequest failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to approve request', code: 'APPROVE_ERROR' }
        }
    }

    /**
     * Reject work order request
     */
    async rejectRequest(
        id: string,
        rejectedById: string,
        reason: string
    ): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            if (!reason) {
                return { success: false, error: 'Rejection reason is required', code: 'VALIDATION_ERROR' }
            }

            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Work order not found', code: 'NOT_FOUND' }
            }

            if (existing.status !== 'REQUESTED') {
                return {
                    success: false,
                    error: 'Only REQUESTED work orders can be rejected',
                    code: 'INVALID_STATUS',
                }
            }

            await this.repository.rejectRequest(id, rejectedById, reason)

            // Log activity
            await this.logActivity('REJECT', 'Work Order', rejectedById, {
                id,
                number: existing.workOrderNumber,
                reason,
            })

            // Invalidate cache
            await workOrderCacheService.invalidateAllCaches()

            const result = await this.repository.findById(id)
            return { success: true, data: result as WorkOrderWithRelations }
        } catch (error) {
            logger.error('WorkOrderService.rejectRequest failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to reject request', code: 'REJECT_ERROR' }
        }
    }

    // ==================== DELETE OPERATIONS ====================

    /**
     * Delete work order
     */
    async deleteWorkOrder(id: string, deletedById: string): Promise<ServiceResult<void>> {
        try {
            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Work order not found', code: 'NOT_FOUND' }
            }

            await this.repository.delete(id)

            // Log activity
            await this.logActivity('DELETE', 'Work Order', deletedById, {
                id,
                number: existing.workOrderNumber,
            })

            // Invalidate cache
            await workOrderCacheService.invalidateAllCaches()

            return { success: true }
        } catch (error) {
            logger.error('WorkOrderService.deleteWorkOrder failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to delete work order', code: 'DELETE_ERROR' }
        }
    }

    // ==================== PRIVATE HELPERS ====================

    private async notifyWorkOrderCreated(workOrder: any): Promise<void> {
        try {
            await onWorkOrderCreated({
                id: workOrder.id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: workOrder.type,
                priority: workOrder.priority,
                departmentId: workOrder.departmentId,
                siteId: workOrder.siteId,
                assignedToId: workOrder.assignedToId,
            })
        } catch (err) {
            logger.error('Failed to send work order notification', err instanceof Error ? err : undefined)
        }
    }

    private broadcastWorkOrderCreated(workOrder: any): void {
        try {
            socketEmitter.newWorkOrder({
                id: workOrder.id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: workOrder.type,
                status: workOrder.status,
                priority: workOrder.priority,
                departmentId: workOrder.departmentId || undefined,
                assignedToId: workOrder.assignedToId || undefined,
                createdAt: workOrder.createdAt.toISOString(),
            }, workOrder.departmentId || undefined)
        } catch (err) {
            logger.error('Failed to broadcast work order event', err instanceof Error ? err : undefined)
        }
    }

    private async linkToTicket(
        workOrder: any,
        ticketId: string,
        userId: string
    ): Promise<void> {
        try {
            const scheduledTime = workOrder.scheduledDate
                ? format(new Date(workOrder.scheduledDate), 'dd MMMM yyyy HH:mm', { locale: localeId })
                : 'Belum Dijadwalkan'

            const replyMessage = `Work Order #${workOrder.workOrderNumber} telah dibuat untuk tiket ini.\n\n` +
                `Judul: ${workOrder.title}\n` +
                `Tipe: ${workOrder.type}\n` +
                `Jadwal: ${scheduledTime}`

            await prisma.ticketReplies.create({
                data: {
                    id: crypto.randomUUID(),
                    ticketId,
                    message: replyMessage,
                    isFromAdmin: true,
                    senderId: userId,
                },
            })

            await prisma.supportTickets.update({
                where: { id: ticketId },
                data: { status: 'IN_PROGRESS' },
            })
        } catch (err) {
            logger.error('Failed to link work order to ticket', err instanceof Error ? err : undefined)
        }
    }

    private async logActivity(
        action: string,
        subject: string,
        userId: string,
        details: Record<string, any>
    ): Promise<void> {
        try {
            await logger.logActivity({ action, subject, userId, details })
        } catch (error) {
            console.error('Logging failed', error)
        }
    }

    // ==================== COMMENT & TASK OPERATIONS ====================

    /**
     * Add a comment to a work order
     */
    async addComment(
        workOrderId: string,
        message: string,
        userId: string
    ): Promise<ServiceResult<any>> {
        try {
            const comment = await this.repository.addComment(workOrderId, message, userId)
            return { success: true, data: comment }
        } catch (error) {
            logger.error('Failed to add comment', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to add comment', code: 'OPERATION_FAILED' }
        }
    }

    /**
     * Add a task to a work order
     */
    async addTask(
        workOrderId: string,
        taskData: {
            title: string
            description?: string
            order?: number
        }
    ): Promise<ServiceResult<any>> {
        try {
            const task = await this.repository.addTask({
                workOrderId,
                title: taskData.title,
                ...(taskData.description && { description: taskData.description }),
                ...(taskData.order !== undefined && { order: taskData.order }),
            })
            return { success: true, data: task }
        } catch (error) {
            logger.error('Failed to add task', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to add task', code: 'OPERATION_FAILED' }
        }
    }
}

// Singleton instance
let workOrderServiceInstance: WorkOrderService | null = null

export function getWorkOrderService(): WorkOrderService {
    if (!workOrderServiceInstance) {
        workOrderServiceInstance = new WorkOrderService()
    }
    return workOrderServiceInstance
}
