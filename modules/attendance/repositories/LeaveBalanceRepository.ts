import { prisma } from "@/lib/prisma";
import { LeaveType } from "@prisma/client";
import { randomUUID } from "crypto";

import type { ILeaveBalanceRepository } from "../domain/ports/ILeaveBalanceRepository";

export const DEFAULT_LEAVE_QUOTAS: Record<LeaveType, number> = {
  CUTI: 12,
  SAKIT: 6,
  IZIN: 6,
  LAINNYA: 3,
  TUKAR_LIBUR: 365,
};

type LeaveBalanceFilters = {
  departmentId?: string;
  siteId?: string;
  tenantId?: string;
};

export class LeaveBalanceRepository implements ILeaveBalanceRepository {
  /** Get leave balance for a specific user, year, and type. */
  async getBalance(
    userId: string,
    year: number,
    leaveType: LeaveType,
    tenantId?: string,
  ) {
    return prisma.leaveBalance.findFirst({
      where: { userId, year, leaveType, tenantId },
    });
  }

  /** Get all leave balances for a user in a specific year. */
  async getUserBalances(userId: string, year: number, tenantId?: string) {
    return prisma.leaveBalance.findMany({
      where: { userId, year, tenantId },
      orderBy: { leaveType: "asc" },
    });
  }

  /** Create or update leave balance quota. */
  async upsertQuota(
    userId: string,
    year: number,
    leaveType: LeaveType,
    quota: number,
    tenantId?: string,
  ) {
    const existing = await this.getBalance(userId, year, leaveType, tenantId);
    if (existing) {
      return prisma.leaveBalance.update({
        where: { id: existing.id },
        data: { quota, updatedAt: new Date() },
      });
    }

    return prisma.leaveBalance.create({
      data: this.buildCreateQuotaData({
        userId,
        year,
        leaveType,
        quota,
        tenantId,
      }),
    });
  }

  /** Initialize yearly balance for a user with default quotas. */
  async initializeYearlyBalance(
    userId: string,
    year: number,
    tenantId?: string,
  ) {
    const existingBalances = await this.getUserBalances(userId, year, tenantId);
    const existingTypes = new Set(
      existingBalances.map((balance) => balance.leaveType),
    );
    const missingQuotaEntries = this.getMissingQuotaEntries(existingTypes);

    return Promise.all(
      missingQuotaEntries.map(([type, quota]) =>
        this.upsertQuota(userId, year, type, quota, tenantId),
      ),
    );
  }

  /** Increment used leave days when leave is approved. */
  async incrementUsed(
    userId: string,
    year: number,
    leaveType: LeaveType,
    days: number,
    tenantId?: string,
  ) {
    const balance = await this.ensureBalance(userId, year, leaveType, tenantId);
    return this.updateUsedDays(balance.id, "increment", days);
  }

  /** Decrement used leave days when leave is cancelled or rejected. */
  async decrementUsed(
    userId: string,
    year: number,
    leaveType: LeaveType,
    days: number,
    tenantId?: string,
  ) {
    const balance = await this.getBalance(userId, year, leaveType, tenantId);
    if (!balance) return null;
    return this.updateUsedDays(balance.id, "decrement", days);
  }

  /** Get remaining days for a specific leave type. */
  async getRemainingDays(
    userId: string,
    year: number,
    leaveType: LeaveType,
    tenantId?: string,
  ): Promise<number> {
    const balance = await this.getBalance(userId, year, leaveType, tenantId);
    if (!balance) return DEFAULT_LEAVE_QUOTAS[leaveType];
    return Math.max(0, balance.quota - balance.used);
  }

  /** Check if user has enough leave days. */
  async hasEnoughDays(
    userId: string,
    year: number,
    leaveType: LeaveType,
    requiredDays: number,
    tenantId?: string,
  ): Promise<boolean> {
    const remaining = await this.getRemainingDays(
      userId,
      year,
      leaveType,
      tenantId,
    );
    return remaining >= requiredDays;
  }

  /** Get all balances with user info for admin view. */
  async getAllBalances(year: number, filters?: LeaveBalanceFilters) {
    return prisma.leaveBalance.findMany({
      where: this.buildAdminBalanceWhere(year, filters),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            departments: { select: { name: true } },
          },
        },
      },
      orderBy: [{ user: { name: "asc" } }, { leaveType: "asc" }],
    });
  }

  private buildCreateQuotaData(input: {
    userId: string;
    year: number;
    leaveType: LeaveType;
    quota: number;
    tenantId?: string;
  }) {
    return {
      id: randomUUID(),
      userId: input.userId,
      year: input.year,
      leaveType: input.leaveType,
      quota: input.quota,
      used: 0,
      updatedAt: new Date(),
      tenantId: input.tenantId,
    };
  }

  private getMissingQuotaEntries(existingTypes: Set<LeaveType>) {
    return (
      Object.entries(DEFAULT_LEAVE_QUOTAS) as Array<[LeaveType, number]>
    ).filter(([type]) => !existingTypes.has(type));
  }

  private async ensureBalance(
    userId: string,
    year: number,
    leaveType: LeaveType,
    tenantId?: string,
  ) {
    const existingBalance = await this.getBalance(
      userId,
      year,
      leaveType,
      tenantId,
    );
    if (existingBalance) return existingBalance;

    await this.upsertQuota(
      userId,
      year,
      leaveType,
      DEFAULT_LEAVE_QUOTAS[leaveType],
      tenantId,
    );

    const createdBalance = await this.getBalance(
      userId,
      year,
      leaveType,
      tenantId,
    );
    if (!createdBalance) throw new Error("Failed to create leave balance");
    return createdBalance;
  }

  private updateUsedDays(
    balanceId: string,
    operation: "increment" | "decrement",
    days: number,
  ) {
    return prisma.leaveBalance.update({
      where: { id: balanceId },
      data: {
        used: { [operation]: days },
        updatedAt: new Date(),
      },
    });
  }

  private buildAdminBalanceWhere(year: number, filters?: LeaveBalanceFilters) {
    const where: {
      year: number;
      tenantId?: string;
      user?: { departmentId?: string; siteId?: string };
    } = {
      year,
      tenantId: filters?.tenantId,
    };

    if (!filters?.departmentId && !filters?.siteId) return where;

    where.user = {
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.siteId ? { siteId: filters.siteId } : {}),
    };
    return where;
  }
}
