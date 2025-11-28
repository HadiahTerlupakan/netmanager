import { PrismaClient } from '@prisma/client';
import type {
    IUSORepository,
    USOContributionDTO,
    CreateUSODTO,
} from './IUSORepository';

export class USORepository implements IUSORepository {
    private client: PrismaClient;

    constructor(prismaClient: PrismaClient) {
        this.client = prismaClient;
    }

    private toDTO(record: any): USOContributionDTO {
        return {
            id: record.id,
            quarter: record.quarter,
            year: record.year,
            totalRevenue: record.totalRevenue.toString(),
            usoRate: record.usoRate,
            usoAmount: record.usoAmount.toString(),
            status: record.status,
            calculatedAt: record.calculatedAt,
            filedAt: record.filedAt,
            filedBy: record.filedBy,
            paidAt: record.paidAt,
            paidBy: record.paidBy,
            paymentReference: record.paymentReference,
            notes: record.notes,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

    async findAll(filters?: {
        year?: number;
        status?: string;
        quarter?: number;
    }): Promise<USOContributionDTO[]> {
        const where: any = {};

        if (filters?.year) where.year = filters.year;
        if (filters?.status) where.status = filters.status;
        if (filters?.quarter) where.quarter = filters.quarter;

        const records = await (this.client as any).uSOContribution.findMany({
            where,
            orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
        });

        return records.map(this.toDTO);
    }

    async findById(id: string): Promise<USOContributionDTO | null> {
        const record = await (this.client as any).uSOContribution.findUnique({
            where: { id },
        });

        return record ? this.toDTO(record) : null;
    }

    async findByQuarter(
        quarter: number,
        year: number
    ): Promise<USOContributionDTO | null> {
        const record = await (this.client as any).uSOContribution.findUnique({
            where: {
                quarter_year: { quarter, year },
            },
        });

        return record ? this.toDTO(record) : null;
    }

    async create(data: CreateUSODTO): Promise<USOContributionDTO> {
        const usoRate = data.usoRate ?? 0.0125; // Default 1.25%

        let totalRevenue: bigint;
        let usoAmount: bigint;

        if (data.totalRevenue) {
            // Manual revenue provided
            totalRevenue = data.totalRevenue;
            usoAmount = BigInt(Math.round(Number(totalRevenue) * usoRate));
        } else {
            // Auto-calculate from Pemasukan
            totalRevenue = await this.getQuarterlyRevenue(data.quarter, data.year);
            usoAmount = BigInt(Math.round(Number(totalRevenue) * usoRate));
        }

        const record = await (this.client as any).uSOContribution.create({
            data: {
                quarter: data.quarter,
                year: data.year,
                totalRevenue,
                usoRate,
                usoAmount,
                status: totalRevenue > 0 ? 'CALCULATED' : 'DRAFT',
                calculatedAt: totalRevenue > 0 ? new Date() : null,
                notes: data.notes,
                createdBy: data.createdBy,
            },
        });

        console.log(
            `[USO] Created USO Q${data.quarter} ${data.year} - Revenue: ${totalRevenue}, USO: ${usoAmount} (${usoRate * 100}%)`
        );

        return this.toDTO(record);
    }

    async update(
        id: string,
        data: Partial<USOContributionDTO>
    ): Promise<USOContributionDTO> {
        const updateData: any = {};

        if (data.totalRevenue !== undefined) {
            updateData.totalRevenue = BigInt(data.totalRevenue);
            // Recalculate USO if revenue changes
            const usoRate = data.usoRate ?? 0.0125;
            updateData.usoAmount = BigInt(
                Math.round(Number(updateData.totalRevenue) * usoRate)
            );
        }
        if (data.usoRate !== undefined) updateData.usoRate = data.usoRate;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.notes !== undefined) updateData.notes = data.notes;

        const record = await (this.client as any).uSOContribution.update({
            where: { id },
            data: updateData,
        });

        return this.toDTO(record);
    }

    async delete(id: string): Promise<void> {
        await (this.client as any).uSOContribution.delete({
            where: { id },
        });
    }

    async markAsFiled(id: string, filedBy: string): Promise<USOContributionDTO> {
        const record = await (this.client as any).uSOContribution.update({
            where: { id },
            data: {
                status: 'FILED',
                filedAt: new Date(),
                filedBy,
            },
        });

        console.log(`[USO] Marked ${id} as FILED by ${filedBy}`);
        return this.toDTO(record);
    }

    async markAsPaid(
        id: string,
        paidBy: string,
        paymentReference?: string
    ): Promise<USOContributionDTO> {
        const record = await (this.client as any).uSOContribution.update({
            where: { id },
            data: {
                status: 'PAID',
                paidAt: new Date(),
                paidBy,
                paymentReference,
            },
        });

        console.log(`[USO] Marked ${id} as PAID by ${paidBy}`);
        return this.toDTO(record);
    }

    async calculateForQuarter(
        quarter: number,
        year: number,
        createdBy?: string
    ): Promise<USOContributionDTO> {
        // Check if already exists
        const existing = await this.findByQuarter(quarter, year);
        if (existing) {
            // Recalculate
            const revenue = await this.getQuarterlyRevenue(quarter, year);
            return await this.update(existing.id, {
                totalRevenue: revenue.toString(),
                status: 'CALCULATED',
            });
        }

        // Create new
        return await this.create({
            quarter,
            year,
            createdBy,
        });
    }

    async getQuarterlyRevenue(quarter: number, year: number): Promise<bigint> {
        // Define month ranges for each quarter
        const quarterMonths: Record<number, number[]> = {
            1: [1, 2, 3],
            2: [4, 5, 6],
            3: [7, 8, 9],
            4: [10, 11, 12],
        };

        const months = quarterMonths[quarter];
        if (!months) {
            throw new Error(`Invalid quarter: ${quarter}`);
        }

        // Calculate start and end dates
        const startDate = new Date(year, months[0] - 1, 1); // First day of first month
        const endDate = new Date(year, months[2], 0, 23, 59, 59); // Last day of last month

        // Sum all Pemasukan (revenue) in the quarter
        const result = await (this.client as any).pemasukan.aggregate({
            where: {
                tanggal: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            _sum: {
                jumlah: true,
            },
        });

        const total = result._sum?.jumlah || BigInt(0);

        console.log(
            `[USO] Q${quarter} ${year} revenue: ${total} (${months.join(', ')})`
        );

        return total;
    }
}
