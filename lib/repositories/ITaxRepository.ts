import { TaxRecord, TaxFilingDeadline } from '@prisma/client';

// Tax Record DTOs
export interface CreateTaxRecordDTO {
    taxType: string;
    taxPeriod: number;
    taxYear: number;
    taxableAmount: bigint;
    taxAmount: bigint;
    taxRate: number;
    reference?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    notes?: string;
    createdBy?: string;
}

export interface UpdateTaxRecordDTO {
    taxType?: string;
    taxPeriod?: number;
    taxYear?: number;
    taxableAmount?: bigint;
    taxAmount?: bigint;
    taxRate?: number;
    reference?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    status?: string;
    filedAt?: Date;
    paidAt?: Date;
    notes?: string;
    updatedBy?: string;
}

export interface TaxRecordFilter {
    taxType?: string;
    taxPeriod?: number;
    taxYear?: number;
    status?: string;
    relatedEntityType?: string;
    startDate?: Date;
    endDate?: Date;
}

// Tax Filing Deadline DTOs
export interface CreateTaxFilingDeadlineDTO {
    taxType: string;
    period: number;
    year: number;
    deadline: Date;
    notes?: string;
}

export interface UpdateTaxFilingDeadlineDTO {
    deadline?: Date;
    status?: string;
    filedAt?: Date;
    filedBy?: string;
    notes?: string;
}

// Tax Report DTOs
export interface PPNReportData {
    period: number;
    year: number;
    ppnIn: bigint; // PPN from purchases
    ppnOut: bigint; // PPN from sales
    netPPN: bigint; // ppnOut - ppnIn
    ppnInRecords: TaxRecord[];
    ppnOutRecords: TaxRecord[];
}

export interface PPHReportData {
    period: number;
    year: number;
    taxType: string;
    pphRecords: TaxRecordDTO[];
    totalTaxableAmount: bigint;
    totalTaxAmount: bigint;
    averageRate: number;
}

export interface TaxCalculationResult {
    taxableAmount: bigint;
    taxRate: number;
    taxAmount: bigint;
    details: string;
}

// Repository Interface
export interface ITaxRepository {
    // Tax Record CRUD
    createTaxRecord(data: CreateTaxRecordDTO): Promise<TaxRecordDTO>;
    getTaxRecords(filters: TaxRecordFilters): Promise<PaginatedResult<TaxRecordDTO>>;
    getTaxRecordById(id: string): Promise<TaxRecordDTO | null>;
    updateTaxRecord(id: string, data: Partial<CreateTaxRecordDTO>): Promise<TaxRecordDTO>;
    deleteTaxRecord(id: string): Promise<void>;

    // Tax Reports
    getPPNReport(month: number, year: number): Promise<PPNReportData>;
    getPPHReport(month: number, year: number, type: string): Promise<PPHReportData>;

    // Tax Deadlines
    createDeadline(data: CreateTaxFilingDeadlineDTO): Promise<TaxFilingDeadline>;
    getDeadlines(month?: number, year?: number, status?: string): Promise<TaxFilingDeadline[]>;
    getDeadlineById(id: string): Promise<TaxFilingDeadline | null>;
    updateDeadline(id: string, data: UpdateTaxFilingDeadlineDTO): Promise<TaxFilingDeadline>;
    markDeadlineAsFiled(id: string, filedBy: string): Promise<TaxFilingDeadline>;

    // Utilities
    calculateTax(taxType: string, taxableAmount: bigint): Promise<TaxCalculationResult>;
}
