import { PrismaClient } from '@prisma/client';
import type { WorkOrder, WorkOrderTask, WorkOrderAssignment, WorkOrderUpdate, WorkOrderAttachment, WorkOrderStatus, WorkOrderPriority, TaskStatus } from '@prisma/client';
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
} from './IWorkOrderRepository';

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
            },
        });
    }

    async createFromTicket(ticketId: string, additionalData?: Partial<CreateWorkOrderData>): Promise<WorkOrder> {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            include: { pelanggan: true },
        });

        if (!ticket) {
            throw new Error('Ticket not found');
        }

        return this.create({
            pelangganId: ticket.pelangganId,
            ticketId,
            type: additionalData?.type || 'TROUBLESHOOT',
            title: additionalData?.title || ticket.subject,
            description: additionalData?.description || ticket.description,
            priority: additionalData?.priority || (ticket.priority as any),
            ...additionalData,
        });
    }

    async findById(id: string): Promise<WorkOrderWithRelations | null> {
        return this.prisma.workOrder.findUnique({
            where: { id },
            include: {
                ticket: {
                    select: {
                        id: true,
                        ticketNumber: true,
                        subject: true,
                    },
                },
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
                        fullName: true,
                        email: true,
                    },
                },
                tasks: {
                    orderBy: { order: 'asc' },
                },
                assignments: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                fullName: true,
                            },
                        },
                    },
                },
                updates: {
                    include: {
                        createdBy: {
                            select: {
                                fullName: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                attachments: {
                    include: {
                        uploadedBy: {
                            select: {
                                fullName: true,
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
                ticket: {
                    select: {
                        id: true,
                        ticketNumber: true,
                        subject: true,
                    },
                },
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
                        fullName: true,
                        email: true,
                    },
                },
                tasks: {
                    orderBy: { order: 'asc' },
                },
                assignments: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                fullName: true,
                            },
                        },
                    },
                },
                updates: {
                    include: {
                        createdBy: {
                            select: {
                                fullName: true,
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

        if (filters?.assignedToId !== undefined) {
            where.assignedToId = filters.assignedToId;
        }

        if (filters?.unassignedOnly) {
            where.assignedToId = null;
        }

        if (filters?.pelangganId) {
            where.pelangganId = filters.pelangganId;
        }

        if (filters?.ticketId) {
            where.ticketId = filters.ticketId;
        }

        if (filters?.search) {
            where.OR = [
                { workOrderNumber: { contains: filters.search, mode: 'insensitive' } },
                { title: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
            ];
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
                    ticket: {
                        select: {
                            id: true,
                            ticketNumber: true,
                            subject: true,
                        },
                    },
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
                            fullName: true,
                            email: true,
                        },
                    },
                    tasks: true,
                    assignments: {
                        include: {
                            employee: {
                                select: {
                                    id: true,
                                    fullName: true,
                                },
                            },
                        },
                    },
                    updates: {
                        include: {
                            createdBy: {
                                select: {
                                    fullName: true,
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

        // Add update log
        await this.addUpdate({
            workOrderId: id,
            updateType: 'STATUS_CHANGE',
            message: `Status changed from ${workOrder.status} to ${status}`,
            oldStatus: workOrder.status,
            newStatus: status,
            createdById: userId,
        });

        // Update linked ticket status
        if (workOrder.ticketId) {
            let ticketStatus = null;
            if (status === 'IN_PROGRESS') ticketStatus = 'IN_PROGRESS';
            else if (status === 'COMPLETED' || status === 'VERIFIED') ticketStatus = 'RESOLVED';

            if (ticketStatus) {
                await this.prisma.ticket.update({
                    where: { id: workOrder.ticketId },
                    data: { status: ticketStatus as any },
                });
            }
        }

        return this.update(id, updateData);
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

    async addAssignment(workOrderId: string, employeeId: string, role?: string): Promise<WorkOrderAssignment> {
        return this.prisma.workOrderAssignment.create({
            data: {
                workOrderId,
                employeeId,
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
        const createdById = await this.resolveEmployeeId(data.createdById);
        return this.prisma.workOrderUpdate.create({
            data: {
                ...data,
                createdById,
            },
        });
    }

    private async resolveEmployeeId(userIdOrEmployeeId?: string | null): Promise<string | undefined> {
        if (!userIdOrEmployeeId) return undefined;

        // 1. Check if it's already a valid Employee ID
        const employeeById = await this.prisma.employee.findUnique({
            where: { id: userIdOrEmployeeId },
            select: { id: true },
        });
        if (employeeById) return employeeById.id;

        // 2. Check if it's a User ID linked to an Employee
        // Note: Prisma schema must have userId unique in Employee for this to work efficiently
        // If not unique in schema (though logic implies it is), findFirst might be safer, but findUnique is better if schema supports it.
        // Checking schema: userId String? @unique in Employee. So findUnique is correct.
        const employeeByUserId = await this.prisma.employee.findUnique({
            where: { userId: userIdOrEmployeeId },
            select: { id: true },
        });
        if (employeeByUserId) return employeeByUserId.id;

        // 3. Keep as is if we can't resolve (though it might fail FK if it was a User ID and not Employee ID)
        // But if we return undefined, we assume "System" or "Unknown" which is safer than crashing.
        return undefined;
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
        const employeeId = await this.resolveEmployeeId(uploadedById);
        const attachment = await this.prisma.workOrderAttachment.create({
            data: {
                workOrderId,
                fileName,
                filePath,
                fileSize,
                fileType,
                caption,
                uploadedById: employeeId,
            },
        });

        // Log photo upload
        await this.addUpdate({
            workOrderId,
            updateType: 'PHOTO',
            message: `Photo uploaded: ${fileName}`,
            createdById: employeeId,
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
        if (filters?.ticketId) where.ticketId = filters.ticketId;
        if (filters?.dateFrom || filters?.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
            if (filters.dateTo) where.createdAt.lte = filters.dateTo;
        }

        const [total, statusCounts, completedOrders, ratingData] = await Promise.all([
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
            avgCompletionTimeHours: completedOrders.length > 0 ? totalCompletionHours / completedOrders.length : 0,
            totalCost,
            avgRating: ratingData._avg.rating || null,
            totalWithRating: ratingData._count.rating || 0,
        };
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
                        fullName: true,
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
                            fullName: true,
                        },
                    },
                    tasks: true,
                    assignments: {
                        include: {
                            employee: {
                                select: {
                                    id: true,
                                    fullName: true,
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
}
