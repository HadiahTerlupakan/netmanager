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
export interface UserContext {
    id: string
    role?: string
    permissions?: string[]
    siteId?: string
    departmentId?: string
    isSuperAdmin?: boolean
}

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
        workOrders: unknown[]
        total: number
        page: number
        totalPages: number
    }>> {
        try {
            const {
                page = 1,
                limit = 20,
                filters = {},
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
        workOrders: unknown[]
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
    async getStatistics(filters: { departmentId?: string; siteId?: string; assignedToId?: string }): Promise<ServiceResult<unknown>> {
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
    async getRecentWorkOrders(limit: number = 5, filters: { departmentId?: string }): Promise<ServiceResult<unknown[]>> {
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
    async getWorkOrderById(id: string, userContext?: UserContext): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            if (userContext) {
                await this.validateWorkOrderAccess(id, userContext)
            }

            const workOrder = await this.repository.findById(id)

            if (!workOrder) {
                return { success: false, error: 'Work order not found', code: 'NOT_FOUND' }
            }

            return { success: true, data: workOrder }
        } catch (error) {
            logger.error('WorkOrderService.getWorkOrderById failed', error instanceof Error ? error : undefined)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch work order',
                code: error instanceof Error && error.message.includes('Access denied') ? 'FORBIDDEN' : 'FETCH_ERROR'
            }
        }
    }

    // ==================== CREATE OPERATIONS ====================

    /**
     * Create new work order with validation, notifications, and logging
     */
    async createWorkOrder(
        input: CreateWorkOrderInput,
        userContext: UserContext
    ): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            const { role, permissions = [], siteId: userSiteId, departmentId: userDeptId, id: createdById } = userContext
            const isSuperAdmin = role === 'SUPER_ADMIN'

            // Validation
            if (!input.type || !input.title || !input.description) {
                return {
                    success: false,
                    error: 'Type, title, and description are required',
                    code: 'VALIDATION_ERROR',
                }
            }

            // Site restriction
            if (permissions.includes('workorders:site_only') && !isSuperAdmin) {
                if (input.siteId && input.siteId !== userSiteId) {
                    return {
                        success: false,
                        error: 'Access denied: You can only create work orders for your assigned site',
                        code: 'FORBIDDEN',
                    }
                }
                input.siteId = userSiteId
            }

            // Department restriction
            if (permissions.includes('workorders:department_only') && !isSuperAdmin) {
                if (input.departmentId && input.departmentId !== userDeptId) {
                    return {
                        success: false,
                        error: 'Access denied: You can only create work orders for your assigned department',
                        code: 'FORBIDDEN',
                    }
                }
                input.departmentId = userDeptId
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
        userContext: UserContext
    ): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            // Validate access
            await this.validateWorkOrderAccess(id, userContext)

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
            await this.logActivity('UPDATE', 'Work Order', userContext.id, {
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
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update work order',
                code: error instanceof Error && error.message.includes('Access denied') ? 'FORBIDDEN' : 'UPDATE_ERROR'
            }
        }
    }

    /**
     * Update work order status with notifications
     */
    async updateStatus(
        id: string,
        status: WorkOrderStatus,
        userContext: UserContext,
        resolutionNotes?: string
    ): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            // Validate access
            await this.validateWorkOrderAccess(id, userContext)

            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Work order not found', code: 'NOT_FOUND' }
            }

            const previousStatus = existing.status
            const userId = userContext.id

            // Update status
            if (status === 'COMPLETED' && resolutionNotes) {
                await this.repository.complete(id, resolutionNotes, userId)
            } else {
                await this.repository.updateStatus(id, status, userId)
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
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update status',
                code: error instanceof Error && error.message.includes('Access denied') ? 'FORBIDDEN' : 'STATUS_ERROR'
            }
        }
    }

    // ==================== ASSIGNMENT OPERATIONS ====================

    /**
     * Assign work order to employee
     */
    async assignWorkOrder(
        id: string,
        employeeId: string,
        userContext: UserContext,
        role?: string
    ): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            // Validate access
            await this.validateWorkOrderAccess(id, userContext)

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

            const assignedById = userContext.id

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
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to assign work order',
                code: error instanceof Error && error.message.includes('Access denied') ? 'FORBIDDEN' : 'ASSIGN_ERROR'
            }
        }
    }

    // ==================== APPROVAL OPERATIONS ====================

    /**
     * Approve work order request
     */
    async approveRequest(
        id: string,
        userContext: UserContext
    ): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            // Validate access
            await this.validateWorkOrderAccess(id, userContext)

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

            const approvedById = userContext.id
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
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to approve request',
                code: error instanceof Error && error.message.includes('Access denied') ? 'FORBIDDEN' : 'APPROVE_ERROR'
            }
        }
    }

    /**
     * Reject work order request
     */
    async rejectRequest(
        id: string,
        userContext: UserContext,
        reason: string
    ): Promise<ServiceResult<WorkOrderWithRelations>> {
        try {
            // Validate access
            await this.validateWorkOrderAccess(id, userContext)

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

            const rejectedById = userContext.id
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
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to reject request',
                code: error instanceof Error && error.message.includes('Access denied') ? 'FORBIDDEN' : 'REJECT_ERROR'
            }
        }
    }

    // ==================== DELETE OPERATIONS ====================

    /**
     * Delete work order
     */
    async deleteWorkOrder(id: string, userContext: UserContext): Promise<ServiceResult<void>> {
        try {
            // Validate access
            await this.validateWorkOrderAccess(id, userContext)

            const existing = await this.repository.findById(id)
            if (!existing) {
                return { success: false, error: 'Work order not found', code: 'NOT_FOUND' }
            }

            const deletedById = userContext.id
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
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete work order',
                code: error instanceof Error && error.message.includes('Access denied') ? 'FORBIDDEN' : 'DELETE_ERROR'
            }
        }
    }

    // ==================== MATERIAL & TEMPLATE OPERATIONS ====================

    /**
     * Add material usage to work order
     */
    async addMaterial(
        workOrderId: string,
        barangId: string,
        quantity: number,
        userContext: UserContext,
        notes?: string,
        preferredGudangId?: string
    ): Promise<ServiceResult<unknown>> {
        try {
            // Validate access
            await this.validateWorkOrderAccess(workOrderId, userContext)

            const actorId = userContext.id
            return await prisma.$transaction(async (tx) => {
                // Check work order
                const workOrder = await tx.workOrders.findUnique({ where: { id: workOrderId } })
                if (!workOrder) {
                    throw new Error('Work order not found')
                }

                // Check barang
                // If preferredGudangId is provided, look there first.
                // If not, we still fail-safe by explicitly requiring one or falling back to "highest stock" 
                // but user concern suggests we should be safer. 
                // Logic: 
                // 1. If preferredGudangId, filter by it.
                // 2. If not, defaults to "highest stock" (existing behavior), but we can log unique warehouse usage if needed.
                
                const barang = await tx.barang.findUnique({ 
                    where: { id: barangId },
                    include: {
                        barangGudang: {
                            where: { 
                                stok: { gt: 0 },
                                ...(preferredGudangId ? { gudangId: preferredGudangId } : {})
                            },
                            orderBy: { stok: 'desc' }, // Use warehouse with most stock first
                            take: 1
                        }
                    }
                })

                if (!barang) {
                    throw new Error('Barang not found')
                }

                // Find available stock
                const gudangSource = barang.barangGudang[0]
                if (!gudangSource || gudangSource.stok < quantity) {
                     // Note: Simple check. For production, might need to split across warehouses if needed.
                    throw new Error(`Insufficient stock. Available: ${gudangSource?.stok || 0}`)
                }

                const deductAmount = quantity

                // Deduct stock
                await tx.barangGudang.update({
                    where: {
                        barangId_gudangId: {
                            barangId,
                            gudangId: gudangSource.gudangId
                        }
                    },
                    data: {
                        stok: { decrement: deductAmount }
                    }
                })

                // Create usage record
                const material = await tx.workOrderMaterial.create({
                    data: {
                        workOrderId,
                        barangId,
                        quantity: quantity, // Prisma schema updated to Float
                        notes: notes ?? null,
                        satuan: barang.satuan
                    },
                    include: {
                        barang: true
                    }
                })

                // Record transaction log (BarangKeluar)
                await tx.barangKeluar.create({
                    data: {
                        id: crypto.randomUUID(),
                        barangId,
                        gudangId: gudangSource.gudangId,
                        jumlah: deductAmount,
                        tanggal: new Date(),
                        kondisi: 'BARU',
                        keterangan: `Used in Work Order #${workOrder.workOrderNumber}`,
                        tujuanPenggunaan: 'WORK_ORDER',
                        userId: actorId, // Use actorId instead of workOrder.assignedToId
                    }
                })

                return { success: true, data: material }
            })
        } catch (error) {
            logger.error('WorkOrderService.addMaterial failed', error instanceof Error ? error : undefined)
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to add material', 
                code: 'ADD_MATERIAL_ERROR' 
            }
        }
    }

    /**
     * Create tasks from template
     */
    async createTasksFromTemplate(
        workOrderId: string,
        templateId: string,
        userContext: UserContext
    ): Promise<ServiceResult<unknown>> {
        try {
            // Validate access
            await this.validateWorkOrderAccess(workOrderId, userContext)

            // Check work order
            const workOrder = await this.repository.findById(workOrderId)
            if (!workOrder) {
                return { success: false, error: 'Work order not found', code: 'NOT_FOUND' }
            }

            // Get template items
            const templateItems = await prisma.workOrderTemplateItem.findMany({
                where: { templateId },
                orderBy: { order: 'asc' }
            })

            if (templateItems.length === 0) {
                return { success: false, error: 'Template has no items', code: 'EMPTY_TEMPLATE' }
            }

            // Create tasks
            const tasks = await prisma.$transaction(
                templateItems.map(item =>
                    prisma.workOrderTasks.create({
                        data: {
                            id: crypto.randomUUID(),
                            workOrderId,
                            title: item.title,
                            description: item.description,
                            order: item.order,
                            status: 'PENDING',
                            updatedAt: new Date()
                        }
                    })
                )
            )

            return { success: true, data: tasks }
        } catch (error) {
            logger.error('WorkOrderService.createTasksFromTemplate failed', error instanceof Error ? error : undefined)
            return { success: false, error: 'Failed to create tasks from template', code: 'CREATE_TASKS_ERROR' }
        }
    }

    // ==================== PRIVATE HELPERS ====================

    /**
     * Validate user access to a specific work order based on RBAC and restrictions
     */
    private async validateWorkOrderAccess(workOrderId: string, userContext: UserContext): Promise<void> {
        const { role, permissions = [], departmentId: userDeptId, siteId: userSiteId, isSuperAdmin: userIsSuperAdmin } = userContext

        // Bypass for SUPER_ADMIN
        const isSuperAdmin = userIsSuperAdmin || role === 'SUPER_ADMIN' || role === 'Super Admin'
        if (isSuperAdmin) return

        // Fetch work order to check its department/site
        const workOrder = await this.repository.findById(workOrderId)
        if (!workOrder) {
            throw new Error('Work order not found')
        }

        // Check department restriction
        if (permissions.includes('workorders:department_only')) {
            if (workOrder.departmentId !== userDeptId) {
                throw new Error('Access denied: Different department')
            }
        }

        // Check site restriction
        if (permissions.includes('workorders:site_only')) {
            if (workOrder.siteId !== userSiteId) {
                throw new Error('Access denied: Different site')
            }
        }
    }

    private async notifyWorkOrderCreated(workOrder: unknown): Promise<void> {
        try {
            const wo = workOrder as {
                id: string;
                workOrderNumber: string;
                title: string;
                type: string;
                priority: string;
                departmentId?: string | null;
                siteId?: string | null;
                assignedToId?: string | null;
            };
            await onWorkOrderCreated({
                id: wo.id,
                workOrderNumber: wo.workOrderNumber,
                title: wo.title,
                type: wo.type,
                priority: wo.priority,
                departmentId: wo.departmentId,
                siteId: wo.siteId,
                assignedToId: wo.assignedToId,
            })
        } catch (err) {
            logger.error('Failed to send work order notification', err instanceof Error ? err : undefined)
        }
    }

    private broadcastWorkOrderCreated(workOrder: unknown): void {
        try {
            const wo = workOrder as {
                id: string;
                workOrderNumber: string;
                title: string;
                type: string;
                status: string;
                priority: string;
                departmentId?: string | null;
                assignedToId?: string | null;
                createdAt: Date;
            };
            socketEmitter.newWorkOrder({
                id: wo.id,
                workOrderNumber: wo.workOrderNumber,
                title: wo.title,
                type: wo.type,
                status: wo.status as WorkOrderStatus,
                priority: wo.priority as WorkOrderPriority,
                departmentId: wo.departmentId || undefined,
                assignedToId: wo.assignedToId || undefined,
                createdAt: wo.createdAt.toISOString(),
            }, wo.departmentId || undefined)
        } catch (err) {
            logger.error('Failed to broadcast work order event', err instanceof Error ? err : undefined)
        }
    }

    private async linkToTicket(
        workOrder: unknown,
        ticketId: string,
        userId: string
    ): Promise<void> {
        try {
            const wo = workOrder as {
                workOrderNumber: string;
                title: string;
                type: string;
                scheduledDate?: Date | string | null;
            };
            const scheduledTime = wo.scheduledDate
                ? format(new Date(wo.scheduledDate), 'dd MMMM yyyy HH:mm', { locale: localeId })
                : 'Belum Dijadwalkan'

            const replyMessage = `Work Order #${wo.workOrderNumber} telah dibuat untuk tiket ini.\n\n` +
                `Judul: ${wo.title}\n` +
                `Tipe: ${wo.type}\n` +
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
        details: Record<string, unknown>
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
        userContext: UserContext
    ): Promise<ServiceResult<unknown>> {
        try {
            // Validate access
            await this.validateWorkOrderAccess(workOrderId, userContext)

            const comment = await this.repository.addComment(workOrderId, message, userContext.id)
            return { success: true, data: comment }
        } catch (error) {
            logger.error('Failed to add comment', error instanceof Error ? error : undefined)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to add comment',
                code: error instanceof Error && error.message.includes('Access denied') ? 'FORBIDDEN' : 'OPERATION_FAILED'
            }
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
        },
        userContext: UserContext
    ): Promise<ServiceResult<unknown>> {
        try {
            // Validate access
            await this.validateWorkOrderAccess(workOrderId, userContext)

            const task = await this.repository.addTask({
                workOrderId,
                title: taskData.title,
                ...(taskData.description && { description: taskData.description }),
                ...(taskData.order !== undefined && { order: taskData.order }),
            })
            return { success: true, data: task }
        } catch (error) {
            logger.error('Failed to add task', error instanceof Error ? error : undefined)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to add task',
                code: error instanceof Error && error.message.includes('Access denied') ? 'FORBIDDEN' : 'OPERATION_FAILED'
            }
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
