import { PrismaClient } from '@prisma/client';

export interface USOContributionDTO {
    id: string;
    quarter: number;
    year: number;
    totalRevenue: string;
    usoRate: number;
    usoAmount: string;
    status: string;
    calculatedAt?: Date;
    filedAt?: Date;
    filedBy?: string;
    paidAt?: Date;
    paidBy?: string;
    paymentReference?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateUSODTO {
    quarter: number;
    year: number;
    totalRevenue?: bigint;
    usoRate?: number;
    notes?: string;
    createdBy?: string;
}

export interface IUSORepository {
    // CRUD
    findAll(filters?: { year?: number; status?: string; quarter?: number }): Promise<USOContributionDTO[]>;
    findById(id: string): Promise<USOContributionDTO | null>;
    findByQuarter(quarter: number, year: number): Promise<USOContributionDTO | null>;
    create(data: CreateUSODTO): Promise<USOContributionDTO>;
    update(id: string, data: Partial<USOContributionDTO>): Promise<USOContributionDTO>;
    delete(id: string): Promise<void>;

    // Status updates
    markAsFiled(id: string, filedBy: string): Promise<USOContributionDTO>;
    markAsPaid(id: string, paidBy: string, paymentReference?: string): Promise<USOContributionDTO>;

    // Calculation
    calculateForQuarter(quarter: number, year: number, createdBy?: string): Promise<USOContributionDTO>;
    getQuarterlyRevenue(quarter: number, year: number): Promise<bigint>;
}
