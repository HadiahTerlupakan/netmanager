import { LeaveType } from "@prisma/client";
import { UserLookupService } from "@/modules/users";
import {
  DEFAULT_LEAVE_QUOTAS,
  LeaveBalanceRepository,
} from "../repositories/LeaveBalanceRepository";

const DEFAULT_YEAR_OFFSET = 0;

interface LeaveBalanceAccessContext {
  requesterTenantId?: string | null;
  isSuperAdmin: boolean;
}

interface LeaveBalanceListInput {
  year: number;
  userId?: string | null;
  access: LeaveBalanceAccessContext;
}

interface LeaveQuotaUpdateInput {
  userId: string;
  year?: number;
  quotas: Partial<Record<LeaveType, number>>;
  access: LeaveBalanceAccessContext;
}

export class AdminLeaveBalanceRouteService {
  constructor(
    private readonly leaveBalanceRepository = new LeaveBalanceRepository(),
    private readonly userRepository = new UserLookupService(),
  ) {}

  /** Pastikan user target berada dalam scope tenant requester. */
  async canAccessUser(userId: string, access: LeaveBalanceAccessContext) {
    if (access.isSuperAdmin) return true;
    const targetUser = await this.userRepository.findById(userId);
    return Boolean(
      targetUser && targetUser.tenantId === access.requesterTenantId,
    );
  }

  /** Ambil saldo cuti user tertentu atau seluruh user sesuai scope tenant. */
  async getBalances(input: LeaveBalanceListInput) {
    const tenantId = this.resolveTenantId(input.access);
    if (!input.userId) return this.getAllBalances(input.year, tenantId);
    return this.getUserBalances(input.userId, input.year, tenantId);
  }

  /** Perbarui kuota cuti user dan kembalikan saldo terbaru. */
  async updateQuota(input: LeaveQuotaUpdateInput) {
    const targetYear = input.year || this.getCurrentYear();
    const tenantId = this.resolveTenantId(input.access);
    await this.upsertQuotas(input.userId, targetYear, input.quotas, tenantId);
    const balances = await this.leaveBalanceRepository.getUserBalances(
      input.userId,
      targetYear,
      tenantId,
    );
    return { balances };
  }

  /** Inisialisasi kuota cuti bawaan untuk user baru. */
  async initializeUserQuotas(
    userId: string,
    quotas: Partial<Record<LeaveType, number>>,
    tenantId?: string | null,
  ) {
    const targetYear = this.getCurrentYear();
    await this.upsertQuotas(userId, targetYear, quotas, tenantId);
  }

  /** Ambil saldo cuti user dan lengkapi tipe yang belum ada. */
  private async getUserBalances(
    userId: string,
    year: number,
    tenantId?: string | null,
  ) {
    const balances = await this.leaveBalanceRepository.getUserBalances(
      userId,
      year,
      tenantId,
    );
    return { balances: this.fillMissingBalances(balances), year };
  }

  /** Ambil seluruh saldo cuti untuk dashboard admin. */
  private async getAllBalances(year: number, tenantId?: string | null) {
    const balances = await this.leaveBalanceRepository.getAllBalances(year, {
      tenantId: tenantId || undefined,
    });
    return { balances, year };
  }

  /** Simpan seluruh kuota yang diberikan ke repository. */
  private async upsertQuotas(
    userId: string,
    year: number,
    quotas: Partial<Record<LeaveType, number>>,
    tenantId?: string | null,
  ) {
    const entries = Object.entries(quotas) as Array<[LeaveType, number]>;
    await Promise.all(
      entries.map(([type, quota]) =>
        this.leaveBalanceRepository.upsertQuota(
          userId,
          year,
          type,
          quota,
          tenantId,
        ),
      ),
    );
  }

  /** Lengkapi saldo yang belum ada dengan kuota default. */
  private fillMissingBalances(
    balances: Awaited<ReturnType<LeaveBalanceRepository["getUserBalances"]>>,
  ) {
    const types = Object.keys(DEFAULT_LEAVE_QUOTAS) as LeaveType[];
    return types.map((type) => this.buildBalance(type, balances));
  }

  /** Bentuk saldo final untuk satu tipe cuti. */
  private buildBalance(
    type: LeaveType,
    balances: Awaited<ReturnType<LeaveBalanceRepository["getUserBalances"]>>,
  ) {
    const existingBalance = balances.find(
      (balance) => balance.leaveType === type,
    );
    if (existingBalance)
      return {
        ...existingBalance,
        remaining: existingBalance.quota - existingBalance.used,
      };
    return {
      leaveType: type,
      quota: DEFAULT_LEAVE_QUOTAS[type],
      used: DEFAULT_YEAR_OFFSET,
      remaining: DEFAULT_LEAVE_QUOTAS[type],
    };
  }

  /** Tentukan tenant scope untuk admin non super. */
  private resolveTenantId(access: LeaveBalanceAccessContext) {
    if (access.isSuperAdmin) return undefined;
    return access.requesterTenantId || undefined;
  }

  /** Ambil tahun saat ini untuk default operasi quota. */
  private getCurrentYear() {
    return new Date().getFullYear();
  }
}
