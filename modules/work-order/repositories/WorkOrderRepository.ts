import { PrismaClient } from '@prisma/client';
import type { WorkOrder, WorkOrderTask, WorkOrderAssignment, WorkOrderUpdate, WorkOrderAttachment, WorkOrderStatus, WorkOrderPriority, TaskStatus, WorkOrderType } from '@prisma/client';
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

export class WorkOrderRepository implements IWorkOrderRepository {
    constructor(private prisma: PrismaClient) { }

    async generateWorkOrderNumber(): Promise<string> {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const count = await this.prisma.workOrder.count({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
        });

        const sequence = (count + 1).toString().padStart(4, '0');
        return `WO-${dateStr}-${sequence}`;
    }

    async create(data: CreateWorkOrderData): Promise<WorkOrder> {
        const workOrderNumber = await this.generateWorkOrderNumber();

        // Destructure pelangganId to handle it separately
        const { pelangganId, ...restData } = data;

        return this.prisma.workOrder.create({
            data: {
                workOrderNumber,
                ...restData,
                // Only include pelangganId if it's truthy (not null/undefined)
                ...(pelangganId ? { pelangganId } : {}),
                status: 'PENDING',
                priority: data.priority || 'NORMAL',
                createdById: data.createdById,
            },
        });
    }

    async findById(id: string): Promise<WorkOrderWithRelations | null> {
        return this.prisma.workOrder.findUnique({
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
                        createdBy: {
                            select: {
                                name: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                attachments: {
                    include: {
                        uploadedBy: {
                            select: {
                                name: true,
                            },
                        },
                    },
                    orderBy: { uploadedAt: 'desc' },
                },
            },
        });
    }

    async findByWorkOrderNumber(workOrderNumber: string): Promise<WorkOrderWithRelations | null> {
        return this.prisma.workOrder.findUnique({
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
                        createdBy: {
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
            this.prisma.workOrder.findMany({
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
                            createdBy: {
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
            this.prisma.workOrder.count({ where }),
        ]);

        return {
            workOrders,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async update(id: string, data: UpdateWorkOrderData): Promise<WorkOrder> {
        return this.prisma.workOrder.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date(),
            },
        });
    }

    async delete(id: string): Promise<void> {
        await this.prisma.workOrder.delete({
            where: { id },
        });
    }

    async updateStatus(id: string, status: WorkOrderStatus, userId?: string): Promise<WorkOrder> {
        const workOrder = await this.findById(id);
        if (!workOrder) {
            throw new Error('Work order not found');
        }

        const updateData: any = { status };

        if (status === 'IN_PROGRESS' && !workOrder.startedAt) {
            updateData.startedAt = new Date();
        } else if (status === 'COMPLETED') {
            updateData.completedAt = new Date();
            if (workOrder.startedAt) {
                const hours = (new Date().getTime() - new Date(workOrder.startedAt).getTime()) / (1000 * 60 * 60);
                updateData.actualHours = hours;
            }
        } else if (status === 'VERIFIED') {
            updateData.verifiedAt = new Date();
        } else if (status === 'CLOSED') {
            updateData.closedAt = new Date();
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

        return updatedWo;
    }

    async start(id: string, userId?: string): Promise<WorkOrder> {
        return this.updateStatus(id, 'IN_PROGRESS', userId);
    }

    async complete(id: string, resolutionNotes?: string, userId?: string): Promise<WorkOrder> {
        const updateData: any = { status: 'COMPLETED' };
        if (resolutionNotes) {
            updateData.resolutionNotes = resolutionNotes;
        }

        await this.updateStatus(id, 'COMPLETED', userId);
        return this.update(id, updateData);
    }

    async verify(id: string, userId?: string): Promise<WorkOrder> {
        return this.updateStatus(id, 'VERIFIED', userId);
    }

    async close(id: string, userId?: string): Promise<WorkOrder> {
        return this.updateStatus(id, 'CLOSED', userId);
    }

    async cancel(id: string, reason: string, userId?: string): Promise<WorkOrder> {
        await this.addUpdate({
            workOrderId: id,
            updateType: 'NOTE',
            message: `Work order cancelled. Reason: ${reason}`,
            createdById: userId,
        });

        return this.updateStatus(id, 'CANCELLED', userId);
    }

    async assign(id: string, employeeId: string, role?: string): Promise<WorkOrder> {
        await this.prisma.workOrder.update({
            where: { id },
            data: {
                assignedToId: employeeId,
                status: 'ASSIGNED',
            },
        });

        await this.addAssignment(id, employeeId, role || 'Lead');
        return this.findById(id) as Promise<WorkOrder>;
    }

    async unassign(id: string): Promise<WorkOrder> {
        return this.prisma.workOrder.update({
            where: { id },
            data: {
                assignedToId: null,
                status: 'PENDING',
            },
        });
    }

    async addAssignment(workOrderId: string, userId: string, role?: string): Promise<WorkOrderAssignment> {
        return this.prisma.workOrderAssignment.create({
            data: {
                workOrderId,
                userId,
                role,
            },
        });
    }

    async removeAssignment(assignmentId: string): Promise<void> {
        await this.prisma.workOrderAssignment.delete({
            where: { id: assignmentId },
        });
    }

    async addTask(data: CreateTaskData): Promise<WorkOrderTask> {
        return this.prisma.workOrderTask.create({
            data: {
                ...data,
                status: 'PENDING',
            },
        });
    }

    async updateTask(taskId: string, data: UpdateTaskData): Promise<WorkOrderTask> {
        const updateData: any = { ...data };

        if (data.status === 'COMPLETED' && data.completedById) {
            updateData.completedAt = new Date();
        }

        return this.prisma.workOrderTask.update({
            where: { id: taskId },
            data: updateData,
        });
    }

    async deleteTask(taskId: string): Promise<void> {
        await this.prisma.workOrderTask.delete({
            where: { id: taskId },
        });
    }

    async completeTask(taskId: string, userId: string): Promise<WorkOrderTask> {
        return this.updateTask(taskId, {
            status: 'COMPLETED',
            completedById: userId,
        });
    }

    async addUpdate(data: AddUpdateData): Promise<WorkOrderUpdate> {
        return this.prisma.workOrderUpdate.create({
            data: {
                ...data,
                createdById: data.createdById,
            },
        });
    }

    async getUpdates(workOrderId: string): Promise<WorkOrderUpdate[]> {
        return this.prisma.workOrderUpdate.findMany({
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
    ): Promise<WorkOrderAttachment> {
        const attachment = await this.prisma.workOrderAttachment.create({
            data: {
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
            message: `Photo uploaded: ${fileName}`,
            createdById: uploadedById,
        });

        return attachment;
    }

    async deleteAttachment(attachmentId: string): Promise<void> {
        await this.prisma.workOrderAttachment.delete({
            where: { id: attachmentId },
        });
    }

    async getStatistics(filters?: Omit<WorkOrderFilters, 'search'>): Promise<WorkOrderStatistics> {
        const where: any = {};

        if (filters?.departmentId) where.departmentId = filters.departmentId;
        if (filters?.assignedToId !== undefined) where.assignedToId = filters.assignedToId;
        if (filters?.pelangganId) where.pelangganId = filters.pelangganId;
        if (filters?.dateFrom || filters?.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
            if (filters.dateTo) where.createdAt.lte = filters.dateTo;
        }

        const [total, statusCounts, completedOrders, ratingData, urgentOpen] = await Promise.all([
            this.prisma.workOrder.count({ where }),
            this.prisma.workOrder.groupBy({
                by: ['status'],
                where,
                _count: true,
            }),
            this.prisma.workOrder.findMany({
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
            this.prisma.workOrder.aggregate({
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
            this.prisma.workOrder.count({
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
    async getTopPerformers(limit: number = 5, dateFrom?: Date, dateTo?: Date): Promise<TopPerformer[]> {
        const where: any = {
            status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
            assignedToId: { not: null },
            completedAt: { not: null },
            startedAt: { not: null },
        };

        if (dateFrom || dateTo) {
            where.completedAt = {};
            if (dateFrom) where.completedAt.gte = dateFrom;
            if (dateTo) where.completedAt.lte = dateTo;
        }

        const completedWorkOrders = await this.prisma.workOrder.findMany({
            where,
            select: {
                assignedTo: {
                    select: {
                        name: true,
                        role: {
                            select: {
                                name: true
                            }
                        },
                        site: {
                            select: {
                                name: true
                            }
                        }
                    },
                },
                startedAt: true,
                completedAt: true,
            },
        });

        const userStats: Record<string, { count: number; totalHours: number; role?: string; site?: string }> = {};

        completedWorkOrders.forEach((wo) => {
            if (wo.assignedTo && wo.startedAt && wo.completedAt) {
                const name = wo.assignedTo.name || 'Unknown';
                const role = wo.assignedTo.role?.name;
                const site = wo.assignedTo.site?.name;
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
    async getTopAssists(limit: number = 5, dateFrom?: Date, dateTo?: Date): Promise<TopPerformer[]> {
        const workOrderWhere: any = {
            status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
        };

        if (dateFrom || dateTo) {
            workOrderWhere.completedAt = {};
            if (dateFrom) workOrderWhere.completedAt.gte = dateFrom;
            if (dateTo) workOrderWhere.completedAt.lte = dateTo;
        }

        // Find all partner assignments on completed work orders
        const partnerAssignments = await this.prisma.workOrderAssignment.findMany({
            where: {
                role: 'PARTNER',
                status: 'APPROVED',
                workOrder: workOrderWhere
            },
            include: {
                user: {
                    select: {
                        name: true,
                        role: { select: { name: true } },
                        site: { select: { name: true } }
                    }
                },
                workOrder: {
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
            const site = assignment.user?.site?.name;
            const wo = assignment.workOrder;

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

        const stats = await this.prisma.workOrder.groupBy({
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

        const stats = await this.prisma.workOrder.groupBy({
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

        const sites = await this.prisma.site.findMany({
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

        return this.prisma.workOrder.findMany({
            where,
            include: {
                pelanggan: {
                    select: {
                        id: true,
                        idPelanggan: true,
                        nama: true,
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
    async getDepartmentWorkload(): Promise<Array<{
        departmentId: string | null;
        departmentName: string;
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
    }>> {
        const departments = await this.prisma.department.findMany({
            select: {
                id: true,
                name: true,
            },
        });

        const workload = await Promise.all(
            departments.map(async (dept) => {
                const [total, pending, inProgress, completed] = await Promise.all([
                    this.prisma.workOrder.count({
                        where: { departmentId: dept.id },
                    }),
                    this.prisma.workOrder.count({
                        where: { departmentId: dept.id, status: 'PENDING' },
                    }),
                    this.prisma.workOrder.count({
                        where: {
                            departmentId: dept.id,
                            status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
                        },
                    }),
                    this.prisma.workOrder.count({
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
            this.prisma.workOrder.findMany({
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
            this.prisma.workOrder.count({ where }),
            this.prisma.workOrder.count({
                where: {
                    ...where,
                    status: 'ASSIGNED',
                },
            }),
            this.prisma.workOrder.count({
                where: {
                    ...where,
                    status: 'IN_PROGRESS',
                },
            }),
            this.prisma.workOrder.count({
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
    async getIssueStatistics(limit: number = 5, dateFrom?: Date, dateTo?: Date): Promise<Array<{ issue: string; count: number }>> {
        const where: any = {};
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = dateFrom;
            if (dateTo) where.createdAt.lte = dateTo;
        }

        // Fetch all work orders for the period
        const workOrders = await this.prisma.workOrder.findMany({
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
    async getSiteStatistics(limit: number = 5, dateFrom?: Date, dateTo?: Date): Promise<Array<{ siteName: string; count: number; mostCommonIssue: string }>> {
        const where: any = {};

        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = dateFrom;
            if (dateTo) where.createdAt.lte = dateTo;
        }

        // 1. Find top sites (Group by pelangganId)
        const topSites = await this.prisma.workOrder.groupBy({
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
            const siteWorkOrders = await this.prisma.workOrder.findMany({
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
    async getDisconnectionStatistics(dateFrom?: Date, dateTo?: Date): Promise<Array<{ reason: string; count: number }>> {
        const where: any = {
            type: 'DISCONNECTION',
            status: 'COMPLETED',
        };

        if (dateFrom) {
            where.completedAt = { gte: dateFrom };
        }
        if (dateTo) {
            where.completedAt = { ...where.completedAt, lte: dateTo };
        }

        const groupBy = await this.prisma.workOrder.groupBy({
            by: ['disconnectionReason'],
            where: {
                ...where,
                disconnectionReason: { not: null },
            },
            _count: {
                _all: true,
            },
        });

        return groupBy.map((item) => ({
            reason: item.disconnectionReason!,
            count: item._count._all,
        }));
    }

    async addComment(workOrderId: string, message: string, userId: string): Promise<any> {
        return this.prisma.workOrderUpdate.create({
            data: {
                workOrderId,
                updateType: 'COMMENT',
                message,
                createdById: userId,
            },
        });
    }
}
