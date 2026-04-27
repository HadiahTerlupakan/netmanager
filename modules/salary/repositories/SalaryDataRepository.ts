import { prisma } from "@/lib/prisma";
import type {
  PrismaClient,
  Prisma,
  EmployeeLoan,
  LoanPayment,
  Attendance,
} from "@prisma/client";
import type { RateType, EmployeeType, PtkpStatus } from "@prisma/client";

export interface UserSalaryConfig {
  id: string;
  name: string | null;
  basicSalary: number | null;
  employeeType: EmployeeType;
  departmentId: string | null;
  siteId: string | null;
  payPeriodDay: number | null;
  payDay: number | null;
  woIncentiveEnabled: boolean;
  woIncentiveRate: number | null;
  lateDeductionRate: number | null;
  absentDeductionRate: number | null;
  overtimeRateNormal: number | null;
  overtimeRateHoliday: number | null;
  overtimeRateNational: number | null;
  overtimeCalcTypeNormal: RateType | null;
  overtimeCalcTypeHoliday: RateType | null;
  overtimeCalcTypeNational: RateType | null;
  workDays: string | null;
  joinDate: Date | null;
  ptkpStatus: PtkpStatus | null;
  bpjsKesehatan: boolean;
  bpjsKetenagakerjaan: boolean;
}

export class SalaryUserRepository {
  constructor(private client: PrismaClient = prisma) {}

  /** Get salary user list with detailed payroll configuration. */
  async findSalaryUsers() {
    return this.client.user.findMany({
      where: {
        basicSalary: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeType: true,
        basicSalary: true,
        overtimeRateNormal: true,
        overtimeCalcTypeNormal: true,
        overtimeRateHoliday: true,
        overtimeCalcTypeHoliday: true,
        overtimeRateNational: true,
        overtimeCalcTypeNational: true,
        woIncentiveRate: true,
        lateDeductionRate: true,
        absentDeductionRate: true,
        joinDate: true,
        ptkpStatus: true,
        bpjsKesehatan: true,
        bpjsKetenagakerjaan: true,
        departments: {
          select: { name: true },
        },
        role: {
          select: { name: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  /** Get all active users for salary onboarding list. */
  async findAllActiveUsersForSalaryList() {
    return this.client.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeType: true,
        basicSalary: true,
      },
      orderBy: { name: "asc" },
    });
  }

  /** Get salary user detail by ID. */
  async findSalaryUserById(userId: string) {
    return this.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        employeeType: true,
        basicSalary: true,
        overtimeRateNormal: true,
        overtimeCalcTypeNormal: true,
        overtimeRateHoliday: true,
        overtimeCalcTypeHoliday: true,
        overtimeRateNational: true,
        overtimeCalcTypeNational: true,
        woIncentiveRate: true,
        lateDeductionRate: true,
        absentDeductionRate: true,
        joinDate: true,
        ptkpStatus: true,
        bpjsKesehatan: true,
        bpjsKetenagakerjaan: true,
        departments: {
          select: { name: true },
        },
        userSalaryComponents: {
          where: { isActive: true },
          include: {
            component: true,
          },
          orderBy: { component: { type: "asc" } },
        },
      },
    });
  }

  /** Update salary-related user configuration. */
  async updateSalaryConfig(userId: string, data: Prisma.UserUpdateInput) {
    return this.client.user.update({
      where: { id: userId },
      data,
    });
  }

  async findSalaryConfigById(userId: string): Promise<UserSalaryConfig | null> {
    return this.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        basicSalary: true,
        employeeType: true,
        departmentId: true,
        siteId: true,
        payPeriodDay: true,
        payDay: true,
        woIncentiveEnabled: true,
        woIncentiveRate: true,
        lateDeductionRate: true,
        absentDeductionRate: true,
        overtimeRateNormal: true,
        overtimeRateHoliday: true,
        overtimeRateNational: true,
        overtimeCalcTypeNormal: true,
        overtimeCalcTypeHoliday: true,
        overtimeCalcTypeNational: true,
        workDays: true,
        joinDate: true,
        ptkpStatus: true,
        bpjsKesehatan: true,
        bpjsKetenagakerjaan: true,
      },
    }) as Promise<UserSalaryConfig | null>;
  }

  async findManyActiveWithSalaryConfig(
    where?: Prisma.UserWhereInput,
  ): Promise<UserSalaryConfig[]> {
    return this.client.user.findMany({
      where: { isActive: true, basicSalary: { not: null }, ...where },
      select: {
        id: true,
        name: true,
        basicSalary: true,
        employeeType: true,
        departmentId: true,
        siteId: true,
        payPeriodDay: true,
        payDay: true,
        woIncentiveEnabled: true,
        woIncentiveRate: true,
        lateDeductionRate: true,
        absentDeductionRate: true,
        overtimeRateNormal: true,
        overtimeRateHoliday: true,
        overtimeRateNational: true,
        overtimeCalcTypeNormal: true,
        overtimeCalcTypeHoliday: true,
        overtimeCalcTypeNational: true,
        workDays: true,
        joinDate: true,
        ptkpStatus: true,
        bpjsKesehatan: true,
        bpjsKetenagakerjaan: true,
      },
    }) as Promise<UserSalaryConfig[]>;
  }

  async findWorkDaysConfig(
    userId: string,
  ): Promise<{ workDays: string | null } | null> {
    return this.client.user.findUnique({
      where: { id: userId },
      select: { workDays: true },
    });
  }
}

export class EmployeeLoanRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findActiveByUserId(userId: string): Promise<EmployeeLoan[]> {
    return this.client.employeeLoan.findMany({
      where: { userId, status: "ACTIVE" },
    });
  }

  async updateRemainingAmount(
    id: string,
    remainingAmount: number,
    status: string,
  ): Promise<EmployeeLoan> {
    return this.client.employeeLoan.update({
      where: { id },
      data: { remainingAmount, status: status as "ACTIVE" | "PAID_OFF" },
    });
  }

  async findLoanById(id: string): Promise<EmployeeLoan | null> {
    return this.client.employeeLoan.findUnique({ where: { id } });
  }

  async transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.client.$transaction(fn as any) as Promise<T>;
  }

  async createLoanPaymentInTx(
    tx: PrismaClient,
    data: {
      loanId: string;
      amount: number;
      notes?: string;
    },
  ): Promise<LoanPayment> {
    return tx.loanPayment.create({ data });
  }

  async findUniqueInTx(
    tx: PrismaClient,
    id: string,
  ): Promise<EmployeeLoan | null> {
    return tx.employeeLoan.findUnique({ where: { id } });
  }

  async updateInTx(
    tx: PrismaClient,
    id: string,
    data: { remainingAmount?: number; status?: "ACTIVE" | "PAID_OFF" },
  ): Promise<EmployeeLoan> {
    return tx.employeeLoan.update({ where: { id }, data });
  }

  async deleteLoanPaymentInTx(
    tx: PrismaClient,
    id: string,
  ): Promise<LoanPayment> {
    return tx.loanPayment.delete({ where: { id } });
  }
}

export class SalaryAttendanceRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAttendanceByUserAndPeriod(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Pick<Attendance, "status">[]> {
    return this.client.attendance.findMany({
      where: { userId, checkIn: { gte: startDate, lte: endDate } },
      select: { status: true },
    });
  }

  async findOvertimeByUserAndPeriod(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<
    {
      duration: number | null;
      isHolidayOvertime: boolean;
      isNationalHoliday: boolean;
    }[]
  > {
    return this.client.overtime.findMany({
      where: {
        userId,
        status: { in: ["APPROVED", "COMPLETED"] },
        OR: [
          { startTime: { gte: startDate, lte: endDate } },
          {
            AND: [
              { startTime: null },
              { createdAt: { gte: startDate, lte: endDate } },
            ],
          },
        ],
      },
      select: {
        duration: true,
        isHolidayOvertime: true,
        isNationalHoliday: true,
      },
    });
  }

  async countWorkOrdersByUserAndPeriod(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    return this.client.workOrders.count({
      where: {
        AND: [
          {
            OR: [
              { assignedToId: userId },
              {
                assignments: { some: { userId, status: { not: "REJECTED" } } },
              },
            ],
          },
          {
            OR: [
              { verifiedAt: { gte: startDate, lte: endDate } },
              {
                AND: [
                  { verifiedAt: null },
                  { closedAt: { gte: startDate, lte: endDate } },
                ],
              },
            ],
          },
        ],
        status: { in: ["VERIFIED", "CLOSED"] },
      },
    });
  }
}
