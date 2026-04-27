import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShiftService } from "@/modules/shift/services/ShiftService";
import type { IShiftRepository } from "@/modules/shift/domain/ports/IShiftRepository";
import type { ShiftEntity } from "@/modules/shift/domain/entities/ShiftEntity";

const createShiftEntity = (
  overrides: Partial<ShiftEntity> = {},
): ShiftEntity => ({
  id: "shift-1",
  name: "Morning Shift",
  code: "S1",
  startTime: "08:00",
  endTime: "16:00",
  description: "Regular morning shift",
  isActive: true,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  tenantId: "tenant-1",
  users: [],
  userCount: 0,
  ...overrides,
});

const mockShiftRepo: IShiftRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  hardDelete: vi.fn(),
  getUserCount: vi.fn(),
};

describe("ShiftService", () => {
  let service: ShiftService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ShiftService(mockShiftRepo);
  });

  describe("createShift", () => {
    const input = {
      name: "Morning Shift",
      code: "S1",
      startTime: "08:00",
      endTime: "16:00",
      description: "Regular morning shift",
    };

    it("should create a shift successfully", async () => {
      const tenantId = "tenant-1";
      vi.mocked(mockShiftRepo.findByCode).mockResolvedValue(null);
      vi.mocked(mockShiftRepo.create).mockResolvedValue(createShiftEntity());

      const result = await service.createShift(tenantId, input);

      expect(result).toEqual(
        expect.objectContaining({
          ...input,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          users: [],
          isActive: true,
        }),
      );
      expect(mockShiftRepo.create).toHaveBeenCalledWith(tenantId, input);
    });

    it("should throw error for invalid start time format", async () => {
      await expect(
        service.createShift("tenant-1", { ...input, startTime: "8:00" }),
      ).rejects.toThrow("Invalid start time format");
    });

    it("should throw error for invalid end time format", async () => {
      await expect(
        service.createShift("tenant-1", { ...input, endTime: "25:00" }),
      ).rejects.toThrow("Invalid end time format");
    });

    it("should throw error if code already exists", async () => {
      const tenantId = "tenant-1";
      vi.mocked(mockShiftRepo.findByCode).mockResolvedValue(
        createShiftEntity(),
      );

      await expect(service.createShift(tenantId, input)).rejects.toThrow(
        "Shift code already exists",
      );
    });
  });

  describe("updateShift", () => {
    const existingShift = createShiftEntity();

    it("should update shift successfully", async () => {
      const tenantId = "tenant-1";
      vi.mocked(mockShiftRepo.findById).mockResolvedValue(existingShift);
      vi.mocked(mockShiftRepo.findByCode).mockResolvedValue(null);
      vi.mocked(mockShiftRepo.update).mockResolvedValue(
        createShiftEntity({ name: "Updated Name" }),
      );

      const result = await service.updateShift(tenantId, "shift-1", {
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
      expect(mockShiftRepo.update).toHaveBeenCalledWith(tenantId, "shift-1", {
        name: "Updated Name",
      });
    });

    it("should throw error if shift not found", async () => {
      vi.mocked(mockShiftRepo.findById).mockResolvedValue(null);

      await expect(
        service.updateShift("tenant-1", "invalid", { name: "New" }),
      ).rejects.toThrow("Shift not found");
    });

    it("should throw error if new code exists", async () => {
      const tenantId = "tenant-1";
      vi.mocked(mockShiftRepo.findById).mockResolvedValue(existingShift);
      vi.mocked(mockShiftRepo.findByCode).mockResolvedValue(
        createShiftEntity({ id: "other", code: "S2" }),
      );

      await expect(
        service.updateShift(tenantId, "shift-1", { code: "S2" }),
      ).rejects.toThrow("Shift code already exists");
    });
  });

  describe("deleteShift", () => {
    it("should soft delete when force is true", async () => {
      const tenantId = "tenant-1";
      vi.mocked(mockShiftRepo.findById).mockResolvedValue(createShiftEntity());
      vi.mocked(mockShiftRepo.getUserCount).mockResolvedValue(0);

      await service.deleteShift(tenantId, "shift-1", true);

      expect(mockShiftRepo.delete).toHaveBeenCalledWith(tenantId, "shift-1");
    });

    it("should hard delete if not forced and no users", async () => {
      const tenantId = "tenant-1";
      vi.mocked(mockShiftRepo.findById).mockResolvedValue(createShiftEntity());
      vi.mocked(mockShiftRepo.getUserCount).mockResolvedValue(0);

      await service.deleteShift(tenantId, "shift-1", false);

      expect(mockShiftRepo.hardDelete).toHaveBeenCalledWith(
        tenantId,
        "shift-1",
      );
    });

    it("should throw error if assigned to users and not forced", async () => {
      const tenantId = "tenant-1";
      vi.mocked(mockShiftRepo.findById).mockResolvedValue(createShiftEntity());
      vi.mocked(mockShiftRepo.getUserCount).mockResolvedValue(5);

      await expect(
        service.deleteShift(tenantId, "shift-1", false),
      ).rejects.toThrow("Cannot delete shift");
    });
  });
});
