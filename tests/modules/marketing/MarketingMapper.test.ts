import { describe, it, expect } from "vitest";
import { MarketingMapper } from "@/modules/marketing/mappers/MarketingMapper";
import type { CanvasingEntity } from "@/modules/marketing/domain/entities/CanvasingEntity";
import type { PointClaimReferenceEntity } from "@/modules/marketing/domain/entities/CanvasingEntity";

describe("MarketingMapper", () => {
  describe("toCanvasingDetailDTO", () => {
    it("should map canvasing entity to DTO with pointClaims field", () => {
      const mockPointClaim: PointClaimReferenceEntity = {
        id: "claim-1",
        status: "PENDING",
        buktiUrls: [
          "https://example.com/bukti1.jpg",
          "https://example.com/bukti2.jpg",
        ],
        keterangan: "Instalasi selesai dengan baik",
        pointValue: 2,
        reviewNotes: null,
        reviewedByName: null,
        reviewedAt: null,
        createdAt: new Date("2026-05-09T10:00:00Z"),
      };

      const mockCanvasing: CanvasingEntity = {
        id: "canv-1",
        nama: "John Doe",
        noKtp: "1234567890123456",
        noTelpon: "081234567890",
        email: "john@example.com",
        alamat: "Jl. Test No. 123",
        kabel: 100,
        odp: "ODP-001",
        paket: "50 Mbps",
        sn: "SN123456",
        latitude: -6.2088,
        longitude: 106.8456,
        shareloc: null,
        foto: "/uploads/foto.jpg",
        fotoKtp: "/uploads/ktp.jpg",
        status: "APPROVED",
        isLocked: false,
        salesId: "sales-1",
        mitraId: null,
        approvedBy: "admin-1",
        approvedAt: new Date("2026-05-09T09:00:00Z"),
        workOrderId: "wo-1",
        createdAt: new Date("2026-05-09T08:00:00Z"),
        updatedAt: new Date("2026-05-09T09:00:00Z"),
        user: {
          id: "sales-1",
          name: "Sales User",
          email: "sales@example.com",
          siteId: "site-1",
        },
        approver: {
          id: "admin-1",
          name: "Admin User",
        },
        mitra: null,
        pointClaim: mockPointClaim,
      };

      const result = MarketingMapper.toCanvasingDetailDTO(mockCanvasing);

      // Verify pointClaims field exists (plural)
      expect(result).toHaveProperty("pointClaims");
      expect(result.pointClaims).toBeDefined();
      expect(result.pointClaims).not.toBeNull();

      // Verify pointClaims content
      expect(result.pointClaims?.id).toBe("claim-1");
      expect(result.pointClaims?.canvasingId).toBe("canv-1");
      expect(result.pointClaims?.salesId).toBe("sales-1");
      expect(result.pointClaims?.buktiUrls).toEqual([
        "https://example.com/bukti1.jpg",
        "https://example.com/bukti2.jpg",
      ]);
      expect(result.pointClaims?.keterangan).toBe(
        "Instalasi selesai dengan baik",
      );
      expect(result.pointClaims?.status).toBe("PENDING");
      expect(result.pointClaims?.points).toBe(2);
      expect(result.pointClaims?.createdAt).toBe("2026-05-09T10:00:00.000Z");
    });

    it("should map canvasing entity without pointClaim to DTO with null pointClaims", () => {
      const mockCanvasing: CanvasingEntity = {
        id: "canv-2",
        nama: "Jane Doe",
        noKtp: "9876543210987654",
        noTelpon: "089876543210",
        email: null,
        alamat: "Jl. Test No. 456",
        kabel: 50,
        odp: null,
        paket: "100 Mbps",
        sn: null,
        latitude: null,
        longitude: null,
        shareloc: null,
        foto: null,
        fotoKtp: null,
        status: "PENDING",
        isLocked: false,
        salesId: "sales-2",
        mitraId: null,
        approvedBy: null,
        approvedAt: null,
        workOrderId: null,
        createdAt: new Date("2026-05-09T08:00:00Z"),
        updatedAt: new Date("2026-05-09T08:00:00Z"),
        user: {
          id: "sales-2",
          name: "Sales User 2",
          email: "sales2@example.com",
          siteId: "site-1",
        },
        approver: null,
        mitra: null,
        pointClaim: null,
      };

      const result = MarketingMapper.toCanvasingDetailDTO(mockCanvasing);

      // Verify pointClaims field exists but is null
      expect(result).toHaveProperty("pointClaims");
      expect(result.pointClaims).toBeNull();
    });

    it("should map approved pointClaim with review info correctly", () => {
      const mockPointClaim: PointClaimReferenceEntity = {
        id: "claim-2",
        status: "APPROVED",
        buktiUrls: ["https://example.com/bukti.jpg"],
        keterangan: "Semua sesuai prosedur",
        pointValue: 2,
        reviewNotes: "Approved by admin",
        reviewedByName: "Admin User",
        reviewedAt: new Date("2026-05-09T12:00:00Z"),
        createdAt: new Date("2026-05-09T11:00:00Z"),
      };

      const mockCanvasing: CanvasingEntity = {
        id: "canv-3",
        nama: "Test User",
        noKtp: "1111111111111111",
        noTelpon: "081111111111",
        email: null,
        alamat: "Jl. Test",
        kabel: 75,
        odp: null,
        paket: "75 Mbps",
        sn: null,
        latitude: null,
        longitude: null,
        shareloc: null,
        foto: null,
        fotoKtp: null,
        status: "APPROVED",
        isLocked: true,
        salesId: "sales-3",
        mitraId: null,
        approvedBy: "admin-1",
        approvedAt: new Date("2026-05-09T10:00:00Z"),
        workOrderId: "wo-3",
        createdAt: new Date("2026-05-09T09:00:00Z"),
        updatedAt: new Date("2026-05-09T12:00:00Z"),
        user: {
          id: "sales-3",
          name: "Sales User 3",
          email: "sales3@example.com",
          siteId: "site-1",
        },
        approver: {
          id: "admin-1",
          name: "Admin User",
        },
        mitra: null,
        pointClaim: mockPointClaim,
      };

      const result = MarketingMapper.toCanvasingDetailDTO(mockCanvasing);

      expect(result.pointClaims).toBeDefined();
      expect(result.pointClaims?.status).toBe("APPROVED");
      expect(result.pointClaims?.processedAt).toBe("2026-05-09T12:00:00.000Z");
    });
  });
});
