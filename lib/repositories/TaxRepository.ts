import { PrismaClient, TaxRecord, TaxFilingDeadline } from '@prisma/client';
import {
    ITaxRepository,
    CreateTaxRecordDTO,
    UpdateTaxRecordDTO,
    TaxRecordFilter,
    CreateTaxFilingDeadlineDTO,
    UpdateTaxFilingDeadlineDTO,
    PPNReportData,
    PPHReportData,
    TaxCalculationResult,
} from './ITaxRepository';

export class TaxRepository implements ITaxRepository {
    constructor(private prisma: PrismaClient) { }

    // ============================================
    // TAX RECORDS
    // ============================================

    async createTaxRecord(data: CreateTaxRecordDTO): Promise<TaxRecord> {
        return await this.prisma.taxRecord.create({
            data: {
                ...data,
                taxableAmount: BigInt(data.taxableAmount),
                taxAmount: BigInt(data.taxAmount),
            },
        });
    }

    async getTaxRecords(
        filter: TaxRecordFilter,
        page = 1,
        limit = 50
    ): Promise<{
        data: TaxRecord[];
        total: number;
        page: number;
        limit: number;
    }> {
        const where: any = {};

        if (filter.taxType) {
            where.taxType = filter.taxType;
        }

        if (filter.taxPeriod) {
            where.taxPeriod = filter.taxPeriod;
        }

        if (filter.taxYear) {
            where.taxYear = filter.taxYear;
        }

        if (filter.status) {
            where.status = filter.status;
        }

        if (filter.relatedEntityType) {
            where.relatedEntityType = filter.relatedEntityType;
        }

        if (filter.startDate || filter.endDate) {
            where.createdAt = {};
            if (filter.startDate) {
                where.createdAt.gte = filter.startDate;
            }
            if (filter.endDate) {
                where.createdAt.lte = filter.endDate;
            }
        }

        const [data, total] = await Promise.all([
            this.prisma.taxRecord.findMany({
                where,
                orderBy: [
                    { taxYear: 'desc' },
                    { taxPeriod: 'desc' },
                    { createdAt: 'desc' },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.taxRecord.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    async getTaxRecordById(id: string): Promise<TaxRecord | null> {
        return await this.prisma.taxRecord.findUnique({
            where: { id },
        });
    }

    async updateTaxRecord(id: string, data: UpdateTaxRecordDTO): Promise<TaxRecord> {
        const updateData: any = { ...data };

        // Convert BigInt fields if present
        if (data.taxableAmount !== undefined) {
            updateData.taxableAmount = BigInt(data.taxableAmount);
        }
        if (data.taxAmount !== undefined) {
            updateData.taxAmount = BigInt(data.taxAmount);
        }

        return await this.prisma.taxRecord.update({
            where: { id },
            data: updateData,
        });
    }

    async deleteTaxRecord(id: string): Promise<void> {
        await this.prisma.taxRecord.delete({
            where: { id },
        });
    }

    // ============================================
    // TAX REPORTS
    // ============================================

    async getPPNReport(month: number, year: number): Promise<PPNReportData> {
        // Get all PPN records for the period
        const ppnInRecords = await this.prisma.taxRecord.findMany({
            where: {
                taxType: 'PPN_IN',
                taxPeriod: month,
                taxYear: year,
            },
            orderBy: { createdAt: 'asc' },
        });

        const ppnOutRecords = await this.prisma.taxRecord.findMany({
            where: {
                taxType: 'PPN_OUT',
                taxPeriod: month,
                taxYear: year,
            },
            orderBy: { createdAt: 'asc' },
        });

        // Calculate totals
        const ppnIn = ppnInRecords.reduce((sum, record) => sum + record.taxAmount, BigInt(0));
        const ppnOut = ppnOutRecords.reduce((sum, record) => sum + record.taxAmount, BigInt(0));
        const netPPN = ppnOut - ppnIn;

        return {
            period: month,
            year,
            ppnIn,
            ppnOut,
            netPPN,
            ppnInRecords,
            ppnOutRecords,
        };
    }

    async getPPHReport(month: number, year: number, type: string): Promise<PPHReportData> {
        // Get all PPh records for the period and type
        const pphRecords = await this.prisma.taxRecord.findMany({
            where: {
                taxType: type,
                taxPeriod: month,
                taxYear: year,
            },
            orderBy: { createdAt: 'asc' },
        });

        // Calculate totals
        const totalTaxableAmount = pphRecords.reduce((sum, record) => sum + record.taxableAmount, BigInt(0));
        const totalTaxAmount = pphRecords.reduce((sum, record) => sum + record.taxAmount, BigInt(0));
        const averageRate = pphRecords.length > 0
            ? Number(totalTaxAmount) / Number(totalTaxableAmount)
            : 0;

        return {
            period: month,
            year,
            taxType: type,
            pphRecords,
            totalTaxableAmount,
            totalTaxAmount,
            averageRate,
        };
    }


    // ============================================
    // TAX FILING DEADLINES
    // ============================================

    async createDeadline(data: CreateTaxFilingDeadlineDTO): Promise<TaxFilingDeadline> {
        return await this.prisma.taxFilingDeadline.create({
            data,
        });
    }

    async getDeadlines(
        month?: number,
        year?: number,
        status?: string
    ): Promise<TaxFilingDeadline[]> {
        const where: any = {};

        if (month) {
            where.period = month;
        }

        if (year) {
            where.year = year;
        }

        if (status) {
            where.status = status;
        }

        return await this.prisma.taxFilingDeadline.findMany({
            where,
            orderBy: [{ year: 'desc' }, { period: 'desc' }, { deadline: 'asc' }],
        });
    }

    async getDeadlineById(id: string): Promise<TaxFilingDeadline | null> {
        return await this.prisma.taxFilingDeadline.findUnique({
            where: { id },
        });
    }

    async updateDeadline(
        id: string,
        data: UpdateTaxFilingDeadlineDTO
    ): Promise<TaxFilingDeadline> {
        return await this.prisma.taxFilingDeadline.update({
            where: { id },
            data,
        });
    }

    async markDeadlineAsFiled(id: string, filedBy: string): Promise<TaxFilingDeadline> {
        return await this.prisma.taxFilingDeadline.update({
            where: { id },
            data: {
                status: 'FILED',
                filedAt: new Date(),
                filedBy,
            },
        });
    }

    // ============================================
    // UTILITIES
    // ============================================

    async calculateTax(taxType: string, taxableAmount: bigint): Promise<TaxCalculationResult> {
        let taxRate = 0;
        let details = '';

        switch (taxType) {
            case 'PPN_IN':
            case 'PPN_OUT':
                taxRate = 0.11; // 11% PPN
                details = 'PPN 11% dari DPP';
                break;

            case 'PPH_21':
                // Simplified PPh 21 - real calculation is more complex
                taxRate = 0.05; // 5% flat for simplicity
                details = 'PPh 21 - simplified calculation';
                break;

            case 'PPH_23':
                taxRate = 0.02; // 2% for services
                details = 'PPh Pasal 23 - jasa';
                break;

            case 'PPH_4_2':
                taxRate = 0.10; // 10% for rental
                details = 'PPh Pasal 4 ayat 2 - sewa';
                break;

            default:
                throw new Error(`Unknown tax type: ${taxType}`);
        }

        const taxAmount = BigInt(Math.floor(Number(taxableAmount) * taxRate));

        return {
            taxableAmount,
            taxRate,
            taxAmount,
            details,
        };
    }
}
