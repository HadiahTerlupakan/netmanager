import { PrismaClient } from '@prisma/client';
import type { WorkOrders, WorkOrderTasks, WorkOrderAssignments, WorkOrderUpdates, WorkOrderAttachments, WorkOrderStatus, WorkOrderPriority, TaskStatus, WorkOrderType } from '@prisma/client';
import type {
    IWorkOrderRepository,
    WorkOrderWithRelations,
    CreateWorkOrderData,
    UpdateWorkOrderData,
    CreateTaskData,
    UpdateTaskData,
    AddUpdateData,
    WorkOrderFilters,
    WorkOrderStatistics,
    TopPerformer,
} from './IWorkOrderRepository';
import { syncWoStatusToTicket } from '../services/WorkOrderSyncService';
import { 
    notifyNewWorkOrder, 
    notifyWorkOrderAssigned, 
    notifyWorkOrderStatusChange, 
    notifyWorkOrderUpdate 
} from '../../notification/services/NotificationService';
import { randomUUID } from 'crypto';
import { socketEmitter } from '@/lib/websocket/emitter';

export class WorkOrderRepository implements IWorkOrderRepository {
    constructor(private prisma: PrismaClient) { }

    async generateWorkOrderNumber(): Promise<string> {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        // Get the highest sequence number for today instead of just count
        // This handles deleted records and race conditions better
        const lastWo = await this.prisma.workOrders.findFirst({
            where: {
                workOrderNumber: {
                    startsWith: `WO-${dateStr}-`,
                },
            },
            orderBy: {
                workOrderNumber: 'desc',
            },
            select: {
                workOrderNumber: true,
            },
        });

        let nextSequence = 1;
        if (lastWo?.workOrderNumber) {
            // Extract the sequence part: WO-YYYYMMDD-XXXX -> XXXX
            const parts = lastWo.workOrderNumber.split('-');
            if (parts.length >= 3) {
                const lastSequence = parseInt(parts[2], 10);
                if (!isNaN(lastSequence)) {
                    nextSequence = lastSequence + 1;
                }
            }
        }

        const sequence = nextSequence.toString().padStart(4, '0');
        return `WO-${dateStr}-${sequence}`;
    }

    async create(data: CreateWorkOrderData): Promise<WorkOrders> {
        const MAX_RETRIES = 3;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const workOrderNumber = await this.generateWorkOrderNumber();

                // Destructure pelangganId to handle it separately
                const { pelangganId, ...restData } = data;

                const result = await this.prisma.workOrders.create({
                    data: {
                        id: randomUUID(),
                        updatedAt: new Date(),
                        workOrderNumber,
                        type: restData.type,
                        title: restData.title,
                        description: restData.description,
                        status: 'PENDING',
                        priority: data.priority || 'NORMAL',
                        createdById: data.createdById,
                        pelangganId: pelangganId || null,
                        siteId: restData.siteId || null,
                        departmentId: restData.departmentId || null,
                        assignedToId: restData.assignedToId || null,
                        contactName: restData.contactName,
                        contactPhone: restData.contactPhone,
                        locationAddress: restData.locationAddress,
                        scheduledDate: restData.scheduledDate,
                        scheduledTimeStart: restData.scheduledTimeStart,
                        scheduledTimeEnd: restData.scheduledTimeEnd,
                        estimatedHours: restData.estimatedHours,
                        estimatedCost: restData.estimatedCost,
                        requiredMaterials: restData.requiredMaterials ?? undefined,
                        internalNotes: restData.internalNotes,
                        disconnectionReason: restData.disconnectionReason || null,
                    },
                });

                // Notify Creation
                await notifyNewWorkOrder({
                    workOrderId: result.id,
                    workOrderNumber: result.workOrderNumber,
                    title: result.title,
                    type: result.type,
                    priority: result.priority,
                    departmentId: result.departmentId || undefined,
                    siteId: result.siteId || undefined,
                    assignedToId: result.assignedToId || undefined
                }).catch(err => console.error('Failed to notify new WO:', err));

                return result;
            } catch (error: any) {
                // Check if this is a unique constraint violation on workOrderNumber
                if (error?.code === 'P2002' && error?.meta?.target?.includes('workOrderNumber')) {
                    console.warn(`[WorkOrderRepo] Unique constraint violation on workOrderNumber, retry attempt ${attempt + 1}/${MAX_RETRIES}`);
                    lastError = error;
                    // Wait a bit before retrying with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, attempt)));
                    continue;
                }
                // For other errors, throw immediately
                throw error;
            }
        }

        // If all retries failed, throw the last error
        console.error('[WorkOrderRepo] Failed to create work order after all retries');
        throw lastError || new Error('Failed to create work order after max retries');
    }

    async findById(id: string): Promise<WorkOrderWithRelations | null> {
        return this.prisma.workOrders.findUnique({
            where: { id },
            include: {
                pelanggan: {
                    select: {
                        id: true,
                        idPelanggan: true,
                        nama: true,
                        email: true,
                        noTelp: true,
                        alamat: true,
                    },
                },
                site: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                    },
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                tasks: {
                    orderBy: { order: 'asc' },
                },
                assignments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                updates: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
                attachments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: {
                        uploadedAt: 'desc',
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
    }

    async findByWorkOrderNumber(workOrderNumber: string): Promise<WorkOrderWithRelations | null> {
        return this.prisma.workOrders.findUnique({
            where: { workOrderNumber },
            include: {
                pelanggan: {
                    select: {
                        id: true,
                        idPelanggan: true,
                        nama: true,
                        email: true,
                        noTelp: true,
                        alamat: true,
                    },
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                tasks: {
                    orderBy: { order: 'asc' },
                },
                assignments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                updates: {
                    include: {
                        user: {
                            select: {
                                name: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                attachments: {
                    orderBy: { uploadedAt: 'desc' },
                },
            },
        });
    }

    async findAll(
        filters?: WorkOrderFilters,
        page: number = 1,
        limit: number = 20
    ): Promise<{
        workOrders: WorkOrderWithRelations[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const where: any = {};

        if (filters?.status) {
            where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
        }

        if (filters?.priority) {
            where.priority = Array.isArray(filters.priority) ? { in: filters.priority } : filters.priority;
        }

        if (filters?.type) {
            where.type = Array.isArray(filters.type) ? { in: filters.type } : filters.type;
        }

        if (filters?.departmentId) {
            where.departmentId = filters.departmentId;
        }

        if (filters?.unassignedOnly) {
            where.assignedToId = null;
        }

        if (filters?.involvedUserId) {
            // Filter for assignments that are NOT rejected (PENDING or APPROVED)
            const userFilter = {
                OR: [
                    { assignedToId: filters.involvedUserId },
                    {
                        assignments: {
                            some: {
                                userId: filters.involvedUserId,
                                status: { not: 'REJECTED' } // Exclude rejected assignments
                            }
                        }
                    }
                ]
            };

            if (where.OR) {
                // If there's already an OR (e.g. from search), we need to wrap everything in AND
                where.AND = [
                    ...(where.AND || []),
                    { OR: where.OR },
                    userFilter
                ];
                delete where.OR;
            } else {
                // Just merge into where, but since OR is top level, effectively we are doing implicit AND with other fields
                // Wait, if I set where.OR = userFilter.OR, it conflicts with future ORs?
                // Actually, if search comes later, it might overwrite.
                // Safest to add to AND array if we anticipate multiple complex conditions.
                // But for now, let's just push to AND if OR exists, otherwise set OR.
                // However, search logic is below.
                // Let's defer applying involvedUserId until after search check or integrate it carefully.
                // A better pattern for Prisma is to build an array of conditions and assign to AND at the end if > 1.

                // Let's follow the existing pattern:
                where.OR = [
                    { assignedToId: filters.involvedUserId },
                    {
                        assignments: {
                            some: {
                                userId: filters.involvedUserId,
                                status: { not: 'REJECTED' } // Exclude rejected assignments  
                            }
                        }
                    }
                ];
            }
        } else if (filters?.assignedToId !== undefined) {
            // Only apply specific assignedToId if involvedUserId isn't set (priority)
            where.assignedToId = filters.assignedToId;
        }

        if (filters?.pelangganId) {
            where.pelangganId = filters.pelangganId;
        }

        if (filters?.siteId) {
            where.siteId = filters.siteId;
        }
        
        if (filters?.search) {
            const searchFilter = {
                OR: [
                    { workOrderNumber: { contains: filters.search, mode: 'insensitive' } },
                    { title: { contains: filters.search, mode: 'insensitive' } },
                    { description: { contains: filters.search, mode: 'insensitive' } },
                ]
            };

            if (where.OR) {
                // involvedUserId already set an OR
                where.AND = [
                    { OR: where.OR },
                    searchFilter // This has its own OR
                ];
                delete where.OR;
            } else {
                where.OR = searchFilter.OR;
            }
        }

        if (filters?.dateFrom || filters?.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
            if (filters.dateTo) where.createdAt.lte = filters.dateTo;
        }

        if (filters?.scheduledDateFrom || filters?.scheduledDateTo) {
            where.scheduledDate = {};
            if (filters.scheduledDateFrom) where.scheduledDate.gte = filters.scheduledDateFrom;
            if (filters.scheduledDateTo) where.scheduledDate.lte = filters.scheduledDateTo;
        }

        const [workOrders, total] = await Promise.all([
            this.prisma.workOrders.findMany({
                where,
                include: {
                    pelanggan: {
                        select: {
                            id: true,
                            idPelanggan: true,
                            nama: true,
                            email: true,
                            noTelp: true,
                        },
                    },
                    site: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        },
                    },
                    department: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    tasks: true,
                    assignments: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    updates: {
                        include: {
                            user: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                        orderBy: { createdAt: 'desc' },
                    },
                    attachments: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.workOrders.count({ where }),
        ]);

        return {
            workOrders,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Optimized query for list views - only fetches essential fields
     * Reduces data transfer by ~90% compared to findAll()
     * Does NOT fetch: tasks, assignments, updates, attachments
     */
    async findAllForList(
        filters?: WorkOrderFilters,
        page: number = 1,
        limit: number = 20
    ): Promise<{
        workOrders: import('./IWorkOrderRepository').WorkOrderListItem[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const where: any = {};

        if (filters?.status) {
            where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
        }

        if (filters?.priority) {
            where.priority = Array.isArray(filters.priority) ? { in: filters.priority } : filters.priority;
        }

        if (filters?.type) {
            where.type = Array.isArray(filters.type) ? { in: filters.type } : filters.type;
        }

        if (filters?.departmentId) {
            where.departmentId = filters.departmentId;
        }

        if (filters?.unassignedOnly) {
            where.assignedToId = null;
        }

        if (filters?.involvedUserId) {
            const userFilter = {
                OR: [
                    { assignedToId: filters.involvedUserId },
                    {
                        assignments: {
                            some: {
                                userId: filters.involvedUserId,
                                status: { not: 'REJECTED' }
                            }
                        }
                    }
                ]
            };

            if (where.OR) {
                where.AND = [
                    ...(where.AND || []),
                    { OR: where.OR },
                    userFilter
                ];
                delete where.OR;
            } else {
                where.OR = [
                    { assignedToId: filters.involvedUserId },
                    {
                        assignments: {
                            some: {
                                userId: filters.involvedUserId,
                                status: { not: 'REJECTED' }
                            }
                        }
                    }
                ];
            }
        } else if (filters?.assignedToId !== undefined) {
            where.assignedToId = filters.assignedToId;
        }

        if (filters?.pelangganId) {
            where.pelangganId = filters.pelangganId;
        }

        if (filters?.siteId) {
            where.siteId = filters.siteId;
        }

        if (filters?.search) {
            const searchFilter = {
                OR: [
                    { workOrderNumber: { contains: filters.search, mode: 'insensitive' } },
                    { title: { contains: filters.search, mode: 'insensitive' } },
                    { description: { contains: filters.search, mode: 'insensitive' } },
                ]
            };

            if (where.OR) {
                where.AND = [
                    { OR: where.OR },
                    searchFilter
                ];
                delete where.OR;
            } else {
                where.OR = searchFilter.OR;
            }
        }

        if (filters?.dateFrom || filters?.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
            if (filters.dateTo) where.createdAt.lte = filters.dateTo;
        }

        if (filters?.scheduledDateFrom || filters?.scheduledDateTo) {
            where.scheduledDate = {};
            if (filters.scheduledDateFrom) where.scheduledDate.gte = filters.scheduledDateFrom;
            if (filters.scheduledDateTo) where.scheduledDate.lte = filters.scheduledDateTo;
        }

        // OPTIMIZED: Use select instead of include - only fetch fields needed for list view
        const [workOrders, total] = await Promise.all([
            this.prisma.workOrders.findMany({
                where,
                select: {
                    id: true,
                    workOrderNumber: true,
                    title: true,
                    type: true,
                    status: true,
                    priority: true,
                    scheduledDate: true,
                    contactName: true,
                    createdAt: true,
                    pelanggan: {
                        select: {
                            id: true,
                            idPelanggan: true,
                            nama: true,
                        },
                    },
                    site: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        },
                    },
                    department: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    createdBy: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    // NOTE: Deliberately NOT fetching tasks, assignments, updates, attachments
                    // These are not shown in list view and add significant overhead
                },
                orderBy: {
                    createdAt: 'desc',
                },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.workOrders.count({ where }),
        ]);

        return {
            workOrders: workOrders as import('./IWorkOrderRepository').WorkOrderListItem[],
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async update(id: string, data: UpdateWorkOrderData): Promise<WorkOrders> {
        return this.prisma.workOrders.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date(),
            },
        });
    }

    async delete(id: string): Promise<void> {
        await this.prisma.workOrders.delete({
            where: { id },
        });
    }

    async updateStatus(id: string, status: WorkOrderStatus, userId?: string, timestamp?: Date): Promise<WorkOrders> {
        const workOrder = await this.findById(id);
        if (!workOrder) {
            throw new Error('Work order not found');
        }

        const updateData: any = { status };
        const eventTime = timestamp || new Date();

        if (status === 'IN_PROGRESS' && !workOrder.startedAt) {
            updateData.startedAt = eventTime;
        } else if (status === 'COMPLETED') {
            updateData.completedAt = eventTime;
            if (workOrder.startedAt) {
                const hours = (eventTime.getTime() - new Date(workOrder.startedAt).getTime()) / (1000 * 60 * 60);
                updateData.actualHours = hours;
            }
        } else if (status === 'VERIFIED') {
            updateData.verifiedAt = eventTime;
        } else if (status === 'CLOSED') {
            updateData.closedAt = eventTime;
        }

        await this.addUpdate({
            workOrderId: id,
            updateType: 'STATUS_CHANGE',
            message: `Status changed from ${workOrder.status} to ${status}`,
            oldStatus: workOrder.status,
            newStatus: status,
            createdById: userId,
        });

        const updatedWo = await this.update(id, updateData);

        // Sync to Ticket
        await syncWoStatusToTicket(id, status);

        // Notify Status Change - always notify (removed assignedToId check so admins see it)
        await notifyWorkOrderStatusChange({
            workOrderId: id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            type: workOrder.type,
            priority: workOrder.priority,
            departmentId: workOrder.departmentId || undefined,
            siteId: workOrder.siteId || undefined,
            assignedToId: workOrder.assignedToId || undefined,
            oldStatus: workOrder.status,
            newStatus: status,
            triggeredByUserId: userId
        }).catch(err => console.error('Failed to notify WO status change:', err));

        return updatedWo;
    }

    async start(id: string, userId?: string, timestamp?: Date): Promise<WorkOrders> {
        return this.updateStatus(id, 'IN_PROGRESS', userId, timestamp);
    }

    async complete(id: string, resolutionNotes?: string, userId?: string, timestamp?: Date): Promise<WorkOrders> {
        const updateData: any = { status: 'COMPLETED' };
        if (resolutionNotes) {
            updateData.resolutionNotes = resolutionNotes;
        }

        await this.updateStatus(id, 'COMPLETED', userId, timestamp);
        return this.update(id, updateData);
    }

    async verify(id: string, userId?: string): Promise<WorkOrders> {
        return this.updateStatus(id, 'VERIFIED', userId);
    }

    async close(id: string, userId?: string): Promise<WorkOrders> {
        return this.updateStatus(id, 'CLOSED', userId);
    }

    async cancel(id: string, reason: string, userId?: string): Promise<WorkOrders> {
        await this.addUpdate({
            workOrderId: id,
            updateType: 'NOTE',
            message: `Work order cancelled. Reason: ${reason}`,
            createdById: userId,
        });

        return this.updateStatus(id, 'CANCELLED', userId);
    }

    async assign(id: string, employeeId: string, role?: string, triggeredByUserId?: string): Promise<WorkOrders> {
        await this.prisma.workOrders.update({
            where: { id },
            data: {
                assignedToId: employeeId,
                status: 'ASSIGNED',
            },
        });

        await this.addAssignment(id, employeeId, role || 'Lead');
        
        const wo = await this.findById(id) as WorkOrders; // Need full object for notify
        
        console.log(`[RepoDebug] Assigning WO ${id} to ${employeeId} by ${triggeredByUserId}`);
        
        // Notify Assignment
        await notifyWorkOrderAssigned({
            workOrderId: id,
            workOrderNumber: wo.workOrderNumber,
            title: wo.title,
            type: wo.type,
            priority: wo.priority,
            departmentId: wo.departmentId || undefined,
            siteId: wo.siteId || undefined,
            assignedToId: employeeId,
            triggeredByUserId
        })
        .then(() => console.log(`[RepoDebug] Notification sent for assignment of ${wo.workOrderNumber}`))
        .catch(err => console.error('[RepoDebug] Failed to notify WO assignment:', err));

        return wo;
    }

    async unassign(id: string): Promise<WorkOrders> {
        return this.prisma.workOrders.update({
            where: { id },
            data: {
                assignedToId: null,
                status: 'PENDING',
            },
        });
    }

    async addAssignment(workOrderId: string, userId: string, role?: string): Promise<WorkOrderAssignments> {
        return this.prisma.workOrderAssignments.create({
            data: {
                id: randomUUID(),
                workOrderId,
                userId,
                role,
            },
        });
    }

    async removeAssignment(assignmentId: string): Promise<void> {
        await this.prisma.workOrderAssignments.delete({
            where: { id: assignmentId },
        });
    }

    async addTask(data: CreateTaskData): Promise<WorkOrderTasks> {
        return this.prisma.workOrderTasks.create({
            data: {
                id: randomUUID(),
                ...data,
                status: 'PENDING',
                updatedAt: new Date(),
            },
        });
    }

    async updateTask(taskId: string, data: UpdateTaskData): Promise<WorkOrderTasks> {
        const updateData: any = { ...data };

        if (data.status === 'COMPLETED' && data.completedById) {
            updateData.completedAt = new Date();
        }

        return this.prisma.workOrderTasks.update({
            where: { id: taskId },
            data: updateData,
        });
    }

    async deleteTask(taskId: string): Promise<void> {
        await this.prisma.workOrderTasks.delete({
            where: { id: taskId },
        });
    }

    async completeTask(taskId: string, userId: string): Promise<WorkOrderTasks> {
        return this.updateTask(taskId, {
            status: 'COMPLETED',
            completedById: userId,
        });
    }

    async addUpdate(data: AddUpdateData): Promise<WorkOrderUpdates> {
        const update = await this.prisma.workOrderUpdates.create({
            data: {
                id: randomUUID(),
                ...data,
                createdById: data.createdById,
            },
        });

        // Notify Update/Comment
        // We need WO details for the notification.
        const workOrder = await this.prisma.workOrders.findUnique({
             where: { id: data.workOrderId },
             select: { workOrderNumber: true, title: true, type: true, priority: true, assignedToId: true, departmentId: true, siteId: true }
        });

        if (workOrder) {
            // Notify everyone, will be filtered by NotificationService
             await notifyWorkOrderUpdate({
                workOrderId: data.workOrderId,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: workOrder.type,
                priority: workOrder.priority,
                departmentId: workOrder.departmentId || undefined,
                siteId: workOrder.siteId || undefined,
                assignedToId: workOrder.assignedToId || undefined,
                updateMessage: data.message,
                triggeredByUserId: data.createdById
            }).catch(err => console.error('Failed to notify WO update:', err));
        }

        // Fetch creator for socket payload
        let createdByUser = null;
        if (data.createdById) {
            createdByUser = await this.prisma.user.findUnique({
                where: { id: data.createdById },
                select: { id: true, name: true }
            });
        }

        // Socket Emit for Realtime Updates
        // Map updateType to valid activity type
        let activityType: 'comment' | 'update' | 'attachment' = 'update';
        if (data.updateType === 'COMMENT') activityType = 'comment';
        if (data.updateType === 'PHOTO') activityType = 'attachment';

        socketEmitter.workOrderActivity(data.workOrderId, {
            id: update.id,
            type: activityType,
            message: data.message,
            updateType: data.updateType,
            createdAt: update.createdAt.toISOString(),
            createdBy: createdByUser ? {
                id: createdByUser.id,
                name: createdByUser.name || undefined
            } : null
        });

        return update;
    }

    async getUpdates(workOrderId: string): Promise<WorkOrderUpdates[]> {
        return this.prisma.workOrderUpdates.findMany({
            where: { workOrderId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async addAttachment(
        workOrderId: string,
        fileName: string,
        filePath: string,
        fileSize: number,
        fileType: string,
        caption?: string,
        uploadedById?: string
    ): Promise<WorkOrderAttachments> {
        const attachment = await this.prisma.workOrderAttachments.create({
            data: {
                id: randomUUID(),
                workOrderId,
                fileName,
                filePath,
                fileSize,
                fileType,
                caption,
                uploadedById,
            },
        });

        // Log photo upload
        await this.addUpdate({
            workOrderId,
            updateType: 'PHOTO',
            message: caption || `Photo uploaded: ${fileName}`,
            createdById: uploadedById,
        });

        return attachment;
    }

    async deleteAttachment(attachmentId: string): Promise<void> {
        await this.prisma.workOrderAttachments.delete({
            where: { id: attachmentId },
        });
    }

    async getStatistics(filters?: Omit<WorkOrderFilters, 'search'>): Promise<WorkOrderStatistics> {
        const where: any = {};
        
        if (filters?.siteId) where.siteId = filters.siteId;
        if (filters?.departmentId) where.departmentId = filters.departmentId;
        if (filters?.assignedToId !== undefined) where.assignedToId = filters.assignedToId;
        if (filters?.pelangganId) where.pelangganId = filters.pelangganId;
        if (filters?.dateFrom || filters?.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
            if (filters.dateTo) where.createdAt.lte = filters.dateTo;
        }

        const [total, statusCounts, completedOrders, ratingData, urgentOpen] = await Promise.all([
            this.prisma.workOrders.count({ where }),
            this.prisma.workOrders.groupBy({
                by: ['status'],
                where,
                _count: true,
            }),
            this.prisma.workOrders.findMany({
                where: {
                    ...where,
                    completedAt: { not: null },
                    startedAt: { not: null },
                },
                select: {
                    startedAt: true,
                    completedAt: true,
                    actualCost: true,
                },
            }),
            this.prisma.workOrders.aggregate({
                where: {
                    ...where,
                    rating: { not: null },
                },
                _avg: {
                    rating: true,
                },
                _count: {
                    rating: true,
                },
            }),
            this.prisma.workOrders.count({
                where: {
                    ...where,
                    priority: { in: ['HIGH', 'URGENT', 'CRITICAL'] },
                    status: { notIn: ['COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED'] },
                },
            }),
        ]);

        const statusMap = statusCounts.reduce((acc, item) => {
            acc[item.status] = item._count;
            return acc;
        }, {} as Record<string, number>);

        let totalCompletionHours = 0;
        let totalCost = 0;

        completedOrders.forEach((wo) => {
            if (wo.startedAt && wo.completedAt) {
                const hours = (new Date(wo.completedAt).getTime() - new Date(wo.startedAt).getTime()) / (1000 * 60 * 60);
                totalCompletionHours += hours;
            }
            if (wo.actualCost) {
                totalCost += Number(wo.actualCost);
            }
        });

        return {
            total,
            pending: statusMap['PENDING'] || 0,
            assigned: statusMap['ASSIGNED'] || 0,
            inProgress: statusMap['IN_PROGRESS'] || 0,
            onHold: statusMap['ON_HOLD'] || 0,
            completed: statusMap['COMPLETED'] || 0,
            verified: statusMap['VERIFIED'] || 0,
            closed: statusMap['CLOSED'] || 0,
            cancelled: statusMap['CANCELLED'] || 0,
            urgentOpen,
            avgCompletionTimeHours: completedOrders.length > 0 ? totalCompletionHours / completedOrders.length : 0,
            totalCost,
            avgRating: ratingData._avg.rating || null,
            totalWithRating: ratingData._count.rating || 0,
        };
    }

    /**
     * Get top performers based on completed tasks and average completion time
     */
    async getTopPerformers(limit: number = 5, dateFrom?: Date, dateTo?: Date, departmentId?: string): Promise<TopPerformer[]> {
        const where: any = {
            status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
            assignedToId: { not: null },
            completedAt: { not: null },
            startedAt: { not: null },
        };

        if (departmentId) {
            where.departmentId = departmentId;
        }

        if (dateFrom || dateTo) {
            where.completedAt = {};
            if (dateFrom) where.completedAt.gte = dateFrom;
            if (dateTo) where.completedAt.lte = dateTo;
        }

        const completedWorkOrders = await this.prisma.workOrders.findMany({
            where,
            select: {
                startedAt: true,
                completedAt: true,
                assignedTo: {
                    select: {
                        name: true,
                        role: {
                            select: {
                                name: true
                            }
                        },
                        sites: {
                            select: {
                                name: true
                            }
                        }
                    },
                },
            },
        });

        const userStats: Record<string, { count: number; totalHours: number; role?: string; site?: string }> = {};

        completedWorkOrders.forEach((wo) => {
            if (wo.assignedTo && wo.startedAt && wo.completedAt) {
                const name = wo.assignedTo.name || 'Unknown';
                const role = wo.assignedTo.role?.name;
                const site = wo.assignedTo.sites?.name;
                const hours = (new Date(wo.completedAt).getTime() - new Date(wo.startedAt).getTime()) / (1000 * 60 * 60);

                if (!userStats[name]) {
                    userStats[name] = { count: 0, totalHours: 0, role, site };
                }

                userStats[name].count += 1;
                userStats[name].totalHours += hours;
            }
        });

        const topPerformers = Object.entries(userStats).map(([name, stats]) => ({
            userName: name,
            role: stats.role,
            site: stats.site,
            count: stats.count,
            avgCompletionTime: stats.totalHours / stats.count,
        }));

        // Sort by count (desc) then by avgCompletionTime (asc)
        return topPerformers.sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.avgCompletionTime - b.avgCompletionTime;
        }).slice(0, limit);
    }

    /**
     * Get top assists - employees who assist as partners the most
     */
    async getTopAssists(limit: number = 5, dateFrom?: Date, dateTo?: Date, departmentId?: string): Promise<TopPerformer[]> {
        const workOrderWhere: any = {
            status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
        };
        if (departmentId) {
            workOrderWhere.departmentId = departmentId;
        }

        if (dateFrom || dateTo) {
            workOrderWhere.completedAt = {};
            if (dateFrom) workOrderWhere.completedAt.gte = dateFrom;
            if (dateTo) workOrderWhere.completedAt.lte = dateTo;
        }

        // Find all partner assignments on completed work orders
        const partnerAssignments = await this.prisma.workOrderAssignments.findMany({
            where: {
                role: 'PARTNER',
                status: 'APPROVED',
                workOrders: workOrderWhere
            },
            include: {
                user: {
                    select: {
                        name: true,
                        role: { select: { name: true } },
                        sites: { select: { name: true } }
                    }
                },
                workOrders: {
                    select: {
                        startedAt: true,
                        completedAt: true
                    }
                }
            }
        });

        const userStats: Record<string, { count: number; totalHours: number; role?: string; site?: string }> = {};

        partnerAssignments.forEach((assignment) => {
            const name = assignment.user?.name || 'Unknown';
            const role = assignment.user?.role?.name;
            const site = assignment.user?.sites?.name;
            const wo = assignment.workOrders;

            if (wo.startedAt && wo.completedAt) {
                const hours = (new Date(wo.completedAt).getTime() - new Date(wo.startedAt).getTime()) / (1000 * 60 * 60);

                if (!userStats[name]) {
                    userStats[name] = { count: 0, totalHours: 0, role, site };
                }

                userStats[name].count += 1;
                userStats[name].totalHours += hours;
            }
        });

        const topAssists = Object.entries(userStats).map(([name, stats]) => ({
            userName: name,
            role: stats.role,
            site: stats.site,
            count: stats.count,
            avgCompletionTime: stats.count > 0 ? stats.totalHours / stats.count : 0,
        }));

        // Sort by count (desc)
        return topAssists.sort((a, b) => b.count - a.count).slice(0, limit);
    }

    /**
     * Get user work order statistics (count of completed orders)
     */
    async getUserWorkOrderStats(dateFrom: Date, dateTo: Date): Promise<Array<{ userId: string; count: number }>> {
        const where: any = {
            status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
            assignedToId: { not: null },
            completedAt: {
                gte: dateFrom,
                lte: dateTo,
            },
        };

        const stats = await this.prisma.workOrders.groupBy({
            by: ['assignedToId'],
            where,
            _count: {
                _all: true,
            },
        });

        return stats
            .filter((s) => s.assignedToId !== null)
            .map((s) => ({
                userId: s.assignedToId as string,
                count: s._count._all,
            }));
    }

    /**
     * Get site statistics by work order type
     */
    async getSiteStatsByType(types: WorkOrderType[], limit: number, dateFrom: Date, dateTo: Date): Promise<Array<{ siteId: string; siteName: string; count: number }>> {
        const where: any = {
            type: { in: types },
            status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
            siteId: { not: null },
            createdAt: {
                gte: dateFrom,
                lte: dateTo,
            },
        };

        const stats = await this.prisma.workOrders.groupBy({
            by: ['siteId'],
            where,
            _count: {
                _all: true,
            },
            orderBy: {
                _count: {
                    siteId: 'desc', // Note: Prisma aggregation sorting might be limited, handling sort in JS typically safer for complex objects
                },
            },
        });

        // Prisma groupBy doesn't allow automatic relation fetch unlike findMany
        // We need to fetch site names manually or assume stats are small enough
        const siteIds = stats.map(s => s.siteId).filter(id => id !== null) as string[];

        const sites = await this.prisma.sites.findMany({
            where: { id: { in: siteIds } },
            select: { id: true, name: true }
        });

        const result = stats
            .map(s => {
                const site = sites.find(site => site.id === s.siteId);
                return {
                    siteId: s.siteId as string,
                    siteName: site?.name || 'Unknown',
                    count: s._count._all
                };
            })
            .filter(item => item.siteId !== null)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);

        return result;
    }

    /**
     * Get recent work orders for dashboard
     */
    async getRecentWorkOrders(limit: number = 5, filters?: WorkOrderFilters): Promise<WorkOrderWithRelations[]> {
        const where: any = {};

        if (filters?.departmentId) where.departmentId = filters.departmentId;
        if (filters?.assignedToId !== undefined) where.assignedToId = filters.assignedToId;
        if (filters?.status) {
            where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
        }

        return this.prisma.workOrders.findMany({
            where,
            include: {
                pelanggan: {
                    select: {
                        id: true,
                        idPelanggan: true,
                        nama: true,
                    },
                },
                site: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                tasks: true,
                assignments: true,
                updates: true,
                attachments: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: limit,
        }) as Promise<WorkOrderWithRelations[]>;
    }

    /**
     * Get department workload statistics
     */
    async getDepartmentWorkload(departmentId?: string): Promise<Array<{
        departmentId: string | null;
        departmentName: string;
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
    }>> {
        const where: any = {};
        if (departmentId) {
            where.id = departmentId;
        }

        const departments = await this.prisma.departments.findMany({
            where,
            select: {
                id: true,
                name: true,
            },
        });

        const workload = await Promise.all(
            departments.map(async (dept) => {
                const [total, pending, inProgress, completed] = await Promise.all([
                    this.prisma.workOrders.count({
                        where: { departmentId: dept.id },
                    }),
                    this.prisma.workOrders.count({
                        where: { departmentId: dept.id, status: 'PENDING' },
                    }),
                    this.prisma.workOrders.count({
                        where: {
                            departmentId: dept.id,
                            status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
                        },
                    }),
                    this.prisma.workOrders.count({
                        where: {
                            departmentId: dept.id,
                            status: { in: ['COMPLETED', 'VERIFIED'] },
                        },
                    }),
                ]);

                return {
                    departmentId: dept.id,
                    departmentName: dept.name,
                    total,
                    pending,
                    inProgress,
                    completed,
                };
            })
        );

        // Filter out departments with no work orders
        return workload.filter((dept) => dept.total > 0);
    }

    /**
     * Get work orders for employee's department
     */
    async getEmployeeDepartmentWorkOrders(
        departmentId: string,
        employeeId: string,
        filters?: WorkOrderFilters,
        page: number = 1,
        limit: number = 20
    ): Promise<{
        workOrders: WorkOrderWithRelations[];
        total: number;
        page: number;
        totalPages: number;
        stats: {
            assigned: number;
            inProgress: number;
            completed: number;
        };
    }> {
        const where: any = {
            OR: [
                { departmentId },
                { assignedToId: employeeId },
                {
                    assignments: {
                        some: {
                            employeeId,
                        },
                    },
                },
            ],
        };

        if (filters?.status) {
            where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
        }

        if (filters?.search) {
            where.AND = [
                {
                    OR: [
                        { workOrderNumber: { contains: filters.search, mode: 'insensitive' } },
                        { title: { contains: filters.search, mode: 'insensitive' } },
                        { description: { contains: filters.search, mode: 'insensitive' } },
                    ],
                },
            ];
        }

        const [workOrders, total, assigned, inProgress, completed] = await Promise.all([
            this.prisma.workOrders.findMany({
                where,
                include: {
                    pelanggan: {
                        select: {
                            id: true,
                            idPelanggan: true,
                            nama: true,
                            noTelp: true,
                        },
                    },
                    department: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    tasks: true,
                    assignments: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    updates: true,
                    attachments: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.workOrders.count({ where }),
            this.prisma.workOrders.count({
                where: {
                    ...where,
                    status: 'ASSIGNED',
                },
            }),
            this.prisma.workOrders.count({
                where: {
                    ...where,
                    status: 'IN_PROGRESS',
                },
            }),
            this.prisma.workOrders.count({
                where: {
                    ...where,
                    status: { in: ['COMPLETED', 'VERIFIED'] },
                },
            }),
        ]);

        return {
            workOrders: workOrders as WorkOrderWithRelations[],
            total,
            page,
            totalPages: Math.ceil(total / limit),
            stats: {
                assigned,
                inProgress,
                completed,
            },
        };
    }
    /**
     * Helper to classify work order based on title
     */
    private classifyIssue(title: string): string {
        const lowerTitle = title.toLowerCase();

        if (lowerTitle.includes('mati') || lowerTitle.includes('focut') || lowerTitle.includes('los') || lowerTitle.includes('merah')) {
            return 'Internet Mati / FOCUT';
        }
        if (lowerTitle.includes('lambat') || lowerTitle.includes('lemot') || lowerTitle.includes('slow') || lowerTitle.includes('lag')) {
            return 'Koneksi Lambat';
        }
        if (lowerTitle.includes('tarik') || lowerTitle.includes('ambil') || lowerTitle.includes('dismantle') || lowerTitle.includes('cabut')) {
            return 'Penarikan Perangkat';
        }
        if (lowerTitle.includes('pasang baru') || lowerTitle.includes('psb') || lowerTitle.includes('install')) {
            return 'Pasang Baru';
        }
        if (lowerTitle.includes('relokasi') || lowerTitle.includes('pindah') || lowerTitle.includes('geser')) {
            return 'Relokasi Perangkat';
        }

        return 'Other';
    }

    /**
     * Get statistics on most common issues (based on Title keywords)
     */
    async getIssueStatistics(limit: number = 5, dateFrom?: Date, dateTo?: Date, departmentId?: string, siteId?: string): Promise<Array<{ issue: string; count: number }>> {
        const where: any = {};
        if (siteId) {
            where.siteId = siteId;
        }
        if (departmentId) {
            where.departmentId = departmentId;
        }
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = dateFrom;
            if (dateTo) where.createdAt.lte = dateTo;
        }

        // Fetch all work orders for the period
        const workOrders = await this.prisma.workOrders.findMany({
            where,
            select: { title: true }
        });

        // Categorize and count
        const counts: Record<string, number> = {
            'Internet Mati / FOCUT': 0,
            'Koneksi Lambat': 0,
            'Penarikan Perangkat': 0,
            'Pasang Baru': 0,
            'Relokasi Perangkat': 0,
            'Other': 0
        };

        workOrders.forEach(wo => {
            const category = this.classifyIssue(wo.title);
            counts[category]++;
        });

        // Convert to array and sort
        return Object.entries(counts)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([issue, count]) => ({ issue, count }));
    }

    /**
     * Get statistics on sites with most work orders and their most common issue
     */
    async getSiteStatistics(limit: number = 5, dateFrom?: Date, dateTo?: Date, departmentId?: string, siteId?: string): Promise<Array<{ siteName: string; count: number; mostCommonIssue: string }>> {
        const where: any = {};
        if (siteId) {
            where.siteId = siteId;
        }
        if (departmentId) {
            where.departmentId = departmentId;
        }

        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = dateFrom;
            if (dateTo) where.createdAt.lte = dateTo;
        }

        // 1. Find top sites (Group by pelangganId)
        const topSites = await this.prisma.workOrders.groupBy({
            by: ['pelangganId'],
            where: {
                ...where,
                pelangganId: { not: null },
            },
            _count: {
                pelangganId: true,
            },
            orderBy: {
                _count: {
                    pelangganId: 'desc',
                },
            },
            take: limit,
        });

        const results = await Promise.all(topSites.map(async (site) => {
            if (!site.pelangganId) return null;

            const pelanggan = await this.prisma.pelanggan.findUnique({
                where: { id: site.pelangganId },
                select: { nama: true },
            });

            // 2. Fetch all work orders for this site within the period
            const siteWorkOrders = await this.prisma.workOrders.findMany({
                where: {
                    ...where,
                    pelangganId: site.pelangganId,
                },
                select: { title: true }
            });

            // 3. Find most common issue for this site
            const issueCounts: Record<string, number> = {};
            siteWorkOrders.forEach(wo => {
                const category = this.classifyIssue(wo.title);
                issueCounts[category] = (issueCounts[category] || 0) + 1;
            });

            const mostCommonIssue = Object.entries(issueCounts)
                .sort((a, b) => b[1] - a[1])[0];

            return {
                siteName: pelanggan?.nama || 'Unknown Site',
                count: site._count.pelangganId,
                mostCommonIssue: mostCommonIssue ? mostCommonIssue[0] : 'N/A',
            };
        }));

        return results.filter((r): r is { siteName: string; count: number; mostCommonIssue: string } => r !== null);
    }

    /**
     * Get statistics on disconnection reasons
     */
    async getDisconnectionStatistics(dateFrom?: Date, dateTo?: Date, departmentId?: string, siteId?: string): Promise<Array<{ reason: string; count: number }>> {
        const where: any = {
            type: 'DISCONNECTION',
            // Include all completed states, not just COMPLETED
            status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
        };
        
        if (siteId) where.siteId = siteId;
        if (departmentId) where.departmentId = departmentId;

        // Use createdAt for date filtering (more reliable than completedAt which might be null)
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = dateFrom;
            if (dateTo) where.createdAt.lte = dateTo;
        }

        const groupBy = await this.prisma.workOrders.groupBy({
            by: ['disconnectionReason'],
            where: {
                ...where,
                disconnectionReason: { not: null },
            },
            _count: {
                _all: true,
            },
        });

        return groupBy
            .map((item) => ({
                reason: item.disconnectionReason!,
                count: item._count._all,
            }))
            .sort((a, b) => b.count - a.count); // Sort by count descending
    }

    async addComment(workOrderId: string, message: string, userId: string): Promise<any> {
        return this.prisma.workOrderUpdates.create({
            data: {
                id: randomUUID(),
                workOrderId,
                updateType: 'COMMENT',
                message,
                createdById: userId,
            },
        });
    }

    /**
     * Get admin response statistics with detailed KPI per user
     * Calculates: response time, verification metrics, ON_HOLD response metrics per user
     */
    async getAdminResponseStats(dateFrom: Date, dateTo: Date, departmentId?: string): Promise<Array<{
        userId: string;
        userName: string;
        role: string;
        totalScore: number;
        totalResponses: number;
        avgResponseTimeMinutes: number;
        verifiedCount: number;
        avgVerifyTimeMinutes: number;
        completedCount: number;
        canvasingCount: number;
        avgCanvasingTimeMinutes: number;
    }>> {
        const where: any = {
            createdAt: { gte: dateFrom, lte: dateTo },
            createdById: { not: null }
        };

        // 1. Get all updates in range with user info
        const updates = await this.prisma.workOrderUpdates.findMany({
            where,
            include: {
                workOrders: {
                    select: { 
                        id: true, 
                        createdAt: true, 
                        completedAt: true,
                        verifiedAt: true,
                        departmentId: true,
                        status: true
                    }
                },
                user: {
                    select: { 
                        id: true, 
                        name: true,
                        role: {
                            select: {
                                name: true,
                                isTechnical: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Stats structure per user
        interface UserKPIStats {
            name: string;
            role: string;
            // Response time
            totalResponseTime: number;
            responseCount: number;
            // Verification
            verifiedCount: number;
            totalVerifyTime: number;
            // Completed as lead
            completedCount: number;
            // Canvasing Approval
            canvasingCount?: number;
            totalCanvasingTime?: number;
            isTechnical?: boolean;
        }

        const userStats: Record<string, UserKPIStats> = {};
        const processedResponsePairs = new Set<string>();
        const processedVerifyPairs = new Set<string>();
        const processedOnHoldPairs = new Set<string>();

        // Track ON_HOLD events for matching
        const onHoldEvents: Record<string, { createdAt: Date }> = {};

        updates.forEach(update => {
            if (!update.user || !update.createdById) return;
            if (departmentId && update.workOrders.departmentId !== departmentId) return;

            const userId = update.createdById;

            // Initialize user stats
            if (!userStats[userId]) {
                userStats[userId] = {
                    name: update.user.name || 'Unknown',
                    role: update.user.role?.name || 'N/A',
                    isTechnical: update.user.role?.isTechnical || false,
                    totalResponseTime: 0,
                    responseCount: 0,
                    verifiedCount: 0,
                    totalVerifyTime: 0,
                    completedCount: 0
                };
            }

            // Track ON_HOLD events
            if (update.newStatus === 'ON_HOLD') {
                onHoldEvents[update.workOrderId] = { createdAt: update.createdAt };
            }

            // 1. Response Time (first action per WO)
            const responseKey = `response-${update.workOrderId}-${userId}`;
            // Fix: Count ANY user response (Admin or Tech)
            if (!processedResponsePairs.has(responseKey)) {
                const responseTimeMinutes = (new Date(update.createdAt).getTime() - new Date(update.workOrders.createdAt).getTime()) / (1000 * 60);
                if (responseTimeMinutes >= 0) {
                    userStats[userId].totalResponseTime += responseTimeMinutes;
                    userStats[userId].responseCount += 1;
                    processedResponsePairs.add(responseKey);
                }
            }

            // 2. Verification - user melakukan verify
            if (update.newStatus === 'VERIFIED') {
                const verifyKey = `verify-${update.workOrderId}`;
                if (!processedVerifyPairs.has(verifyKey)) {
                    userStats[userId].verifiedCount += 1;
                    
                    // Calculate verify time
                    if (update.workOrders.completedAt) {
                        const verifyTime = (new Date(update.createdAt).getTime() - new Date(update.workOrders.completedAt).getTime()) / (1000 * 60);
                        if (verifyTime >= 0) {
                            userStats[userId].totalVerifyTime += verifyTime;
                        }
                    }
                    processedVerifyPairs.add(verifyKey);
                }
            }



            // 4. Completed Count - technician completed WO
            if (update.newStatus === 'COMPLETED' && update.user.role?.isTechnical) {
                userStats[userId].completedCount += 1;
            }
        });

        // 5. Canvasing Approval (Sales)
        // Only count APPROVED canvasing within range
        const canvasingApprovals = await this.prisma.canvasing.findMany({
            where: {
                approvedAt: { gte: dateFrom, lte: dateTo },
                approvedBy: { not: null }
            },
            select: {
                approvedBy: true,
                approvedAt: true,
                createdAt: true
            }
        });

        canvasingApprovals.forEach(canvas => {
            if (!canvas.approvedBy || !canvas.approvedAt) return;
            const userId = canvas.approvedBy;

            // Initialize user stats if not exists (might happen if user only did canvasing approval)
            if (!userStats[userId]) {
                // Warning: We might not have name/role if they didn't appear in WO updates
                // For MVP, we'll try to fetch it or default it. 
                // Since this is robust code, ideally we fetch user details if missing.
                // But for now, let's assume active admins appear in both or we accept 'Unknown' for pure Sales admins
                // To be safe, let's fetch user details if missing in a later step if needed, or just rely on existing structure.
                // For now, let's add them with default values, and maybe doing a separate user fetch for missing names is better if we want perfection.
                // However, most admins doing approvals are likely the same admins.
                userStats[userId] = {
                    name: 'Admin (Sales)', // Placeholder if unknown
                    role: 'N/A',
                    totalResponseTime: 0,
                    responseCount: 0,
                    verifiedCount: 0,
                    totalVerifyTime: 0,
                    completedCount: 0,
                    canvasingCount: 0,
                    totalCanvasingTime: 0
                };
            } else {
                // Ensure new fields exist for existing users
                if (userStats[userId].canvasingCount === undefined) {
                    userStats[userId].canvasingCount = 0;
                    userStats[userId].totalCanvasingTime = 0;
                }
            }

            const approveTime = (new Date(canvas.approvedAt).getTime() - new Date(canvas.createdAt).getTime()) / (1000 * 60);
            if (approveTime >= 0) {
                userStats[userId].canvasingCount = (userStats[userId].canvasingCount || 0) + 1;
                userStats[userId].totalCanvasingTime = (userStats[userId].totalCanvasingTime || 0) + approveTime;
            }
        });

        // If we have users with only Canvasing stats (name='Admin (Sales)'), we should try to fetch their real names
        const unknownUserIds = Object.keys(userStats).filter(uid => userStats[uid].name === 'Admin (Sales)');
        if (unknownUserIds.length > 0) {
            const users = await this.prisma.user.findMany({
                where: { id: { in: unknownUserIds } },
                select: { id: true, name: true, role: { select: { name: true } } }
            });
            users.forEach(u => {
                if (userStats[u.id]) {
                    userStats[u.id].name = u.name || 'Unknown';
                    userStats[u.id].role = u.role?.name || 'N/A';
                }
            });
        }

        return Object.entries(userStats)
            .map(([userId, stat]) => {
                // Scoring System (Weighted Points)
                // Completed (Tech) = 5 pts
                // Verified (Admin Final) = 3 pts
                // Canvasing Approval (Admin Task) = 2 pts
                // Regular Response (Quick Action) = 1 pt
                
                const score = 
                    (stat.completedCount * 5) +
                    (stat.verifiedCount * 3) +
                    ((stat.canvasingCount || 0) * 2) +
                    (stat.responseCount * 1);

                return {
                    userId,
                    userName: stat.name,
                    role: stat.role,
                    isTechnical: stat.isTechnical || false,
                    totalScore: score,
                    totalResponses: stat.responseCount,
                    avgResponseTimeMinutes: stat.responseCount > 0 ? Math.round(stat.totalResponseTime / stat.responseCount) : 0,
                    verifiedCount: stat.verifiedCount,
                    avgVerifyTimeMinutes: stat.verifiedCount > 0 ? Math.round(stat.totalVerifyTime / stat.verifiedCount) : 0,
                    completedCount: stat.completedCount,
                    canvasingCount: stat.canvasingCount || 0,
                    avgCanvasingTimeMinutes: (stat.canvasingCount || 0) > 0 ? Math.round((stat.totalCanvasingTime || 0) / (stat.canvasingCount || 0)) : 0
                };
            })
            .filter(stat => stat.totalScore > 0)
            .sort((a, b) => b.totalScore - a.totalScore); // Sort by Score instead of response time
    }

    /**
     * Get Admin KPI Statistics
     * Calculates metrics for admin performance in Work Order management
     */
    async getAdminKPIStats(departmentId?: string, siteId?: string): Promise<{
        pendingVerification: number;
        avgVerificationTimeMinutes: number;

        avgCanvasingTimeMinutes: number;
        canvasingApprovedToday: number;
        canvasingApprovedThisWeek: number;
    }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dateTo = new Date();
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 30);

        const where: any = {};
        if (departmentId) where.departmentId = departmentId;
        if (siteId) where.siteId = siteId;

        // 1. Pending Verification - WO yang status COMPLETED tapi belum di-verify
        const pendingVerification = await this.prisma.workOrders.count({
            where: {
                ...where,
                status: 'COMPLETED',
            }
        });

        // 2. Avg Verification Time - waktu dari COMPLETED ke VERIFIED
        const verifiedWOs = await this.prisma.workOrders.findMany({
            where: {
                ...where,
                status: { in: ['VERIFIED', 'CLOSED'] },
                completedAt: { not: null },
                verifiedAt: { not: null },
            },
            select: {
                completedAt: true,
                verifiedAt: true,
            }
        });

        let totalVerificationMinutes = 0;
        verifiedWOs.forEach(wo => {
            if (wo.completedAt && wo.verifiedAt) {
                const diff = new Date(wo.verifiedAt).getTime() - new Date(wo.completedAt).getTime();
                totalVerificationMinutes += diff / (1000 * 60);
            }
        });
        const avgVerificationTimeMinutes = verifiedWOs.length > 0 
            ? Math.round(totalVerificationMinutes / verifiedWOs.length) 
            : 0;

        // 3. Global Canvasing Stats (Sales)
        const approvedCanvasing = await this.prisma.canvasing.findMany({
            where: {
                approvedAt: { not: null },
                createdAt: { gte: dateFrom, lte: dateTo }
            },
            select: { createdAt: true, approvedAt: true }
        });

        let totalCanvasingMinutes = 0;
        approvedCanvasing.forEach(c => {
            if (c.approvedAt) {
                const diff = new Date(c.approvedAt).getTime() - new Date(c.createdAt).getTime();
                totalCanvasingMinutes += diff / (1000 * 60);
            }
        });
        
        const avgCanvasingTimeMinutes = approvedCanvasing.length > 0 
            ? Math.round(totalCanvasingMinutes / approvedCanvasing.length) 
            : 0;

        // Canvasing Approved Today
        const canvasingApprovedToday = await this.prisma.canvasing.count({
            where: {
                approvedAt: { gte: today }
            }
        });

        // 4. Canvasing Approved Today & This Week (Sales)
        const startOfWeek = new Date(today);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

        const [canvasingApprovedThisWeek] = await Promise.all([
            this.prisma.canvasing.count({
                where: {
                    approvedAt: { gte: startOfWeek }
                }
            })
        ]);

        return {
            pendingVerification,
            avgVerificationTimeMinutes,
            avgCanvasingTimeMinutes,
            canvasingApprovedToday,
            canvasingApprovedThisWeek
        };
    }
}
