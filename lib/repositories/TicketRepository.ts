import { PrismaClient } from '@prisma/client';
import type { Ticket, TicketCategory, TicketMessage, TicketStatus, TicketPriority } from '@prisma/client';
import type {
    ITicketRepository,
    TicketWithRelations,
    CreateTicketData,
    UpdateTicketData,
    CreateMessageData,
    TicketFilters,
    TicketStatistics,
} from './ITicketRepository';

export class TicketRepository implements ITicketRepository {
    constructor(private prisma: PrismaClient) { }

    async generateTicketNumber(): Promise<string> {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

        // Get count of tickets created today
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const count = await this.prisma.ticket.count({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
        });

        const sequence = (count + 1).toString().padStart(4, '0');
        return `TIK-${dateStr}-${sequence}`;
    }

    async create(data: CreateTicketData): Promise<Ticket> {
        const ticketNumber = await this.generateTicketNumber();

        return this.prisma.ticket.create({
            data: {
                ticketNumber,
                pelangganId: data.pelangganId,
                categoryId: data.categoryId,
                subject: data.subject,
                description: data.description,
                priority: data.priority || 'NORMAL',
                attachments: data.attachments
                    ? {
                        create: data.attachments.map((att) => ({
                            fileName: att.fileName,
                            filePath: att.filePath,
                            fileSize: att.fileSize,
                            fileType: att.fileType,
                            uploadedBy: data.pelangganId,
                        })),
                    }
                    : undefined,
            },
        });
    }

    async findById(id: string): Promise<TicketWithRelations | null> {
        return this.prisma.ticket.findUnique({
            where: { id },
            include: {
                category: true,
                pelanggan: {
                    select: {
                        id: true,
                        idPelanggan: true,
                        nama: true,
                        email: true,
                        noTelp: true,
                    },
                },
                messages: {
                    include: {
                        attachments: true,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
                attachments: true,
            },
        });
    }

    async findByTicketNumber(ticketNumber: string): Promise<TicketWithRelations | null> {
        return this.prisma.ticket.findUnique({
            where: { ticketNumber },
            include: {
                category: true,
                pelanggan: {
                    select: {
                        id: true,
                        idPelanggan: true,
                        nama: true,
                        email: true,
                        noTelp: true,
                    },
                },
                messages: {
                    include: {
                        attachments: true,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
                attachments: true,
            },
        });
    }

    async findByPelangganId(pelangganId: string, filters?: TicketFilters): Promise<TicketWithRelations[]> {
        return this.prisma.ticket.findMany({
            where: {
                pelangganId,
                ...(filters?.status && {
                    status: Array.isArray(filters.status) ? { in: filters.status } : filters.status,
                }),
                ...(filters?.priority && {
                    priority: Array.isArray(filters.priority) ? { in: filters.priority } : filters.priority,
                }),
                ...(filters?.categoryId && { categoryId: filters.categoryId }),
            },
            include: {
                category: true,
                messages: {
                    where: {
                        isInternal: false, // Only public messages for customer
                    },
                    include: {
                        attachments: true,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
                attachments: true,
            },
            orderBy: {
                lastActivityAt: 'desc',
            },
        });
    }

    async findAll(
        filters?: TicketFilters,
        page: number = 1,
        limit: number = 20
    ): Promise<{
        tickets: TicketWithRelations[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const where: any = {};

        if (filters?.pelangganId) {
            where.pelangganId = filters.pelangganId;
        }

        if (filters?.status) {
            where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
        }

        if (filters?.priority) {
            where.priority = Array.isArray(filters.priority) ? { in: filters.priority } : filters.priority;
        }

        if (filters?.categoryId) {
            where.categoryId = filters.categoryId;
        }

        if (filters?.assignedToId !== undefined) {
            where.assignedToId = filters.assignedToId;
        }

        if (filters?.unassignedOnly) {
            where.assignedToId = null;
        }

        if (filters?.search) {
            where.OR = [
                { subject: { contains: filters.search, mode: 'insensitive' } },
                { ticketNumber: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        if (filters?.dateFrom || filters?.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
            if (filters.dateTo) where.createdAt.lte = filters.dateTo;
        }

        const [tickets, total] = await Promise.all([
            this.prisma.ticket.findMany({
                where,
                include: {
                    category: true,
                    pelanggan: {
                        select: {
                            id: true,
                            idPelanggan: true,
                            nama: true,
                            email: true,
                            noTelp: true,
                        },
                    },
                    messages: {
                        include: {
                            attachments: true,
                        },
                        orderBy: {
                            createdAt: 'asc',
                        },
                    },
                    attachments: true,
                },
                orderBy: {
                    lastActivityAt: 'desc',
                },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.ticket.count({ where }),
        ]);

        return {
            tickets,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async update(id: string, data: UpdateTicketData): Promise<Ticket> {
        return this.prisma.ticket.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date(),
                lastActivityAt: new Date(),
            },
        });
    }

    async delete(id: string): Promise<void> {
        await this.prisma.ticket.delete({
            where: { id },
        });
    }

    async addMessage(data: CreateMessageData): Promise<TicketMessage> {
        // Create message and update ticket's lastActivityAt
        const message = await this.prisma.ticketMessage.create({
            data: {
                ticketId: data.ticketId,
                message: data.message,
                isInternal: data.isInternal || false,
                senderType: data.senderType,
                senderId: data.senderId,
                senderName: data.senderName,
                attachments: data.attachments
                    ? {
                        create: data.attachments.map((att) => ({
                            fileName: att.fileName,
                            filePath: att.filePath,
                            fileSize: att.fileSize,
                            fileType: att.fileType,
                            uploadedBy: data.senderId,
                        })),
                    }
                    : undefined,
            },
            include: {
                attachments: true,
            },
        });

        // Update ticket's lastActivityAt and check if this is first response
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: data.ticketId },
            select: { firstResponseAt: true },
        });

        const updateData: any = {
            lastActivityAt: new Date(),
        };

        // If this is first staff response, mark it
        if (data.senderType === 'STAFF' && !ticket?.firstResponseAt) {
            updateData.firstResponseAt = new Date();
            await this.prisma.ticketMessage.update({
                where: { id: message.id },
                data: { isFirstResponse: true },
            });
        }

        await this.prisma.ticket.update({
            where: { id: data.ticketId },
            data: updateData,
        });

        return message;
    }

    async getMessages(ticketId: string, includeInternal: boolean = false): Promise<TicketMessage[]> {
        return this.prisma.ticketMessage.findMany({
            where: {
                ticketId,
                ...(includeInternal ? {} : { isInternal: false }),
            },
            include: {
                attachments: true,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
    }

    async assignToUser(ticketId: string, userId: string): Promise<Ticket> {
        return this.prisma.ticket.update({
            where: { id: ticketId },
            data: {
                assignedToId: userId,
                assignedAt: new Date(),
                status: 'IN_PROGRESS', // Auto set to in progress when assigned
            },
        });
    }

    async unassign(ticketId: string): Promise<Ticket> {
        return this.prisma.ticket.update({
            where: { id: ticketId },
            data: {
                assignedToId: null,
                assignedAt: null,
            },
        });
    }

    async updateStatus(ticketId: string, status: TicketStatus): Promise<Ticket> {
        const updateData: any = {
            status,
            lastActivityAt: new Date(),
        };

        if (status === 'RESOLVED') {
            updateData.resolvedAt = new Date();
        } else if (status === 'CLOSED') {
            updateData.closedAt = new Date();
        }

        return this.prisma.ticket.update({
            where: { id: ticketId },
            data: updateData,
        });
    }

    async markAsResolved(ticketId: string): Promise<Ticket> {
        return this.updateStatus(ticketId, 'RESOLVED');
    }

    async markAsClosed(ticketId: string): Promise<Ticket> {
        return this.updateStatus(ticketId, 'CLOSED');
    }

    async getStatistics(filters?: Omit<TicketFilters, 'search'>): Promise<TicketStatistics> {
        const where: any = {};

        if (filters?.pelangganId) where.pelangganId = filters.pelangganId;
        if (filters?.categoryId) where.categoryId = filters.categoryId;
        if (filters?.assignedToId !== undefined) where.assignedToId = filters.assignedToId;
        if (filters?.dateFrom || filters?.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
            if (filters.dateTo) where.createdAt.lte = filters.dateTo;
        }

        const [total, statusCounts, responseTimeData, satisfactionData] = await Promise.all([
            this.prisma.ticket.count({ where }),
            this.prisma.ticket.groupBy({
                by: ['status'],
                where,
                _count: true,
            }),
            this.prisma.ticket.findMany({
                where: {
                    ...where,
                    firstResponseAt: { not: null },
                },
                select: {
                    createdAt: true,
                    firstResponseAt: true,
                    resolvedAt: true,
                },
            }),
            this.prisma.ticket.aggregate({
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

        // Calculate status counts
        const statusMap = statusCounts.reduce((acc, item) => {
            acc[item.status] = item._count;
            return acc;
        }, {} as Record<string, number>);

        // Calculate average response time
        let totalResponseTimeHours = 0;
        let totalResolutionTimeHours = 0;
        let responseCount = 0;
        let resolutionCount = 0;

        responseTimeData.forEach((ticket) => {
            if (ticket.firstResponseAt) {
                const responseTime = ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
                totalResponseTimeHours += responseTime / (1000 * 60 * 60);
                responseCount++;
            }

            if (ticket.resolvedAt) {
                const resolutionTime = ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
                totalResolutionTimeHours += resolutionTime / (1000 * 60 * 60);
                resolutionCount++;
            }
        });

        return {
            total,
            open: statusMap['OPEN'] || 0,
            inProgress: statusMap['IN_PROGRESS'] || 0,
            waitingCustomer: statusMap['WAITING_CUSTOMER'] || 0,
            resolved: statusMap['RESOLVED'] || 0,
            closed: statusMap['CLOSED'] || 0,
            avgResponseTimeHours: responseCount > 0 ? totalResponseTimeHours / responseCount : 0,
            avgResolutionTimeHours: resolutionCount > 0 ? totalResolutionTimeHours / resolutionCount : 0,
            satisfactionRating: satisfactionData._avg.rating || null,
            totalWithRating: satisfactionData._count.rating || 0,
        };
    }

    async createCategory(data: {
        name: string;
        description?: string;
        color?: string;
        icon?: string;
    }): Promise<TicketCategory> {
        // Get max display order
        const maxOrder = await this.prisma.ticketCategory.aggregate({
            _max: {
                displayOrder: true,
            },
        });

        return this.prisma.ticketCategory.create({
            data: {
                ...data,
                displayOrder: (maxOrder._max.displayOrder || 0) + 1,
            },
        });
    }

    async findAllCategories(activeOnly: boolean = false): Promise<TicketCategory[]> {
        return this.prisma.ticketCategory.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: {
                displayOrder: 'asc',
            },
        });
    }

    async updateCategory(id: string, data: Partial<TicketCategory>): Promise<TicketCategory> {
        return this.prisma.ticketCategory.update({
            where: { id },
            data,
        });
    }

    async deleteCategory(id: string): Promise<void> {
        // Soft delete by setting isActive to false
        await this.prisma.ticketCategory.update({
            where: { id },
            data: { isActive: false },
        });
    }
}
