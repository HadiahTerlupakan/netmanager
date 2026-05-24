import type {
  ApprovalThreshold,
  ApprovalThresholdScope,
} from "../domain/entities/ApprovalThreshold";
import type {
  ApprovalThresholdCreateInput,
  ApprovalThresholdListFilter,
  ApprovalThresholdUpdateInput,
  ApprovalThresholdWithRole,
  IApprovalThresholdRepository,
} from "../domain/ports/IApprovalThresholdRepository";
import { ApprovalThresholdRepository } from "../repositories/ApprovalThresholdRepository";

export class ApprovalThresholdNotFoundError extends Error {
  constructor(id: string) {
    super(`Approval Threshold ${id} tidak ditemukan`);
    this.name = "ApprovalThresholdNotFoundError";
  }
}

export class ApprovalThresholdInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalThresholdInvalidError";
  }
}

/**
 * Dilempar oleh use case yang memanggil `assertCanApprove`. Pesan default
 * mencakup nominal yang ditolak supaya UI bisa langsung tampilkan ke user.
 */
export class ApprovalThresholdExceededError extends Error {
  constructor(
    public readonly scope: ApprovalThresholdScope,
    public readonly amount: number,
  ) {
    super(`Role Anda tidak punya wewenang approve ${scope} senilai ${amount}`);
    this.name = "ApprovalThresholdExceededError";
  }
}

/**
 * Service approval threshold:
 * - CRUD aturan threshold (untuk admin)
 * - Guard `assertCanApprove(roleIds, scope, amount)` yang dipanggil flow PR/PO
 *   sebelum melakukan transisi APPROVED.
 *
 * Aturan validasi domain saat create/update:
 * - `maxAmount === null` artinya unlimited (untuk role tertinggi).
 * - `maxAmount` (kalau diset) wajib >= `minAmount`.
 * - Range overlap antar threshold per (scope, role) tidak dilarang sekarang
 *   — admin yang bertanggung jawab; cukup tampilkan list-nya rapi di UI.
 */
export class ApprovalThresholdService {
  constructor(
    private readonly repo: IApprovalThresholdRepository = new ApprovalThresholdRepository(),
  ) {}

  list(
    filter: ApprovalThresholdListFilter,
  ): Promise<ApprovalThresholdWithRole[]> {
    return this.repo.list(filter);
  }

  async create(
    input: ApprovalThresholdCreateInput,
  ): Promise<ApprovalThreshold> {
    this.assertRangeValid(input.minAmount, input.maxAmount);
    return this.repo.create(input);
  }

  async update(
    id: string,
    input: ApprovalThresholdUpdateInput,
  ): Promise<ApprovalThreshold> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ApprovalThresholdNotFoundError(id);
    const nextMin = input.minAmount ?? existing.minAmount;
    const nextMax =
      input.maxAmount !== undefined ? input.maxAmount : existing.maxAmount;
    this.assertRangeValid(nextMin, nextMax);
    return this.repo.update(id, input);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ApprovalThresholdNotFoundError(id);
    await this.repo.delete(id);
  }

  /**
   * Guard utama: lempar `ApprovalThresholdExceededError` kalau tidak ada
   * threshold aktif yang cover `amount` untuk salah satu `roleIds` yang
   * dimiliki user. Kalau tidak ada threshold sama sekali untuk scope ini di
   * tenant, anggap belum dikonfigurasi → izinkan (backward compat).
   */
  async assertCanApprove(input: {
    tenantId: string | null;
    scope: ApprovalThresholdScope;
    amount: number;
    roleIds: string[];
  }): Promise<void> {
    const anyConfigured = await this.repo.list({
      tenantId: input.tenantId,
      scope: input.scope,
      isActive: true,
    });
    if (anyConfigured.length === 0) return;

    const covering = await this.repo.findCoveringThreshold(input);
    if (!covering) {
      throw new ApprovalThresholdExceededError(input.scope, input.amount);
    }
  }

  private assertRangeValid(min: number, max: number | null): void {
    if (min < 0) {
      throw new ApprovalThresholdInvalidError("minAmount tidak boleh negatif");
    }
    if (max !== null && max < min) {
      throw new ApprovalThresholdInvalidError(
        "maxAmount tidak boleh lebih kecil dari minAmount",
      );
    }
  }
}
