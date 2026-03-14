import { Prisma } from '@prisma/client';
import type { WorkOrders, WorkOrderTasks, WorkOrderAssignments, WorkOrderUpdates, WorkOrderAttachments, WorkOrderStatus, WorkOrderType } from '@prisma/client';
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
import { validateStatusTransition } from '../utils/status-transitions';
import { randomUUID } from 'crypto';
import { socketEmitter } from '@/lib/websocket/emitter';
import { toStartOfDay, toEndOfDay } from '@/lib/utils/datetime'

import { prisma as defaultPrisma } from '@/lib/prisma'
import { getTenantIdFromContext } from '@/lib/tenant-context'
type PrismaInstance = typeof defaultPrisma

export class WorkOrderRepository implements IWorkOrderRepository {
    constructor(private prisma: PrismaInstance = defaultPrisma) { }

    async generateWorkOrderNumber(): Promise<string> {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

        const startOfDay = new Date(now);
        startOfDay.setTime(toStartOfDay(startOfDay).getTime());
        const endOfDay = new Date(now);
        endOfDay.setTime(toEndOfDay(endOfDay).getTime());

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
            const parts = (lastWo?.workOrderNumber ?? '').split('-');
            if (parts.length >= 3) {
                const lastSequence = parseInt(parts[2] || '0', 10);
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
                        createdById: data.createdById ?? null,
                        pelangganId: pelangganId || null,
                        siteId: restData.siteId || null,
                        departmentId: restData.departmentId || null,
                        assignedToId: restData.assignedToId || null,
                        contactName: restData.contactName ?? null,
                        contactPhone: restData.contactPhone ?? null,
                        locationAddress: restData.locationAddress ?? null,
                        scheduledDate: restData.scheduledDate ?? null,
                        scheduledTimeStart: restData.scheduledTimeStart ?? null,
                        scheduledTimeEnd: restData.scheduledTimeEnd ?? null,
                        estimatedHours: restData.estimatedHours ?? null,
                        estimatedCost: restData.estimatedCost ?? null,
                        requiredMaterials: restData.requiredMaterials as Prisma.InputJsonValue,
                        internalNotes: restData.internalNotes ?? null,
                        disconnectionReason: restData.disconnectionReason || null,
                        isInternal: restData.isInternal || false, // Internal FOC flag
                    },
                });

                // NOTE: Notification moved to Service layer to avoid duplication
                // and resolve "Cannot find name notifyNewWorkOrder" error

                return result;
            } catch (error: unknown) {
                // Check if this is a unique constraint violation on workOrderNumber
                const prismaError = error as { code?: string; meta?: { target?: string[] } };
                if (prismaError?.code === 'P2002' && prismaError?.meta?.target?.includes('workOrderNumber')) {
                    console.warn(`[WorkOrderRepo] Unique constraint violation on workOrderNumber, retry attempt ${attempt + 1}/${MAX_RETRIES}`);
                    if (error instanceof Error) {
                        lastError = error;
                    } else {
                        lastError = new Error(String(error));
                    }
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
                materials: {
                    include: {
                        barang: {
                            select: {
                                id: true,
                                kode: true,
                                nama: true,
                                satuan: true,
                            }
                        }
                    }
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
                                id: true,
                                name: true,
                                email: true,
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
        const where: Prisma.WorkOrdersWhereInput = {};

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
            // Also ensure no mitra is assigned if requesting truly unassigned tickets
            where.assignedMitraId = null;
        }

        if (filters?.involvedUserId) {
            // Filter for assignments that are NOT rejected (PENDING or APPROVED)
            const userFilter: Prisma.WorkOrdersWhereInput = {
                OR: [
                    { assignedToId: filters.involvedUserId },
                    { assignedMitraId: filters.involvedUserId },
                    {
                        assignments: {
                            some: {
                                userId: filters.involvedUserId,
                                status: { not: 'REJECTED' } // Exclude rejected assignments
                            }
                        }
                    },
                    {
                        assignments: {
                            some: {
                                mitraId: filters.involvedUserId,
                                status: { not: 'REJECTED' } // Exclude rejected assignments
                            }
                        }
                    }
                ]
            };

            if (where.OR) {
                // If there's already an OR (e.g. from search), we need to wrap everything in AND
                const currentAnd = Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : []);
                where.AND = [
                    ...currentAnd,
                    { OR: where.OR as Prisma.WorkOrdersWhereInput[] },
                    userFilter
                ];
                delete where.OR;
            } else {
                where.OR = userFilter.OR;
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
            const searchFilter: Prisma.WorkOrdersWhereInput = {
                OR: [
                    { workOrderNumber: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
                    { title: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
                    { description: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
                    { pelanggan: { nama: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } } },
                    { site: { name: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } } },
                    { assignedTo: { name: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } } },
                    { contactName: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
                ]
            };

            if (where.OR) {
                // involvedUserId already set an OR
                const currentAnd = Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : []);
                where.AND = [
                    ...currentAnd,
                    { OR: where.OR as Prisma.WorkOrdersWhereInput[] },
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
            const scheduledDateFilter: Prisma.DateTimeNullableFilter = {};
            if (filters.scheduledDateFrom) scheduledDateFilter.gte = filters.scheduledDateFrom;
            if (filters.scheduledDateTo) scheduledDateFilter.lte = filters.scheduledDateTo;
            where.scheduledDate = scheduledDateFilter;
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
                                    id: true,
                                    name: true,
                                    email: true,
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
        const where: Prisma.WorkOrdersWhereInput = {};

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
            where.assignedMitraId = null;
        }

        if (filters?.involvedUserId) {
            const userFilter: Prisma.WorkOrdersWhereInput = {
                OR: [
                    { assignedToId: filters.involvedUserId },
                    { assignedMitraId: filters.involvedUserId },
                    {
                        assignments: {
                            some: {
                                userId: filters.involvedUserId,
                                status: { not: 'REJECTED' }
                            }
                        }
                    },
                    {
                        assignments: {
                            some: {
                                mitraId: filters.involvedUserId,
                                status: { not: 'REJECTED' }
                            }
                        }
                    }
                ]
            };

            if (where.OR) {
                const currentAnd = Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : []);
                where.AND = [
                    ...currentAnd,
                    { OR: where.OR as Prisma.WorkOrdersWhereInput[] },
                    userFilter
                ];
                delete where.OR;
            } else {
                where.OR = userFilter.OR;
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

        // Filter by isInternal (Internal FOC vs Customer/Guest)
        if (filters?.isInternal === true) {
            where.isInternal = true;
        } else if (filters?.isInternal === false) {
            where.isInternal = false;
        }

        if (filters?.search) {
            const searchFilter: Prisma.WorkOrdersWhereInput = {
                OR: [
                    { workOrderNumber: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
                    { title: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
                    { description: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
                    { pelanggan: { nama: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } } },
                    { site: { name: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } } },
                    { assignedTo: { name: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } } },
                    { contactName: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
                ]
            };

            if (where.OR) {
                const currentAnd = Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : []);
                where.AND = [
                    ...currentAnd,
                    { OR: where.OR as Prisma.WorkOrdersWhereInput[] },
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
                    startedAt: true,
                    completedAt: true,
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
            } as Prisma.WorkOrdersUncheckedUpdateInput,
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

        // CRITICAL: Validate status transition
        validateStatusTransition(workOrder.status, status);

        const woUpdateData: Record<string, unknown> = { status };
        const eventTime = timestamp || new Date();

        if (status === 'IN_PROGRESS' && !workOrder.startedAt) {
            woUpdateData.startedAt = eventTime;
        } else if (status === 'COMPLETED') {
            woUpdateData.completedAt = eventTime;
            if (workOrder.startedAt) {
                const hours = (eventTime.getTime() - new Date(workOrder.startedAt).getTime()) / (1000 * 60 * 60);
                woUpdateData.actualHours = hours;
            }
        } else if (status === 'VERIFIED') {
            woUpdateData.verifiedAt = eventTime;
        } else if (status === 'CLOSED') {
            woUpdateData.closedAt = eventTime;
        }

        const statusUpdateData: AddUpdateData = {
            workOrderId: id,
            updateType: 'STATUS_CHANGE',
            message: `Status changed from ${workOrder.status} to ${status}`,
            oldStatus: workOrder.status as WorkOrderStatus,
            newStatus: status as WorkOrderStatus,
        };

        if (userId) {
            statusUpdateData.createdById = userId;
        }

        await this.addUpdate(statusUpdateData);

        const updatedWo = await this.update(id, woUpdateData);

        // Sync to Ticket
        await syncWoStatusToTicket(id, status);

        // NOTE: Notification moved to Service layer to avoid duplication
        // Repository should not send notifications directly

        return updatedWo;
    }

    async start(id: string, userId?: string, timestamp?: Date): Promise<WorkOrders> {
        return this.updateStatus(id, 'IN_PROGRESS', userId, timestamp);
    }

    async complete(id: string, resolutionNotes?: string, userId?: string, timestamp?: Date): Promise<WorkOrders> {
        const updateData: Record<string, unknown> = { status: 'COMPLETED' };
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
        const updateData: AddUpdateData = {
            workOrderId: id,
            updateType: 'NOTE',
            message: `Work order cancelled. Reason: ${reason}`,
        };

        if (userId) {
            updateData.createdById = userId;
        }

        await this.addUpdate(updateData);

        return this.updateStatus(id, 'CANCELLED', userId);
    }

    /**
     * Create a Work Order Request from Mobile App
     * Status will be REQUESTED (waiting for approval)
     */
    async createRequest(data: CreateWorkOrderData & { requestedById: string }): Promise<WorkOrders> {
        const MAX_RETRIES = 3;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const workOrderNumber = await this.generateWorkOrderNumber();

                const { pelangganId, requestedById, ...restData } = data;

                const result = await this.prisma.workOrders.create({
                    data: {
                        id: randomUUID(),
                        updatedAt: new Date(),
                        workOrderNumber,
                        type: restData.type,
                        title: restData.title,
                        description: restData.description,
                        status: 'REQUESTED', // Status menunggu approval
                        priority: data.priority || 'NORMAL',
                        createdById: requestedById, // Same as requester for mobile requests
                        requestedById: requestedById,
                        requestedAt: new Date(),
                        pelangganId: pelangganId || null,
                        siteId: restData.siteId || null,
                        departmentId: restData.departmentId || null,
                        assignedToId: null, // Not assigned yet
                        contactName: restData.contactName ?? null,
                        contactPhone: restData.contactPhone ?? null,
                        locationAddress: restData.locationAddress ?? null,
                        locationLat: restData.locationLat ?? null,
                        locationLng: restData.locationLng ?? null,
                        scheduledDate: restData.scheduledDate ?? null,
                        internalNotes: restData.internalNotes ?? null,
                        isInternal: restData.isInternal || false, // Internal FOC flag
                    },
                });

                // NOTE: We do NOT notify department users here
                // Only notify admins with approval permission (handled in route)

                return result;
            } catch (error: unknown) {
                const prismaError = error as { code?: string; meta?: { target?: string[] } };
                if (prismaError?.code === 'P2002' && prismaError?.meta?.target?.includes('workOrderNumber')) {
                    console.warn(`[WorkOrderRepo] Unique constraint violation on workOrderNumber, retry attempt ${attempt + 1}/${MAX_RETRIES}`);
                    lastError = error instanceof Error ? error : new Error(String(error));
                    await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, attempt)));
                    continue;
                }
                throw error;
            }
        }

        console.error('[WorkOrderRepo] Failed to create work order request after all retries');
        throw lastError || new Error('Failed to create work order request after max retries');
    }

    /**
     * Approve a Work Order Request
     * Changes status from REQUESTED to PENDING
     */
    async approveRequest(id: string, approvedById: string): Promise<WorkOrders> {
        const workOrder = await this.findById(id);
        if (!workOrder) {
            throw new Error('Work order not found');
        }

        if (workOrder.status !== 'REQUESTED') {
            throw new Error(`Cannot approve: Work order status is ${workOrder.status}, expected REQUESTED`);
        }

        const result = await this.prisma.workOrders.update({
            where: { id },
            data: {
                status: 'PENDING',
                approvedById: approvedById,
                approvedAt: new Date(),
                updatedAt: new Date(),
            },
        });

        await this.addUpdate({
            workOrderId: id,
            updateType: 'STATUS_CHANGE',
            message: 'WO Request disetujui oleh Admin',
            oldStatus: 'REQUESTED',
            newStatus: 'PENDING',
            createdById: approvedById,
        });

        // NOTE: Notification moved to Service layer

        return result;
    }

    /**
     * Reject a Work Order Request
     * Changes status from REQUESTED to CANCELLED with rejection reason
     */
    async rejectRequest(id: string, rejectedById: string, reason: string): Promise<WorkOrders> {
        const workOrder = await this.findById(id);
        if (!workOrder) {
            throw new Error('Work order not found');
        }

        if (workOrder.status !== 'REQUESTED') {
            throw new Error(`Cannot reject: Work order status is ${workOrder.status}, expected REQUESTED`);
        }

        const result = await this.prisma.workOrders.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                approvedById: rejectedById, // Admin who rejected
                approvedAt: new Date(),
                rejectionReason: reason,
                updatedAt: new Date(),
            },
        });

        await this.addUpdate({
            workOrderId: id,
            updateType: 'STATUS_CHANGE',
            message: `WO Request ditolak: ${reason}`,
            oldStatus: 'REQUESTED',
            newStatus: 'CANCELLED',
            createdById: rejectedById,
        });

        return result;
    }

    /**
     * Find all Work Order Requests (status = REQUESTED)
     */
    async findAllRequests(
        filters?: { departmentId?: string; siteId?: string; search?: string },
        page: number = 1,
        limit: number = 20
    ): Promise<{
        workOrders: WorkOrderWithRelations[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const where: Record<string, unknown> = {
            status: 'REQUESTED',
        };

        if (filters?.departmentId) {
            where.departmentId = filters.departmentId;
        }

        if (filters?.siteId) {
            where.siteId = filters.siteId;
        }

        if (filters?.search) {
            where.OR = [
                { workOrderNumber: { contains: filters.search, mode: 'insensitive' } },
                { title: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        const [workOrders, total] = await Promise.all([
            this.prisma.workOrders.findMany({
                where,
                include: {
                    site: { select: { id: true, name: true, code: true } },
                    department: { select: { id: true, name: true } },
                    requestedBy: { select: { id: true, name: true, email: true } },
                    createdBy: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.workOrders.count({ where }),
        ]);

        return {
            workOrders: workOrders as WorkOrderWithRelations[],
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async assign(id: string, employeeId: string, role?: string, _triggeredByUserId?: string): Promise<WorkOrders> {
        await this.prisma.workOrders.update({
            where: { id },
            data: {
                assignedToId: employeeId,
                status: 'ASSIGNED',
            },
        });

        await this.addAssignment(id, employeeId, role || 'Lead');

        const wo = await this.findById(id) as WorkOrders;

        // console.log(`[RepoDebug] Assigning WO ${id} to ${employeeId} by ${triggeredByUserId}`);

        // NOTE: Notification moved to Service layer

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
                role: role ?? null,
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
        const updateData: Record<string, unknown> = { ...data };

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
                workOrderId: data.workOrderId,
                updateType: data.updateType,
                message: data.message,
                oldStatus: data.oldStatus ?? null,
                newStatus: data.newStatus ?? null,
                createdById: data.createdById ?? null,
            },
        });

        // NOTE: Notification moved to Service layer

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
                ...(createdByUser.name && { name: createdByUser.name })
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
                caption: caption ?? null,
                uploadedById: uploadedById ?? null,
            },
        });

        // Log photo upload
        const updateData: AddUpdateData = {
            workOrderId,
            updateType: 'PHOTO',
            message: caption || `Photo uploaded: ${fileName}`,
        };

        if (uploadedById) {
            updateData.createdById = uploadedById;
        }

        await this.addUpdate(updateData);

        return attachment;
    }

    async deleteAttachment(attachmentId: string, deletedById?: string): Promise<void> {
        const attachment = await this.prisma.workOrderAttachments.findUnique({
            where: { id: attachmentId }
        });

        if (!attachment) return;

        await this.prisma.workOrderAttachments.delete({
            where: { id: attachmentId },
        });

        // Log deletion to timeline (triggers socket event -> triggers UI refresh)
        const updateData: AddUpdateData = {
            workOrderId: attachment.workOrderId,
            updateType: 'NOTE',
            message: `Menghapus lampiran: ${attachment.fileName}`,
        };

        if (deletedById) {
            updateData.createdById = deletedById;
        }

        await this.addUpdate(updateData);
    }

    async getStatistics(filters?: Omit<WorkOrderFilters, 'search'>): Promise<WorkOrderStatistics> {
        const where: Prisma.WorkOrdersWhereInput = {};

        if (filters?.siteId) where.siteId = filters.siteId;
        if (filters?.departmentId) where.departmentId = filters.departmentId;
        if (filters?.assignedToId !== undefined) where.assignedToId = filters.assignedToId;
        if (filters?.pelangganId) where.pelangganId = filters.pelangganId;
        if (filters?.dateFrom || filters?.dateTo) {
            const createdAtFilter: Prisma.DateTimeFilter = {};
            if (filters.dateFrom) createdAtFilter.gte = filters.dateFrom;
            if (filters.dateTo) createdAtFilter.lte = filters.dateTo;
            where.createdAt = createdAtFilter;
        }

        // Prepare conditions for raw query
        // MANUALLY handle tenant isolation for raw query
        const { tenantId, isSuperAdmin } = await getTenantIdFromContext()
        const effectiveTenantId = (!isSuperAdmin && !tenantId) ? '___MISSING_TENANT_ID___' : tenantId

        let query = Prisma.sql`
            SELECT
                AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) / 3600)::float as "avgHours",
                SUM("actualCost")::float as "totalCost"
            FROM "work_orders"
            WHERE "completedAt" IS NOT NULL
            AND "startedAt" IS NOT NULL
        `

        // Add tenant filter if not super admin
        if (!isSuperAdmin) {
            query = Prisma.sql`${query} AND "tenantId" = ${effectiveTenantId}`
        }

        if (filters?.siteId) query = Prisma.sql`${query} AND "siteId" = ${filters.siteId}`
        if (filters?.departmentId) query = Prisma.sql`${query} AND "departmentId" = ${filters.departmentId}`
        if (filters?.assignedToId) query = Prisma.sql`${query} AND "assignedToId" = ${filters.assignedToId}`
        if (filters?.pelangganId) query = Prisma.sql`${query} AND "pelangganId" = ${filters.pelangganId}`
        if (filters?.dateFrom) query = Prisma.sql`${query} AND "createdAt" >= ${filters.dateFrom}`
        if (filters?.dateTo) query = Prisma.sql`${query} AND "createdAt" <= ${filters.dateTo}`


        const [total, statusCounts, completionStats, ratingData, urgentOpen] = await Promise.all([
            this.prisma.workOrders.count({ where }),
            this.prisma.workOrders.groupBy({
                by: ['status'],
                where,
                _count: true,
            }),
            // Optimized aggregation for cost and duration
            this.prisma.$queryRaw<{ avgHours: number, totalCost: number }[]>(query),
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

        const stats = completionStats[0] || { avgHours: 0, totalCost: 0 };

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
            avgCompletionTimeHours: stats.avgHours || 0,
            totalCost: stats.totalCost || 0,
            avgRating: ratingData._avg.rating || null,
            totalWithRating: ratingData._count.rating || 0,
        };
    }

    /**
     * Get top performers based on completed tasks and average completion time
     */
    async getTopPerformers(limit: number = 5, dateFrom?: Date, dateTo?: Date, departmentId?: string): Promise<TopPerformer[]> {
        const where: Prisma.WorkOrdersWhereInput = {
            status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
            assignedToId: { not: null },
            completedAt: { not: null },
            startedAt: { not: null },
        };

        if (departmentId) {
            where.departmentId = departmentId;
        }

        if (dateFrom || dateTo) {
            const completedAtFilter: Prisma.DateTimeNullableFilter = {};
            if (dateFrom) completedAtFilter.gte = dateFrom;
            if (dateTo) completedAtFilter.lte = dateTo;
            where.completedAt = completedAtFilter;
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
                    userStats[name] = {
                        count: 0,
                        totalHours: 0,
                        ...(role && { role }),
                        ...(site && { site })
                    };
                }

                const currentUserStats = userStats[name];
                if (currentUserStats) {
                    currentUserStats.count += 1;
                    currentUserStats.totalHours += hours;
                }
            }
        });

        const topPerformers: TopPerformer[] = Object.entries(userStats).map(([name, stats]) => {
            const result: TopPerformer = {
                userName: name,
                count: stats.count,
                avgCompletionTime: stats.totalHours / stats.count,
            };
            if (stats.role) result.role = stats.role;
            if (stats.site) result.site = stats.site;
            return result;
        });

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
        const workOrderWhere: Prisma.WorkOrdersWhereInput = {
            status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
        };
        if (departmentId) {
            workOrderWhere.departmentId = departmentId;
        }

        if (dateFrom || dateTo) {
            const completedAtFilter: Prisma.DateTimeNullableFilter = {};
            if (dateFrom) completedAtFilter.gte = dateFrom;
            if (dateTo) completedAtFilter.lte = dateTo;
            workOrderWhere.completedAt = completedAtFilter;
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
                    userStats[name] = {
                        count: 0,
                        totalHours: 0,
                        ...(role && { role }),
                        ...(site && { site })
                    };
                }

                const currentUserStats = userStats[name];
                if (currentUserStats) {
                    currentUserStats.count += 1;
                    currentUserStats.totalHours += hours;
                }
            }
        });

        const topAssists: TopPerformer[] = Object.entries(userStats).map(([name, stats]) => {
            const result: TopPerformer = {
                userName: name,
                count: stats.count,
                avgCompletionTime: stats.count > 0 ? stats.totalHours / stats.count : 0,
            };
            if (stats.role) result.role = stats.role;
            if (stats.site) result.site = stats.site;
            return result;
        });

        // Sort by count (desc)
        return topAssists.sort((a, b) => b.count - a.count).slice(0, limit);
    }

    /**
     * Get user work order statistics (count of completed orders)
     */
    async getUserWorkOrderStats(dateFrom: Date, dateTo: Date): Promise<Array<{ userId: string; count: number }>> {
        const where: Record<string, unknown> = {
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
        const where: Record<string, unknown> = {
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
        const where: Record<string, unknown> = {};

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
        const where: Record<string, unknown> = {};
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
        const where: Record<string, unknown> = {
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
        const where: Prisma.WorkOrdersWhereInput = {};
        if (siteId) {
            where.siteId = siteId;
        }
        if (departmentId) {
            where.departmentId = departmentId;
        }
        if (dateFrom || dateTo) {
            const createdAtFilter: Prisma.DateTimeFilter = {};
            if (dateFrom) createdAtFilter.gte = dateFrom;
            if (dateTo) createdAtFilter.lte = dateTo;
            where.createdAt = createdAtFilter;
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
            if (category in counts) {
                const currentCount = counts[category];
                if (typeof currentCount === 'number') {
                    counts[category] = currentCount + 1;
                }
            }
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
        const where: Prisma.WorkOrdersWhereInput = {};
        if (siteId) {
            where.siteId = siteId;
        }
        if (departmentId) {
            where.departmentId = departmentId;
        }

        if (dateFrom || dateTo) {
            const createdAtFilter: Prisma.DateTimeFilter = {};
            if (dateFrom) createdAtFilter.gte = dateFrom;
            if (dateTo) createdAtFilter.lte = dateTo;
            where.createdAt = createdAtFilter;
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
        const where: Prisma.WorkOrdersWhereInput = {
            type: 'DISCONNECTION',
            // Include all completed states, not just COMPLETED
            status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
        };

        if (siteId) where.siteId = siteId;
        if (departmentId) where.departmentId = departmentId;

        // Use createdAt for date filtering (more reliable than completedAt which might be null)
        if (dateFrom || dateTo) {
            const createdAtFilter: Prisma.DateTimeFilter = {};
            if (dateFrom) createdAtFilter.gte = dateFrom;
            if (dateTo) createdAtFilter.lte = dateTo;
            where.createdAt = createdAtFilter;
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

    async addComment(workOrderId: string, message: string, userId: string): Promise<WorkOrderUpdates> {
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
        const where: Prisma.WorkOrderUpdatesWhereInput = {
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
        // const processedOnHoldPairs = new Set<string>(); // Removed unused variable

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
        const unknownUserIds = Object.keys(userStats).filter(uid => {
            const stat = userStats[uid];
            return stat && stat.name === 'Admin (Sales)';
        });
        if (unknownUserIds.length > 0) {
            const users = await this.prisma.user.findMany({
                where: { id: { in: unknownUserIds } },
                select: { id: true, name: true, role: { select: { name: true } } }
            });
            users.forEach(u => {
                const stat = userStats[u.id];
                if (stat) {
                    stat.name = u.name || 'Unknown';
                    stat.role = u.role?.name || 'N/A';
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
        today.setTime(toStartOfDay(today).getTime());

        const dateTo = new Date();
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 30);

        const where: Record<string, unknown> = {};
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

    // ==================== TREND ANALYTICS METHODS ====================

    /**
     * Get Volume Trend - WO Created vs Completed vs Requested per month
     * Used for dashboard trend chart
     */
    async getVolumeTrend(
        startDate: Date,
        endDate: Date,
        departmentId?: string,
        siteId?: string
    ): Promise<Array<{ month: string; created: number; completed: number; requested: number }>> {
        const where: Record<string, unknown> = {};
        if (departmentId) where.departmentId = departmentId;
        if (siteId) where.siteId = siteId;

        // Get all WOs in date range
        const [createdWOs, completedWOs, requestedWOs] = await Promise.all([
            this.prisma.workOrders.findMany({
                where: {
                    ...where,
                    createdAt: { gte: startDate, lte: endDate }
                },
                select: { createdAt: true }
            }),
            this.prisma.workOrders.findMany({
                where: {
                    ...where,
                    completedAt: { gte: startDate, lte: endDate },
                    status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] }
                },
                select: { completedAt: true }
            }),
            this.prisma.workOrders.findMany({
                where: {
                    ...where,
                    status: 'REQUESTED',
                    requestedAt: { gte: startDate, lte: endDate }
                },
                select: { requestedAt: true }
            })
        ]);

        // Build month map
        const months: { [key: string]: { created: number; completed: number; requested: number } } = {};
        const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
            (endDate.getMonth() - startDate.getMonth()) + 1;
        const numMonths = Math.max(1, Math.min(monthsDiff, 24));

        for (let i = 0; i < numMonths; i++) {
            const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months[key] = { created: 0, completed: 0, requested: 0 };
        }

        // Aggregate created
        createdWOs.forEach(wo => {
            const date = new Date(wo.createdAt);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (months[key]) months[key].created++;
        });

        // Aggregate completed
        completedWOs.forEach(wo => {
            if (wo.completedAt) {
                const date = new Date(wo.completedAt);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (months[key]) months[key].completed++;
            }
        });

        // Aggregate requested
        requestedWOs.forEach(wo => {
            if (wo.requestedAt) {
                const date = new Date(wo.requestedAt);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (months[key]) months[key].requested++;
            }
        });

        return Object.entries(months).map(([key, value]) => {
            const [year, month] = key.split('-');
            const date = new Date(parseInt(year || '0'), parseInt(month || '1') - 1, 1);
            return {
                month: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
                created: value.created,
                completed: value.completed,
                requested: value.requested
            };
        });
    }


    /**
     * Get Issue Trend - Distribution of issues per month
     * Uses classifyIssue helper to categorize WOs
     */
    async getIssueTrend(
        startDate: Date,
        endDate: Date,
        departmentId?: string,
        siteId?: string
    ): Promise<Array<{ month: string; issues: Array<{ issue: string; count: number }> }>> {
        const where: Record<string, unknown> = {};
        if (departmentId) where.departmentId = departmentId;
        if (siteId) where.siteId = siteId;

        const workOrders = await this.prisma.workOrders.findMany({
            where: {
                ...where,
                createdAt: { gte: startDate, lte: endDate }
            },
            select: { title: true, createdAt: true }
        });

        // Build month-issue map
        const monthIssues: { [key: string]: { [issue: string]: number } } = {};
        const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
            (endDate.getMonth() - startDate.getMonth()) + 1;
        const numMonths = Math.max(1, Math.min(monthsDiff, 24));

        for (let i = 0; i < numMonths; i++) {
            const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthIssues[key] = {};
        }

        // Categorize each WO
        workOrders.forEach(wo => {
            const date = new Date(wo.createdAt);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (monthIssues[key]) {
                const issue = this.classifyIssue(wo.title);
                monthIssues[key][issue] = (monthIssues[key][issue] || 0) + 1;
            }
        });

        return Object.entries(monthIssues).map(([key, issueMap]) => {
            const [year, month] = key.split('-');
            const date = new Date(parseInt(year || '0'), parseInt(month || '1') - 1, 1);
            return {
                month: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
                issues: Object.entries(issueMap)
                    .map(([issue, count]) => ({ issue, count }))
                    .sort((a, b) => b.count - a.count)
            };
        });
    }

    /**
     * Get Performance Trend - Avg completion time and rating per month
     */
    async getPerformanceTrend(
        startDate: Date,
        endDate: Date,
        departmentId?: string,
        siteId?: string
    ): Promise<Array<{ month: string; avgCompletionHours: number; avgRating: number | null; totalCompleted: number }>> {
        const where: Record<string, unknown> = {};
        if (departmentId) where.departmentId = departmentId;
        if (siteId) where.siteId = siteId;

        const completedWOs = await this.prisma.workOrders.findMany({
            where: {
                ...where,
                completedAt: { gte: startDate, lte: endDate },
                status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] }
            },
            select: {
                completedAt: true,
                startedAt: true,
                actualHours: true,
                rating: true
            }
        });

        // Build month map
        const monthStats: { [key: string]: { totalHours: number; totalRating: number; ratingCount: number; count: number } } = {};
        const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
            (endDate.getMonth() - startDate.getMonth()) + 1;
        const numMonths = Math.max(1, Math.min(monthsDiff, 24));

        for (let i = 0; i < numMonths; i++) {
            const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthStats[key] = { totalHours: 0, totalRating: 0, ratingCount: 0, count: 0 };
        }

        // Aggregate stats
        completedWOs.forEach(wo => {
            if (wo.completedAt) {
                const date = new Date(wo.completedAt);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (monthStats[key]) {
                    monthStats[key].count++;

                    // Calculate completion hours
                    if (wo.actualHours) {
                        monthStats[key].totalHours += Number(wo.actualHours);
                    } else if (wo.startedAt && wo.completedAt) {
                        const hours = (new Date(wo.completedAt).getTime() - new Date(wo.startedAt).getTime()) / (1000 * 60 * 60);
                        monthStats[key].totalHours += hours;
                    }

                    // Rating
                    if (wo.rating) {
                        monthStats[key].totalRating += Number(wo.rating);
                        monthStats[key].ratingCount++;
                    }
                }
            }
        });

        return Object.entries(monthStats).map(([key, stats]) => {
            const [year, month] = key.split('-');
            const date = new Date(parseInt(year || '0'), parseInt(month || '1') - 1, 1);
            return {
                month: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
                avgCompletionHours: stats.count > 0 ? Math.round((stats.totalHours / stats.count) * 10) / 10 : 0,
                avgRating: stats.ratingCount > 0 ? Math.round((stats.totalRating / stats.ratingCount) * 10) / 10 : null,
                totalCompleted: stats.count
            };
        });
    }

    /**
     * Get Type Trend - Distribution of WO types per month
     */
    async getTypeTrend(
        startDate: Date,
        endDate: Date,
        departmentId?: string,
        siteId?: string
    ): Promise<Array<{ month: string; types: Array<{ type: string; count: number }> }>> {
        const where: Record<string, unknown> = {};
        if (departmentId) where.departmentId = departmentId;
        if (siteId) where.siteId = siteId;

        const workOrders = await this.prisma.workOrders.findMany({
            where: {
                ...where,
                createdAt: { gte: startDate, lte: endDate }
            },
            select: { type: true, createdAt: true }
        });

        // Build month-type map
        const monthTypes: { [key: string]: { [type: string]: number } } = {};
        const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
            (endDate.getMonth() - startDate.getMonth()) + 1;
        const numMonths = Math.max(1, Math.min(monthsDiff, 24));

        for (let i = 0; i < numMonths; i++) {
            const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthTypes[key] = {};
        }

        // Aggregate types
        workOrders.forEach(wo => {
            const date = new Date(wo.createdAt);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (monthTypes[key]) {
                const type = wo.type || 'OTHER';
                monthTypes[key][type] = (monthTypes[key][type] || 0) + 1;
            }
        });

        // Type labels mapping
        const typeLabels: { [key: string]: string } = {
            INSTALLATION: 'Pemasangan',
            REPAIR: 'Perbaikan',
            MAINTENANCE: 'Maintenance',
            INSPECTION: 'Inspeksi',
            DISCONNECTION: 'Cabut Perangkat',
            RELOCATION: 'Relokasi',
            UPGRADE: 'Upgrade',
            OTHER: 'Lainnya'
        };

        return Object.entries(monthTypes).map(([key, typeMap]) => {
            const [year, month] = key.split('-');
            const date = new Date(parseInt(year || '0'), parseInt(month || '1') - 1, 1);
            return {
                month: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
                types: Object.entries(typeMap)
                    .map(([type, count]) => ({ type: typeLabels[type] || type, count }))
                    .sort((a, b) => b.count - a.count)
            };
        });
    }
}
