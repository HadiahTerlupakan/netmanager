import type { Ticket, TicketCategory, TicketMessage, TicketAttachment, TicketStatus, TicketPriority } from '@prisma/client';

export interface TicketWithRelations extends Ticket {
    category?: TicketCategory | null;
    messages?: TicketMessage[];
    attachments?: TicketAttachment[];
    pelanggan?: {
        id: string;
        idPelanggan: string;
        nama: string;
        email: string | null;
        noTelp: string | null;
    };
}

export interface CreateTicketData {
    pelangganId: string;
    categoryId?: string;
    subject: string;
    description: string;
    priority?: TicketPriority;
    attachments?: {
        fileName: string;
        filePath: string;
        fileSize: number;
        fileType: string;
    }[];
}

export interface UpdateTicketData {
    categoryId?: string;
    subject?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    assignedToId?: string | null;
    rating?: number;
    feedback?: string;
}

export interface CreateMessageData {
    ticketId: string;
    message: string;
    isInternal?: boolean;
    senderType: 'CUSTOMER' | 'STAFF';
    senderId?: string;
    senderName: string;
    attachments?: {
        fileName: string;
        filePath: string;
        fileSize: number;
        fileType: string;
    }[];
}

export interface TicketFilters {
    pelangganId?: string;
    status?: TicketStatus | TicketStatus[];
    priority?: TicketPriority | TicketPriority[];
    categoryId?: string;
    assignedToId?: string | null;
    search?: string; // Search in subject or ticket number
    dateFrom?: Date;
    dateTo?: Date;
    unassignedOnly?: boolean;
}

export interface TicketStatistics {
    total: number;
    open: number;
    inProgress: number;
    waitingCustomer: number;
    resolved: number;
    closed: number;
    avgResponseTimeHours: number;
    avgResolutionTimeHours: number;
    satisfactionRating: number | null; // Average rating
    totalWithRating: number;
}

export interface ITicketRepository {
    // Ticket CRUD
    create(data: CreateTicketData): Promise<Ticket>;
    findById(id: string): Promise<TicketWithRelations | null>;
    findByTicketNumber(ticketNumber: string): Promise<TicketWithRelations | null>;
    findByPelangganId(pelangganId: string, filters?: TicketFilters): Promise<TicketWithRelations[]>;
    findAll(filters?: TicketFilters, page?: number, limit?: number): Promise<{
        tickets: TicketWithRelations[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    update(id: string, data: UpdateTicketData): Promise<Ticket>;
    delete(id: string): Promise<void>;

    // Messages
    addMessage(data: CreateMessageData): Promise<TicketMessage>;
    getMessages(ticketId: string, includeInternal?: boolean): Promise<TicketMessage[]>;

    // Assignment
    assignToUser(ticketId: string, userId: string): Promise<Ticket>;
    unassign(ticketId: string): Promise<Ticket>;

    // Status updates
    updateStatus(ticketId: string, status: TicketStatus): Promise<Ticket>;
    markAsResolved(ticketId: string): Promise<Ticket>;
    markAsClosed(ticketId: string): Promise<Ticket>;

    // Statistics
    getStatistics(filters?: Omit<TicketFilters, 'search'>): Promise<TicketStatistics>;

    // Categories
    createCategory(data: { name: string; description?: string; color?: string; icon?: string }): Promise<TicketCategory>;
    findAllCategories(activeOnly?: boolean): Promise<TicketCategory[]>;
    updateCategory(id: string, data: Partial<TicketCategory>): Promise<TicketCategory>;
    deleteCategory(id: string): Promise<void>;

    // Generate ticket number
    generateTicketNumber(): Promise<string>;
}
