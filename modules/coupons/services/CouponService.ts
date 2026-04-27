import type {
  CouponDetailDTO,
  CouponListItemDTO,
  CreateCouponInput,
} from "../dto/CouponDTO";
import type {
  ICouponRepository,
  VerifyCouponResult,
} from "../domain/ports/ICouponRepository";
import type { CouponEntity } from "../domain/entities/CouponEntity";
import { CouponMapper } from "../mappers/CouponMapper";

const EMPTY_DISCOUNT = 0;
const EMPTY_FINAL_AMOUNT = 0;
const INVALID_COUPON_CODE_MESSAGE = "Coupon code already exists";
const COUPON_NOT_FOUND_MESSAGE = "Coupon not found";
const USED_COUPON_DELETE_MESSAGE = "Cannot delete coupon that has been used";
const REQUIRED_CODE_MESSAGE = "Kode diperlukan";
const MISSING_COUPON_MESSAGE = "Kupon tidak ditemukan";
const INACTIVE_COUPON_MESSAGE = "Kupon tidak aktif";
const INVALID_DATE_RANGE_MESSAGE = "Kupon kadaluarsa atau belum berlaku";
const EXHAUSTED_QUOTA_MESSAGE = "Kuota kupon habis";
const FIXED_DISCOUNT_TYPE = "FIXED";

/**
 * Service for coupon business operations.
 */
export class CouponService {
  private readonly repository: ICouponRepository;

  constructor(repository: ICouponRepository) {
    this.repository = repository;
  }

  /**
   * Get all coupons as DTO list.
   */
  async getAllCoupons(): Promise<{
    items: CouponListItemDTO[];
    total: number;
  }> {
    const result = await this.repository.findAll();
    return { items: CouponMapper.toDTOList(result.items), total: result.total };
  }

  /**
   * Create a new coupon.
   */
  async createCoupon(data: CreateCouponInput): Promise<CouponListItemDTO> {
    await this.ensureCouponCodeIsUnique(data.code);
    const coupon = await this.repository.create(data);
    return CouponMapper.toDTO(coupon);
  }

  /**
   * Verify coupon against transaction amount.
   */
  async verifyCoupon(
    code: string,
    amount: number,
    _pelangganId?: string,
  ): Promise<VerifyCouponResult> {
    if (!code) {
      return this.createInvalidResult(REQUIRED_CODE_MESSAGE, amount);
    }

    const coupon = await this.repository.findByCode(code.toUpperCase());
    if (!coupon) {
      return this.createInvalidResult(MISSING_COUPON_MESSAGE, amount);
    }

    return this.buildVerificationResult(coupon, amount);
  }

  /**
   * Record coupon usage history.
   */
  async recordUsage(couponId: string, pelangganId: string, tx?: unknown) {
    return this.repository.recordUsage(couponId, pelangganId, tx);
  }

  /**
   * Increment coupon usage count.
   */
  async incrementUsage(couponId: string, tx?: unknown) {
    return this.repository.incrementUsage(couponId, tx);
  }

  /**
   * Delete coupon when safe.
   */
  async deleteCoupon(id: string): Promise<void> {
    const coupon = await this.repository.findById(id);
    if (!coupon) {
      throw new Error(COUPON_NOT_FOUND_MESSAGE);
    }
    if (coupon.usedCount > 0) {
      throw new Error(USED_COUPON_DELETE_MESSAGE);
    }
    await this.repository.delete(id);
  }

  /**
   * Get coupon detail by id.
   */
  async getCouponById(id: string): Promise<CouponDetailDTO | null> {
    const coupon = await this.repository.findById(id);
    return coupon ? CouponMapper.toDetailDTO(coupon) : null;
  }

  /**
   * Ensure coupon code does not already exist.
   */
  private async ensureCouponCodeIsUnique(code: string): Promise<void> {
    const existingCoupon = await this.repository.findByCode(code);
    if (existingCoupon) {
      throw new Error(INVALID_COUPON_CODE_MESSAGE);
    }
  }

  /**
   * Build coupon verification result.
   */
  private buildVerificationResult(
    coupon: CouponEntity,
    amount: number,
  ): VerifyCouponResult {
    const error = this.getCouponValidationError(coupon, amount);
    if (error) {
      return this.createInvalidResult(error, amount);
    }

    const discountAmount = this.calculateRoundedDiscount(coupon, amount);
    return {
      valid: true,
      discountAmount,
      finalAmount: Math.floor(amount - discountAmount),
      couponId: coupon.id,
    };
  }

  /**
   * Get validation error for coupon applicability.
   */
  private getCouponValidationError(
    coupon: CouponEntity,
    amount: number,
  ): string | null {
    if (!coupon.isActive) {
      return INACTIVE_COUPON_MESSAGE;
    }
    if (this.isCouponOutsideActivePeriod(coupon)) {
      return INVALID_DATE_RANGE_MESSAGE;
    }
    if (this.isQuotaExhausted(coupon)) {
      return EXHAUSTED_QUOTA_MESSAGE;
    }
    if (amount < coupon.minTransaction) {
      return this.createMinTransactionMessage(coupon.minTransaction);
    }
    return null;
  }

  /**
   * Check whether coupon is outside active period.
   */
  private isCouponOutsideActivePeriod(coupon: CouponEntity): boolean {
    const now = new Date();
    return now < coupon.startDate || now > coupon.endDate;
  }

  /**
   * Check whether coupon quota is exhausted.
   */
  private isQuotaExhausted(coupon: CouponEntity): boolean {
    return coupon.quota > 0 && coupon.usedCount >= coupon.quota;
  }

  /**
   * Create minimum transaction validation message.
   */
  private createMinTransactionMessage(minTransaction: number): string {
    return `Minimal transaksi Rp ${minTransaction.toLocaleString("id-ID")}`;
  }

  /**
   * Calculate rounded discount amount.
   */
  private calculateRoundedDiscount(
    coupon: CouponEntity,
    amount: number,
  ): number {
    const rawDiscount = this.calculateDiscount(coupon, amount);
    const limitedDiscount = Math.min(rawDiscount, amount);
    return Math.floor(limitedDiscount);
  }

  /**
   * Calculate raw discount amount.
   */
  private calculateDiscount(coupon: CouponEntity, amount: number): number {
    if (coupon.discountType === FIXED_DISCOUNT_TYPE) {
      return coupon.discountValue;
    }

    const percentageDiscount = (amount * coupon.discountValue) / 100;
    if (!coupon.maxDiscount) {
      return percentageDiscount;
    }

    return Math.min(percentageDiscount, coupon.maxDiscount);
  }

  /**
   * Create invalid coupon verification result.
   */
  private createInvalidResult(
    error: string,
    amount: number,
  ): VerifyCouponResult {
    return {
      valid: false,
      error,
      discountAmount: EMPTY_DISCOUNT,
      finalAmount: Math.max(EMPTY_FINAL_AMOUNT, Math.floor(amount)),
    };
  }
}
