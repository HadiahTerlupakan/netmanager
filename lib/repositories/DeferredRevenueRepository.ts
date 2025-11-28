import { PrismaClient } from '@prisma/client';
import type {
    IDeferredRevenueRepository,
    DeferredRevenueDTO,
    RevenueRecognitionDTO,
    CreateDeferredRevenueDTO,
    RecognitionScheduleItem,
} from './IDeferredRevenueRepository';
import { addMonths, startOfMonth, isBefore, isAfter, isSameMonth } from 'date-fns';

export class DeferredRevenueRepository implements IDeferredRevenueRepository {
    private client: PrismaClient;

    constructor(prismaClient: PrismaClient) {
        this.client = prismaClient;
    }

    private toDTO(record: any): DeferredRevenueDTO {
        return {
            id: record.id,
            tagihanId: record.tagihanId,
            customerId: record.customerId,
            totalAmount: record.totalAmount.toString(),
            recognizedAmount: record.recognizedAmount.toString(),
            remainingAmount: record.remainingAmount.toString(),
            startDate: record.startDate,
            endDate: record.endDate,
            periodMonths: record.periodMonths,
            monthlyAmount: record.monthlyAmount.toString(),
            status: record.status,
            description: record.description,
            notes: record.notes,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            recognitions: record.recognitions?.map((r: any) => this.recognitionToDTO(r)),
        };
    }

    private recognitionToDTO(record: any): RevenueRecognitionDTO {
        return {
            id: record.id,
            deferredRevenueId: record.deferredRevenueId,
            recognitionDate: record.recognitionDate,
            amount: record.amount.toString(),
            notes: record.notes,
            pemasukanId: record.pemasukanId,
            createdAt: record.createdAt,
            recognizedBy: record.recognizedBy,
        };
    }

    async findAll(filters?: {
        status?: string;
        customerId?: string;
        tagihanId?: string;
    }): Promise<DeferredRevenueDTO[]> {
        const where: any = {};

        if (filters?.status) where.status = filters.status;
        if (filters?.customerId) where.customerId = filters.customerId;
        if (filters?.tagihanId) where.tagihanId = filters.tagihanId;

        const records = await (this.client as any).deferredRevenue.findMany({
            where,
            include: {
                recognitions: {
                    orderBy: { recognitionDate: 'asc' },
                },
            },
            orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
        });

        return records.map((r: any) => this.toDTO(r));
    }

    async findById(id: string): Promise<DeferredRevenueDTO | null> {
        const record = await (this.client as any).deferredRevenue.findUnique({
            where: { id },
            include: {
                recognitions: {
                    orderBy: { recognitionDate: 'asc' },
                },
            },
        });

        return record ? this.toDTO(record) : null;
    }

    async findByTagihan(tagihanId: string): Promise<DeferredRevenueDTO | null> {
        const record = await (this.client as any).deferredRevenue.findFirst({
            where: { tagihanId },
            include: {
                recognitions: {
                    orderBy: { recognitionDate: 'asc' },
                },
            },
        });

        return record ? this.toDTO(record) : null;
    }

    async create(data: CreateDeferredRevenueDTO): Promise<DeferredRevenueDTO> {
        const monthlyAmount = BigInt(Math.round(Number(data.totalAmount) / data.periodMonths));
        const endDate = data.endDate || addMonths(data.startDate, data.periodMonths);

        const record = await (this.client as any).deferredRevenue.create({
            data: {
                tagihanId: data.tagihanId,
                customerId: data.customerId,
                totalAmount: data.totalAmount,
                recognizedAmount: BigInt(0),
                remainingAmount: data.totalAmount,
                startDate: data.startDate,
                endDate,
                periodMonths: data.periodMonths,
                monthlyAmount,
                status: 'ACTIVE',
                description: data.description,
                notes: data.notes,
                createdBy: data.createdBy,
            },
            include: {
                recognitions: true,
            },
        });

        console.log(
            `[Deferred Revenue] Created deferred revenue ${record.id} - Total: ${data.totalAmount}, Monthly: ${monthlyAmount}, Period: ${data.periodMonths} months`
        );

        return this.toDTO(record);
    }

    async update(
        id: string,
        data: Partial<DeferredRevenueDTO>
    ): Promise<DeferredRevenueDTO> {
        const updateData: any = {};

        if (data.status !== undefined) updateData.status = data.status;
        if (data.notes !== undefined) updateData.notes = data.notes;

        const record = await (this.client as any).deferredRevenue.update({
            where: { id },
            data: updateData,
            include: {
                recognitions: {
                    orderBy: { recognitionDate: 'asc' },
                },
            },
        });

        return this.toDTO(record);
    }

    async cancel(id: string): Promise<DeferredRevenueDTO> {
        const record = await (this.client as any).deferredRevenue.update({
            where: { id },
            data: { status: 'CANCELLED' },
            include: {
                recognitions: {
                    orderBy: { recognitionDate: 'asc' },
                },
            },
        });

        console.log(`[Deferred Revenue] Cancelled ${id}`);
        return this.toDTO(record);
    }

    async recognizeRevenue(
        deferredId: string,
        recognitionDate: Date,
        recognizedBy?: string
    ): Promise<RevenueRecognitionDTO> {
        const deferred = await (this.client as any).deferredRevenue.findUnique({
            where: { id: deferredId },
        });

        if (!deferred) {
            throw new Error(`Deferred revenue ${deferredId} not found`);
        }

        if (deferred.status !== 'ACTIVE') {
            throw new Error(`Deferred revenue ${deferredId} is not active (status: ${deferred.status})`);
        }

        // Use start of month for consistent recognition dates
        const recognitionMonth = startOfMonth(recognitionDate);

        // Check if already recognized
        const existing = await (this.client as any).revenueRecognition.findUnique({
            where: {
                deferredRevenueId_recognitionDate: {
                    deferredRevenueId: deferredId,
                    recognitionDate: recognitionMonth,
                },
            },
        });

        if (existing) {
            throw new Error(`Revenue already recognized for ${recognitionMonth.toISOString()}`);
        }

        // Create recognition record
        const recognition = await (this.client as any).revenueRecognition.create({
            data: {
                deferredRevenueId: deferredId,
                recognitionDate: recognitionMonth,
                amount: deferred.monthlyAmount,
                recognizedBy,
            },
        });

        // Update deferred revenue balances
        const newRecognized = deferred.recognizedAmount + deferred.monthlyAmount;
        const newRemaining = deferred.totalAmount - newRecognized;
        const newStatus = newRemaining <= BigInt(0) ? 'COMPLETED' : 'ACTIVE';

        await (this.client as any).deferredRevenue.update({
            where: { id: deferredId },
            data: {
                recognizedAmount: newRecognized,
                remainingAmount: newRemaining,
                status: newStatus,
            },
        });

        console.log(
            `[Deferred Revenue] Recognized ${deferred.monthlyAmount} for ${deferredId} - Remaining: ${newRemaining}`
        );

        return this.recognitionToDTO(recognition);
    }

    async getRecognitionSchedule(deferredId: string): Promise<RecognitionScheduleItem[]> {
        const deferred = await (this.client as any).deferredRevenue.findUnique({
            where: { id: deferredId },
            include: {
                recognitions: true,
            },
        });

        if (!deferred) {
            throw new Error(`Deferred revenue ${deferredId} not found`);
        }

        const schedule: RecognitionScheduleItem[] = [];
        const now = new Date();
        let currentDate = startOfMonth(deferred.startDate);

        for (let i = 0; i < deferred.periodMonths; i++) {
            const recognition = deferred.recognitions.find((r: any) =>
                isSameMonth(r.recognitionDate, currentDate)
            );

            let status: 'RECOGNIZED' | 'PENDING' | 'FUTURE';
            if (recognition) {
                status = 'RECOGNIZED';
            } else if (isBefore(currentDate, startOfMonth(now))) {
                status = 'PENDING';
            } else {
                status = 'FUTURE';
            }

            schedule.push({
                month: currentDate,
                amount: deferred.monthlyAmount.toString(),
                status,
                recognizedAt: recognition?.createdAt,
                recognitionId: recognition?.id,
            });

            currentDate = addMonths(currentDate, 1);
        }

        return schedule;
    }

    async findDueForRecognition(month: Date): Promise<DeferredRevenueDTO[]> {
        const monthStart = startOfMonth(month);

        const records = await (this.client as any).deferredRevenue.findMany({
            where: {
                status: 'ACTIVE',
                startDate: {
                    lte: monthStart,
                },
                endDate: {
                    gte: monthStart,
                },
            },
            include: {
                recognitions: true,
            },
        });

        // Filter out those already recognized for this month
        const dueRecords = records.filter((r: any) => {
            const alreadyRecognized = r.recognitions.some((rec: any) =>
                isSameMonth(rec.recognitionDate, monthStart)
            );
            return !alreadyRecognized;
        });

        return dueRecords.map((r: any) => this.toDTO(r));
    }

    async getTotalDeferredBalance(): Promise<bigint> {
        const result = await (this.client as any).deferredRevenue.aggregate({
            where: {
                status: 'ACTIVE',
            },
            _sum: {
                remainingAmount: true,
            },
        });

        return result._sum?.remainingAmount || BigInt(0);
    }

    async getMonthlyRecognitionAmount(month: Date): Promise<bigint> {
        const monthStart = startOfMonth(month);
        const monthEnd = addMonths(monthStart, 1);

        const result = await (this.client as any).revenueRecognition.aggregate({
            where: {
                recognitionDate: {
                    gte: monthStart,
                    lt: monthEnd,
                },
            },
            _sum: {
                amount: true,
            },
        });

        return result._sum?.amount || BigInt(0);
    }
}
