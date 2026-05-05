import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";
import { SalaryUserMapper } from "../mappers/SalaryUserMapper";
import type {
  ISalaryUserRepository,
  SalaryUserFilters,
  UpdateSalaryUserConfigInput,
} from "../domain/ports/ISalaryUserRepository";
import type {
  SalaryUserConfigEntity,
  SalaryUserDetailEntity,
  SalaryUserListEntity,
  SalaryUserWorkDaysEntity,
} from "../domain/entities/SalaryUserEntity";

export type { SalaryUserConfigEntity as UserSalaryConfig };

export class SalaryUserRepository implements ISalaryUserRepository {
  constructor(private client: PrismaClient = prisma) {}

  /** Get salary user list with detailed payroll configuration. */
  async findSalaryUsers(): Promise<SalaryUserListEntity[]> {
    const users = await this.client.user.findMany({
      where: { basicSalary: { not: null }, isActive: true },
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
        departments: { select: { name: true } },
        role: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    return users.map((user) => SalaryUserMapper.toListEntity(user));
  }

  /** Get all active users for salary onboarding list. */
  async findAllActiveUsersForSalaryList(): Promise<SalaryUserListEntity[]> {
    const users = await this.client.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        employeeType: true,
        basicSalary: true,
      },
      orderBy: { name: "asc" },
    });

    return users.map((user) => SalaryUserMapper.toListEntity(user));
  }

  /** Get salary user detail by ID. */
  async findSalaryUserById(
    userId: string,
  ): Promise<SalaryUserDetailEntity | null> {
    const user = await this.client.user.findUnique({
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
        departments: { select: { name: true } },
        userSalaryComponents: {
          where: { isActive: true },
          include: { component: true },
          orderBy: { component: { type: "asc" } },
        },
      },
    });

    return user ? SalaryUserMapper.toDetailEntity(user) : null;
  }

  /** Update salary-related user configuration. */
  async updateSalaryConfig(
    userId: string,
    data: UpdateSalaryUserConfigInput,
  ): Promise<void> {
    await this.client.user.update({
      where: { id: userId },
      data: data as Prisma.UserUpdateInput,
    });
  }

  /** Get salary configuration by user ID. */
  async findSalaryConfigById(
    userId: string,
  ): Promise<SalaryUserConfigEntity | null> {
    const user = await this.client.user.findUnique({
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
    });

    return user ? SalaryUserMapper.toConfigEntity(user) : null;
  }

  /** Get active users with salary configuration. */
  async findManyActiveWithSalaryConfig(
    filters?: SalaryUserFilters,
  ): Promise<SalaryUserConfigEntity[]> {
    const users = await this.client.user.findMany({
      where: {
        isActive: true,
        basicSalary: { not: null },
        ...(filters?.departmentId
          ? { departmentId: filters.departmentId }
          : {}),
        ...(filters?.siteId ? { siteId: filters.siteId } : {}),
        ...(filters?.employeeType
          ? {
              employeeType:
                filters.employeeType as Prisma.UserWhereInput["employeeType"],
            }
          : {}),
      },
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
    });

    return users.map((user) => SalaryUserMapper.toConfigEntity(user));
  }

  /** Get work day configuration for one user. */
  async findWorkDaysConfig(
    userId: string,
  ): Promise<SalaryUserWorkDaysEntity | null> {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      select: { workDays: true },
    });

    return user ? SalaryUserMapper.toWorkDaysEntity(user) : null;
  }
}

export class EmployeeLoanRepository {
  constructor(private client: PrismaClient = prisma) {}

  /** Get active employee loans by user ID. */
  async findActiveByUserId(userId: string) {
    return this.client.employeeLoan.findMany({
      where: { userId, status: "ACTIVE" },
    });
  }

  /** Update remaining amount and status for a loan. */
  async updateRemainingAmount(
    id: string,
    remainingAmount: number,
    status: string,
  ) {
    return this.client.employeeLoan.update({
      where: { id },
      data: { remainingAmount, status: status as "ACTIVE" | "PAID_OFF" },
    });
  }

  /** Find loan by ID. */
  async findLoanById(id: string) {
    return this.client.employeeLoan.findUnique({ where: { id } });
  }

  /** Run transaction callback with Prisma client. */
  async transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.client.$transaction(fn as any) as Promise<T>;
  }

  /** Create loan payment inside transaction. */
  async createLoanPaymentInTx(
    tx: PrismaClient,
    data: { loanId: string; amount: number; notes?: string },
  ) {
    return tx.loanPayment.create({ data });
  }

  /** Find loan by ID inside transaction. */
  async findUniqueInTx(tx: PrismaClient, id: string) {
    return tx.employeeLoan.findUnique({ where: { id } });
  }

  /** Update loan inside transaction. */
  async updateInTx(
    tx: PrismaClient,
    id: string,
    data: { remainingAmount?: number; status?: "ACTIVE" | "PAID_OFF" },
  ) {
    return tx.employeeLoan.update({ where: { id }, data });
  }

  /** Delete loan payment inside transaction. */
  async deleteLoanPaymentInTx(tx: PrismaClient, id: string) {
    return tx.loanPayment.delete({ where: { id } });
  }
}
