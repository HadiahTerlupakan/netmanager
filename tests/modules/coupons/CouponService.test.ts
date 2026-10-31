import { describe, it, expect, beforeEach, vi } from "vitest";
import { CouponService } from "@/modules/coupons/services/CouponService";

// Create mock repository
const mockRepo = {
  findAll: vi.fn(),
  findByCode: vi.fn(),
  create: vi.fn(),
  recordUsage: vi.fn(),
  incrementUsage: vi.fn(),
};

// Mock CouponRepository
vi.mock("@/modules/coupons/repositories/CouponRepository", () => ({
  CouponRepository: class MockCouponRepository {
    findAll = mockRepo.findAll;
    findByCode = mockRepo.findByCode;
    create = mockRepo.create;
    recordUsage = mockRepo.recordUsage;
    incrementUsage = mockRepo.incrementUsage;
  },
}));

describe("CouponService", () => {
  let service: CouponService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CouponService(mockRepo as never);
  });

  describe("createCoupon", () => {
    it("should reject duplicate coupon code", async () => {
      mockRepo.findByCode.mockResolvedValueOnce({
        id: "coupon-1",
        code: "DISCOUNT10",
      });

      await expect(
        service.createCoupon({
          code: "DISCOUNT10",
          discountType: "FIXED",
          discountValue: 10000,
          startDate: new Date(),
          endDate: new Date(),
          minTransaction: 0,
          quota: 100,
          isActive: true,
        }),
      ).rejects.toThrow("Coupon code already exists");
    });

    it("should create coupon successfully", async () => {
      mockRepo.findByCode.mockResolvedValueOnce(null);
      mockRepo.create.mockResolvedValueOnce({
        id: "new-coupon",
        code: "NEWCODE",
        discountType: "FIXED",
        discountValue: 10000,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2026-04-30T00:00:00.000Z"),
        minTransaction: 0,
        quota: 100,
        usedCount: 0,
        isActive: true,
      });

      const result = await service.createCoupon({
        code: "NEWCODE",
        discountType: "FIXED",
        discountValue: 10000,
        startDate: new Date(),
        endDate: new Date(),
        minTransaction: 0,
        quota: 100,
        isActive: true,
      });

      expect(result).toBeDefined();
      expect(mockRepo.create).toHaveBeenCalled();
    });
  });

  describe("verifyCoupon", () => {
    it("should return invalid for empty code", async () => {
      const result = await service.verifyCoupon("", 100000);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Kode diperlukan");
    });

    it("should return invalid for non-existent coupon", async () => {
      mockRepo.findByCode.mockResolvedValueOnce(null);

      const result = await service.verifyCoupon("NOTFOUND", 100000);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Kupon tidak ditemukan");
    });

    it("should return invalid for inactive coupon", async () => {
      mockRepo.findByCode.mockResolvedValueOnce({
        id: "coupon-1",
        code: "INACTIVE",
        isActive: false,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
      });

      const result = await service.verifyCoupon("INACTIVE", 100000);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Kupon tidak aktif");
    });

    it("should return invalid for expired coupon", async () => {
      mockRepo.findByCode.mockResolvedValueOnce({
        id: "coupon-1",
        code: "EXPIRED",
        isActive: true,
        startDate: new Date("2020-01-01"),
        endDate: new Date("2020-12-31"), // Expired
      });

      const result = await service.verifyCoupon("EXPIRED", 100000);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Kupon kadaluarsa atau belum berlaku");
    });

    it("should return invalid when quota exhausted", async () => {
      mockRepo.findByCode.mockResolvedValueOnce({
        id: "coupon-1",
        code: "QUOTAFULL",
        isActive: true,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2030-12-31"),
        quota: 10,
        usedCount: 10, // Quota full
        minTransaction: 0,
      });

      const result = await service.verifyCoupon("QUOTAFULL", 100000);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Kuota kupon habis");
    });

    // Pelanggan yang mengganti metode bayar sudah memegang satu pemakaian
    // kupon ini di checkout lamanya; kupon berkuota satu dulu ditolak.
    describe("pemakaian yang sudah dipegang pelanggan", () => {
      const fullCoupon = () =>
        mockRepo.findByCode.mockResolvedValueOnce({
          id: "coupon-1",
          code: "SEKALI",
          isActive: true,
          startDate: new Date("2024-01-01"),
          endDate: new Date("2030-12-31"),
          quota: 1,
          usedCount: 1,
          minTransaction: 0,
          discountType: "FIXED",
          discountValue: 10000,
        });

      it("kupon yang sama tidak ditolak karena kuota", async () => {
        fullCoupon();

        const result = await service.verifyCoupon(
          "SEKALI",
          100000,
          "cust-1",
          "tenant-1",
          "coupon-1",
        );

        expect(result).toMatchObject({
          valid: true,
          discountAmount: 10000,
          couponId: "coupon-1",
        });
      });

      it("kupon lain tetap dibatasi kuotanya", async () => {
        fullCoupon();

        const result = await service.verifyCoupon(
          "SEKALI",
          100000,
          "cust-1",
          "tenant-1",
          "coupon-lain",
        );

        expect(result).toMatchObject({
          valid: false,
          error: "Kuota kupon habis",
        });
      });
    });

    it("should return invalid for transaction below minimum", async () => {
      mockRepo.findByCode.mockResolvedValueOnce({
        id: "coupon-1",
        code: "MINTRX",
        isActive: true,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2030-12-31"),
        quota: 0, // Unlimited
        usedCount: 0,
        minTransaction: 200000, // Min 200k
      });

      const result = await service.verifyCoupon("MINTRX", 100000); // Only 100k

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Minimal transaksi");
    });

    it("should calculate FIXED discount correctly", async () => {
      mockRepo.findByCode.mockResolvedValueOnce({
        id: "coupon-1",
        code: "FIXED50K",
        isActive: true,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2030-12-31"),
        quota: 0,
        usedCount: 0,
        minTransaction: 0,
        discountType: "FIXED",
        discountValue: 50000, // 50k off
      });

      const result = await service.verifyCoupon("FIXED50K", 200000);

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(50000);
      expect(result.finalAmount).toBe(150000); // 200k - 50k
    });

    it("should calculate PERCENTAGE discount with maxDiscount", async () => {
      mockRepo.findByCode.mockResolvedValueOnce({
        id: "coupon-1",
        code: "PERCENT20",
        isActive: true,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2030-12-31"),
        quota: 0,
        usedCount: 0,
        minTransaction: 0,
        discountType: "PERCENT",
        discountValue: 20, // 20%
        maxDiscount: 30000, // Max 30k
      });

      const result = await service.verifyCoupon("PERCENT20", 200000);
      // 20% of 200k = 40k, but max is 30k

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(30000); // Capped at maxDiscount
      expect(result.finalAmount).toBe(170000); // 200k - 30k
    });

    it("should cap discount at transaction amount", async () => {
      mockRepo.findByCode.mockResolvedValueOnce({
        id: "coupon-1",
        code: "BIGDISCOUNT",
        isActive: true,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2030-12-31"),
        quota: 0,
        usedCount: 0,
        minTransaction: 0,
        discountType: "FIXED",
        discountValue: 100000, // 100k off (more than amount)
      });

      const result = await service.verifyCoupon("BIGDISCOUNT", 50000); // Only 50k

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(50000); // Capped at amount
      expect(result.finalAmount).toBe(0);
    });
  });
});
