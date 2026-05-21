import type { CouponEntity, CouponUsageEntity } from "../entities/CouponEntity";
import type { CreateCouponInput, UpdateCouponInput } from "../../dto/CouponDTO";

/**
 * Result for coupon verification.
 */
export interface VerifyCouponResult {
  valid: boolean;
  error?: string;
  discountAmount: number;
  finalAmount: number;
  couponId?: string;
}

/**
 * Repository port for coupon persistence.
 */
export interface ICouponRepository {
  findAll(params?: {
    skip?: number;
    take?: number;
    tenantId?: string | null;
  }): Promise<{ items: CouponEntity[]; total: number }>;

  findById(id: string): Promise<CouponEntity | null>;

  findByCode(
    code: string,
    tenantId?: string | null,
  ): Promise<CouponEntity | null>;

  create(
    data: CreateCouponInput & { tenantId?: string | null },
  ): Promise<CouponEntity>;

  update(id: string, data: UpdateCouponInput): Promise<CouponEntity>;

  incrementUsage(id: string, tx?: unknown): Promise<CouponEntity>;

  recordUsage(
    couponId: string,
    pelangganId: string,
    tx?: unknown,
  ): Promise<CouponUsageEntity>;

  delete(id: string): Promise<void>;
}
