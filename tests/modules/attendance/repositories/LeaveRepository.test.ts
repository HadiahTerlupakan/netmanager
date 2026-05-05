import { describe, it, expect, beforeEach, vi } from "vitest";
import { LeaveRepository } from "@/modules/attendance/repositories/LeaveRepository";

const mockLeaveLookupRepository = {
  getUserLeaveStats: vi.fn(),
  findActiveLeaveForUserOnDate: vi.fn(),
};

const mockLeaveMobileRepository = {
  findRequesterContext: vi.fn(),
  findApproverIdsForMobileLeaveNotification: vi.fn(),
};

const mockLeaveRequestRepository = {
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  count: vi.fn(),
};

vi.mock("@/modules/attendance/repositories/LeaveLookupRepository", () => ({
  LeaveLookupRepository: class {
    getUserLeaveStats = mockLeaveLookupRepository.getUserLeaveStats;
    findActiveLeaveForUserOnDate =
      mockLeaveLookupRepository.findActiveLeaveForUserOnDate;
  },
}));

vi.mock("@/modules/attendance/repositories/LeaveMobileRepository", () => ({
  LeaveMobileRepository: class {
    findRequesterContext = mockLeaveMobileRepository.findRequesterContext;
    findApproverIdsForMobileLeaveNotification =
      mockLeaveMobileRepository.findApproverIdsForMobileLeaveNotification;
  },
}));

vi.mock("@/modules/attendance/repositories/LeaveRequestRepository", () => ({
  LeaveRequestRepository: class {
    create = mockLeaveRequestRepository.create;
    update = mockLeaveRequestRepository.update;
    delete = mockLeaveRequestRepository.delete;
    findById = mockLeaveRequestRepository.findById;
    findAll = mockLeaveRequestRepository.findAll;
    count = mockLeaveRequestRepository.count;
  },
}));

describe("LeaveRepository", () => {
  let repository: LeaveRepository;

  const mockLeave = {
    id: "leave-1",
    userId: "user-1",
    type: "CUTI",
    startDate: new Date("2026-05-10"),
    endDate: new Date("2026-05-12"),
    reason: "Liburan keluarga",
    status: "PENDING",
    approvedBy: null as string | null,
    rejectionReason: null as string | null,
    replacementDate: null as Date | null,
    attachmentUrl: null as string | null,
    tenantId: "tenant-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLeaveWithUser = {
    ...mockLeave,
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
    },
  };

  beforeEach(() => {
    repository = new LeaveRepository();
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("harus create leave request baru", async () => {
      const createInput = {
        userId: "user-1",
        type: "CUTI",
        startDate: new Date("2026-05-10"),
        endDate: new Date("2026-05-12"),
        reason: "Liburan keluarga",
        status: "PENDING",
        tenantId: "tenant-1",
      };

      mockLeaveRequestRepository.create.mockResolvedValue(mockLeave);

      const result = await repository.create(createInput as never);

      expect(result).toEqual(mockLeave);
      expect(mockLeaveRequestRepository.create).toHaveBeenCalledWith(
        createInput,
      );
    });
  });

  describe("update", () => {
    it("harus update leave request", async () => {
      const updateInput = {
        status: "APPROVED",
        approvedBy: "approver-1",
      };

      mockLeaveRequestRepository.update.mockResolvedValue({
        ...mockLeave,
        status: "APPROVED",
        approvedBy: "approver-1",
      });

      const result = await repository.update("leave-1", updateInput as never);

      expect(result.status).toBe("APPROVED");
      expect(result.approvedBy).toBe("approver-1");
      expect(mockLeaveRequestRepository.update).toHaveBeenCalledWith(
        "leave-1",
        updateInput,
      );
    });
  });

  describe("delete", () => {
    it("harus delete leave request", async () => {
      mockLeaveRequestRepository.delete.mockResolvedValue(mockLeave);

      await repository.delete("leave-1");

      expect(mockLeaveRequestRepository.delete).toHaveBeenCalledWith("leave-1");
    });
  });

  describe("findById", () => {
    it("harus return leave by ID dengan user info", async () => {
      mockLeaveRequestRepository.findById.mockResolvedValue(mockLeaveWithUser);

      const result = await repository.findById("leave-1");

      expect(result).toEqual(mockLeaveWithUser);
      expect(mockLeaveRequestRepository.findById).toHaveBeenCalledWith(
        "leave-1",
      );
    });

    it("harus return null jika leave tidak ditemukan", async () => {
      mockLeaveRequestRepository.findById.mockResolvedValue(null);

      const result = await repository.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    it("harus return list leaves dengan pagination", async () => {
      mockLeaveRequestRepository.findAll.mockResolvedValue([mockLeaveWithUser]);

      const result = await repository.findAll({
        skip: 0,
        take: 10,
        tenantId: "tenant-1",
      });

      expect(result).toHaveLength(1);
      expect(mockLeaveRequestRepository.findAll).toHaveBeenCalled();
    });

    it("harus filter by userId", async () => {
      mockLeaveRequestRepository.findAll.mockResolvedValue([mockLeaveWithUser]);

      await repository.findAll({ userId: "user-1", tenantId: "tenant-1" });

      expect(mockLeaveRequestRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
        }),
      );
    });

    it("harus filter by status", async () => {
      mockLeaveRequestRepository.findAll.mockResolvedValue([]);

      await repository.findAll({ status: "APPROVED", tenantId: "tenant-1" });

      expect(mockLeaveRequestRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "APPROVED",
        }),
      );
    });

    it("harus filter by date range", async () => {
      const startDate = new Date("2026-05-01");
      const endDate = new Date("2026-05-31");

      mockLeaveRequestRepository.findAll.mockResolvedValue([]);

      await repository.findAll({ startDate, endDate, tenantId: "tenant-1" });

      expect(mockLeaveRequestRepository.findAll).toHaveBeenCalled();
    });
  });

  describe("count", () => {
    it("harus return count leaves", async () => {
      mockLeaveRequestRepository.count.mockResolvedValue(5);

      const result = await repository.count({ tenantId: "tenant-1" });

      expect(result).toBe(5);
      expect(mockLeaveRequestRepository.count).toHaveBeenCalled();
    });

    it("harus count dengan filter status", async () => {
      mockLeaveRequestRepository.count.mockResolvedValue(3);

      const result = await repository.count({
        status: "PENDING",
        tenantId: "tenant-1",
      });

      expect(result).toBe(3);
      expect(mockLeaveRequestRepository.count).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "PENDING",
        }),
      );
    });
  });

  describe("findRequesterContext", () => {
    it("harus return requester context untuk mobile", async () => {
      const mockContext = {
        id: "user-1",
        name: "Test User",
        siteId: "site-1",
        departmentId: "dept-1",
      };

      mockLeaveMobileRepository.findRequesterContext.mockResolvedValue(
        mockContext,
      );

      const result = await repository.findRequesterContext(
        "user-1",
        "tenant-1",
      );

      expect(result).toEqual(mockContext);
      expect(
        mockLeaveMobileRepository.findRequesterContext,
      ).toHaveBeenCalledWith("user-1", "tenant-1");
    });
  });

  describe("findApproverIdsForMobileLeaveNotification", () => {
    it("harus return approver IDs", async () => {
      const mockApprovers = [{ id: "admin-1" }, { id: "admin-2" }];

      mockLeaveMobileRepository.findApproverIdsForMobileLeaveNotification.mockResolvedValue(
        mockApprovers,
      );

      const result = await repository.findApproverIdsForMobileLeaveNotification(
        {
          tenantId: "tenant-1",
          siteId: "site-1",
        },
      );

      expect(result).toEqual(mockApprovers);
      expect(
        mockLeaveMobileRepository.findApproverIdsForMobileLeaveNotification,
      ).toHaveBeenCalledWith({
        tenantId: "tenant-1",
        siteId: "site-1",
      });
    });
  });
});
