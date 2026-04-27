import type {
  SalaryDetailEntity,
  SalaryEntity,
  SalaryPeriodStatsEntity,
  SalaryStatus,
  SalaryWithDetailsEntity,
} from "../entities/SalaryEntity";

export interface SalaryFilters {
  month?: number;
  year?: number;
  status?: SalaryStatus;
  userId?: string;
  departmentId?: string;
  siteId?: string;
  employeeType?: string;
  skip?: number;
  take?: number;
}

export interface CreateSalaryInput {
  basicSalary: number;
  totalEarnings?: number;
  totalDeductions?: number;
  netSalary?: number;
  status?: SalaryStatus;
  calculatedAt?: Date | null;
}

export interface UpdateSalaryInput {
  totalEarnings?: number;
  totalDeductions?: number;
  netSalary?: number;
  status?: SalaryStatus;
  auditNotes?: string | null;
}

export interface CreateSalaryDetailInput {
  name: string;
  type: SalaryDetailEntity["type"];
  amount: number;
  quantity?: number | null;
  rate?: number | null;
  notes?: string | null;
}

export interface CreateSalaryDetailWithLoanInput extends CreateSalaryDetailInput {
  loanPaymentId?: string;
}

export interface ISalaryRepository {
  /** Get salary aggregate with details only. */
  findByIdWithDetailsOnly(id: string): Promise<SalaryWithDetailsEntity | null>;

  /** Create a salary record. */
  create(
    userId: string,
    month: number,
    year: number,
    data: CreateSalaryInput,
  ): Promise<SalaryEntity>;

  /** Find salary by ID with all relations. */
  findById(id: string): Promise<SalaryWithDetailsEntity | null>;

  /** Find salary by user and period. */
  findByUserPeriod(
    userId: string,
    month: number,
    year: number,
  ): Promise<SalaryEntity | null>;

  /** Find salaries by filter. */
  findAll(
    filters?: SalaryFilters,
  ): Promise<{ salaries: SalaryWithDetailsEntity[]; total: number }>;

  /** Update salary record. */
  update(id: string, data: UpdateSalaryInput): Promise<SalaryEntity>;

  /** Update salary status and audit metadata. */
  updateStatus(
    id: string,
    status: SalaryStatus,
    userId?: string,
    notes?: string,
  ): Promise<SalaryEntity>;

  /** Delete salary record. */
  delete(id: string): Promise<void>;

  /** Upsert salary record by user and period. */
  upsert(
    userId: string,
    month: number,
    year: number,
    data: CreateSalaryInput,
  ): Promise<SalaryEntity>;

  /** Add one salary detail. */
  addDetail(
    salaryId: string,
    detail: CreateSalaryDetailInput,
  ): Promise<SalaryDetailEntity>;

  /** Add many salary details. */
  addDetails(
    salaryId: string,
    details: CreateSalaryDetailInput[],
  ): Promise<number>;

  /** Delete all details for salary. */
  clearDetails(salaryId: string): Promise<void>;

  /** Add salary revision record. */
  addRevision(
    salaryId: string,
    field: string,
    oldValue: string | null,
    newValue: string | null,
    reason: string,
    revisedById: string,
  ): Promise<unknown>;

  /** Get summary stats for a salary period. */
  getPeriodStats(month: number, year: number): Promise<SalaryPeriodStatsEntity>;
}
