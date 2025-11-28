import { PrismaClient } from '@prisma/client';

export interface DeferredRevenueDTO {
    id: string;
    tagihanId?: string;
    customerId?: string;
    totalAmount: string;
    recognizedAmount: string;
    remainingAmount: string;
    startDate: Date;
    endDate: Date;
    periodMonths: number;
    monthlyAmount: string;
    status: string;
    description?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
    recognitions?: RevenueRecognitionDTO[];
}

export interface RevenueRecognitionDTO {
    id: string;
    deferredRevenueId: string;
    recognitionDate: Date;
    amount: string;
    notes?: string;
    pemasukanId?: string;
    createdAt: Date;
    recognizedBy?: string;
}

export interface CreateDeferredRevenueDTO {
    tagihanId?: string;
    customerId?: string;
    totalAmount: bigint;
    periodMonths: number;
    startDate: Date;
    endDate?: Date; // Auto-calculated if not provided
    description?: string;
    notes?: string;
    createdBy?: string;
}

export interface RecognitionScheduleItem {
    month: Date;
    amount: string;
    status: 'RECOGNIZED' | 'PENDING' | 'FUTURE';
    recognizedAt?: Date;
    recognitionId?: string;
}

export interface IDeferredRevenueRepository {
    // CRUD
    findAll(filters?: {
        status?: string;
        customerId?: string;
        tagihanId?: string;
    }): Promise<DeferredRevenueDTO[]>;
    findById(id: string): Promise<DeferredRevenueDTO | null>;
    findByTagihan(tagihanId: string): Promise<DeferredRevenueDTO | null>;
    create(data: CreateDeferredRevenueDTO): Promise<DeferredRevenueDTO>;
    update(id: string, data: Partial<DeferredRevenueDTO>): Promise<DeferredRevenueDTO>;
    cancel(id: string): Promise<DeferredRevenueDTO>;

    // Recognition
    recognizeRevenue(
        deferredId: string,
        recognitionDate: Date,
        recognizedBy?: string
    ): Promise<RevenueRecognitionDTO>;
    getRecognitionSchedule(deferredId: string): Promise<RecognitionScheduleItem[]>;
    findDueForRecognition(month: Date): Promise<DeferredRevenueDTO[]>;

    // Reporting
    getTotalDeferredBalance(): Promise<bigint>;
    getMonthlyRecognitionAmount(month: Date): Promise<bigint>;
}
