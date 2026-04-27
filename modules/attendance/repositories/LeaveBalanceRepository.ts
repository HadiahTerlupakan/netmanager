import { prisma } from "@/lib/prisma";
import { LeaveType } from "@prisma/client";
import { randomUUID } from "crypto";

import type { ILeaveBalanceRepository } from "../domain/ports/ILeaveBalanceRepository";

// Default quotas per leave type per year
export const DEFAULT_LEAVE_QUOTAS: Record<LeaveType, number> = {
  CUTI: 12,
  SAKIT: 6,
  IZIN: 6,
  LAINNYA: 3,
  TUKAR_LIBUR: 365, // Unlimited (max validation)
};

export class LeaveBalanceRepository implements ILeaveBalanceRepository {
  /**
   * Get leave balance for a specific user, year, and type
   */
  async getBalance(
    userId: string,
    year: number,
    leaveType: LeaveType,
    tenantId?: string,
  ) {
    return prisma.leaveBalance.findFirst({
      where: {
        userId,
        year,
        leaveType,
        tenantId,
      },
    });
  }

  /**
   * Get all leave balances for a user in a specific year
   */
  async getUserBalances(userId: string, year: number, tenantId?: string) {
    return prisma.leaveBalance.findMany({
      where: { userId, year, tenantId },
      orderBy: { leaveType: "asc" },
    });
  }

  /**
   * Create or update leave balance quota
   */
  async upsertQuota(
    userId: string,
    year: number,
    leaveType: LeaveType,
    quota: number,
    tenantId?: string,
  ) {
    const id = randomUUID();
    const existing = await this.getBalance(userId, year, leaveType, tenantId);

    if (existing) {
      return prisma.leaveBalance.update({
        where: { id: existing.id },
        data: {
          quota,
          updatedAt: new Date(),
        },
      });
    }

    return prisma.leaveBalance.create({
      data: {
        id,
        userId,
        year,
        leaveType,
        quota,
        used: 0,
        updatedAt: new Date(),
        tenantId,
      },
    });
  }

  /**
   * Initialize yearly balance for a user with default quotas
   */
  async initializeYearlyBalance(
    userId: string,
    year: number,
    tenantId?: string,
  ) {
    const existingBalances = await this.getUserBalances(userId, year, tenantId);
    const existingTypes = new Set(existingBalances.map((b) => b.leaveType));

    const createPromises = Object.entries(DEFAULT_LEAVE_QUOTAS)
      .filter(([type]) => !existingTypes.has(type as LeaveType))
      .map(([type, quota]) =>
        this.upsertQuota(userId, year, type as LeaveType, quota, tenantId),
      );

    return Promise.all(createPromises);
  }

  /**
   * Increment used leave days (when leave is approved)
   */
  async incrementUsed(
    userId: string,
    year: number,
    leaveType: LeaveType,
    days: number,
    tenantId?: string,
  ) {
    // First ensure balance exists
    const balance = await this.getBalance(userId, year, leaveType, tenantId);
    if (!balance) {
      await this.upsertQuota(
        userId,
        year,
        leaveType,
        DEFAULT_LEAVE_QUOTAS[leaveType],
        tenantId,
      );
      const newBalance = await this.getBalance(
        userId,
        year,
        leaveType,
        tenantId,
      );
      if (!newBalance) throw new Error("Failed to create leave balance");

      return prisma.leaveBalance.update({
        where: { id: newBalance.id },
        data: {
          used: { increment: days },
          updatedAt: new Date(),
        },
      });
    }

    return prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        used: { increment: days },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Decrement used leave days (when leave is cancelled/rejected after approval)
   */
  async decrementUsed(
    userId: string,
    year: number,
    leaveType: LeaveType,
    days: number,
    tenantId?: string,
  ) {
    const balance = await this.getBalance(userId, year, leaveType, tenantId);
    if (!balance) return null;

    return prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        used: { decrement: days },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get remaining days for a specific leave type
   */
  async getRemainingDays(
    userId: string,
    year: number,
    leaveType: LeaveType,
    tenantId?: string,
  ): Promise<number> {
    const balance = await this.getBalance(userId, year, leaveType, tenantId);
    if (!balance) {
      return DEFAULT_LEAVE_QUOTAS[leaveType];
    }
    return Math.max(0, balance.quota - balance.used);
  }

  /**
   * Check if user has enough leave days
   */
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

  /**
   * Get all balances with user info for admin view
   */
  async getAllBalances(
    year: number,
    filters?: { departmentId?: string; siteId?: string; tenantId?: string },
  ) {
    const where: {
      year: number;
      tenantId?: string;
      user?: { departmentId?: string; siteId?: string };
    } = {
      year,
      tenantId: filters?.tenantId,
    };

    if (filters?.departmentId || filters?.siteId) {
      where.user = {
        ...(filters.departmentId && { departmentId: filters.departmentId }),
        ...(filters.siteId && { siteId: filters.siteId }),
      };
    }

    return prisma.leaveBalance.findMany({
      where,
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
}
